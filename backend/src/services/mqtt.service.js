const fs = require("fs");
const mqtt = require("mqtt");
const cron = require("node-cron");
const TelemetryReading = require("../models/TelemetryReading");
const Device = require("../models/Device");
const { evaluateQuality } = require("../controllers/analysis.controller");
const { raiseAlert, clearAlerts } = require("./alert.service");
const {
  offlineCandidateQuery,
  recordFlip,
  shouldSuppressOfflineAlert,
  clearFlappingIfStable
} = require("./deviceHealth.service");
const { emit: socketEmit } = require("./socket.service");

let client = null;
let connectPromise = null;

function readBoolEnv(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === "true";
}

function tryParseJson(buffer) {
  const text = buffer.toString();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isDeviceIdMismatch(topicDeviceId, payload) {
  if (!payload || payload.deviceId === undefined || payload.deviceId === null) {
    return false;
  }
  return String(payload.deviceId) !== String(topicDeviceId);
}

function getTopicPattern(envName, fallback) {
  const value = process.env[envName] || fallback;
  return value && value.trim() ? value.trim() : fallback;
}

function connectMqtt() {
  if (connectPromise) return connectPromise;

  const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
  const topicPrefix = getTopicPattern("MQTT_TOPIC_PREFIX", "waternet/v1/devices");
  const telemetryTopic = getTopicPattern("MQTT_TELEMETRY_TOPIC", `${topicPrefix}/+/telemetry`);
  const healthTopic = getTopicPattern("MQTT_HEALTH_TOPIC", `${topicPrefix}/+/health`);
  const lwtTopic = getTopicPattern("MQTT_LWT_TOPIC", `${topicPrefix}/+/lwt`);
  const options = {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId:
      process.env.MQTT_CLIENT_ID || `waternet-backend-${Math.random().toString(16).slice(2)}`,
    reconnectPeriod: Number(process.env.MQTT_RECONNECT_PERIOD_MS || 2000)
  };

  if (brokerUrl.startsWith("mqtts://")) {
    options.rejectUnauthorized = readBoolEnv("MQTT_TLS_REJECT_UNAUTHORIZED", true);

    const caPath = process.env.MQTT_CA_CERT_PATH;
    if (caPath) {
      try {
        options.ca = fs.readFileSync(caPath);
      } catch (err) {
        console.error("Failed to read MQTT CA cert at MQTT_CA_CERT_PATH:", err);
      }
    }
  }

  client = mqtt.connect(brokerUrl, options);

  connectPromise = new Promise((resolve, reject) => {
    const timeoutMs = Number(process.env.MQTT_CONNECT_TIMEOUT_MS || 10000);
    const timeout = setTimeout(() => {
      reject(new Error(`MQTT connect timeout after ${timeoutMs}ms (${brokerUrl})`));
    }, timeoutMs);

    function clear() {
      clearTimeout(timeout);
      client.off("connect", onConnect);
      client.off("error", onInitialError);
    }

    function onConnect() {
      clear();
      resolve(client);
    }

    function onInitialError(err) {
      clear();
      reject(err);
    }

    client.on("connect", onConnect);
    client.on("error", onInitialError);
  });

  client.on("connect", () => {
    console.log("Connected to MQTT broker");

    // Subscribe to telemetry and health topics
    console.log(`Subscribing to MQTT topics: ${telemetryTopic}, ${healthTopic}, ${lwtTopic}`);
    client.subscribe(telemetryTopic, { qos: 1 });
    client.subscribe(healthTopic, { qos: 1 });
    client.subscribe(lwtTopic, { qos: 1 });
  });

  client.on("message", async (topic, message) => {
    try {
      const parts = topic.split("/");
      const deviceId = parts[parts.length - 2];

      if (!deviceId) return;

      // Check if device exists and not disabled
      const device = await Device.findOne({ deviceId, disabled: false });
      if (!device) {
        console.log(`Ignoring message for unknown/disabled device: ${deviceId}`);
        return;
      }

      if (topic.endsWith("/telemetry")) {
        const payload = tryParseJson(message);
        if (!payload) {
          console.error("Invalid telemetry JSON payload for topic:", topic);
          return;
        }
        if (isDeviceIdMismatch(deviceId, payload)) {
          console.error("Telemetry deviceId mismatch for topic:", topic);
          return;
        }
        await handleTelemetry(device, payload);
      } else if (topic.endsWith("/health")) {
        const payload = tryParseJson(message);
        if (!payload) {
          console.error("Invalid health JSON payload for topic:", topic);
          return;
        }
        if (isDeviceIdMismatch(deviceId, payload)) {
          console.error("Health deviceId mismatch for topic:", topic);
          return;
        }
        await handleHealth(device, payload);
      } else if (topic.endsWith("/lwt")) {
        const payloadText = message.toString();
        await handleLwt(device, payloadText);
      }
    } catch (err) {
      console.error("Error processing MQTT message:", err);
    }
  });

  client.on("error", (err) => {
    console.error("MQTT error:", err);
  });

  client.on("close", () => {
    console.log("MQTT connection closed");
  });

  // Schedule availability check every minute (skip in MQTT-disabled mode)
  if (process.env.DISABLE_MQTT === "true") return connectPromise;
  cron.schedule("* * * * *", async () => {
    try {
      // Each device's grace period comes from its own reporting cadence; see
      // deviceHealth.service. A flat threshold cannot serve a fleet spanning a
      // 3-second ESP32 and 30-minute sensors.
      const devicesToOffline = await Device.find(offlineCandidateQuery(new Date()));

      for (const device of devicesToOffline) {
        const { flipped, flapping } = await setAvailability(device, "UNAVAILABLE");
        if (!flipped) continue;

        // A device that keeps cycling is faulty, not merely down. It gets one
        // DEVICE_FLAPPING ticket instead of an offline alert per cycle.
        if (flapping) {
          await raiseAlert({
            type: "DEVICE_FLAPPING",
            plantId: device.plantId,
            deviceId: device._id,
            message: `Device ${device.deviceId} is flapping between online and offline`,
            meta: { detectedBy: "availability-sweep" },
            context: { deviceName: device.deviceId }
          });
          continue;
        }

        if (shouldSuppressOfflineAlert(device)) continue;

        await raiseAlert({
          type: "DEVICE_OFFLINE",
          plantId: device.plantId,
          deviceId: device._id,
          message: `Device ${device.deviceId} is offline`,
          meta: { detectedBy: "availability-sweep", lastSeenAt: device.lastSeenAt },
          context: { deviceName: device.deviceId }
        });
      }
    } catch (err) {
      console.error("Error in availability check:", err);
    }
  });

  return connectPromise;
}

// Updates availability and pushes a socket event only when the value actually
// flips. findByIdAndUpdate returns the pre-update document, which is what makes
// the comparison possible — emitting unconditionally would fire on every
// telemetry message and make the dashboard refetch devices several times a
// minute for no state change.
async function setAvailability(device, availability, extra = {}) {
  const previous = await Device.findByIdAndUpdate(device._id, { availability, ...extra });
  if (!previous || previous.availability === availability) {
    return { flipped: false, flapping: false };
  }

  socketEmit("device:availability", {
    deviceRef: device._id.toString(),
    deviceId: device.deviceId,
    plantId: device.plantId ? String(device.plantId) : null,
    availability,
    lastSeenAt: extra.lastSeenAt ?? previous.lastSeenAt ?? null
  });

  // Both directions count. A flapping device cycles offline->online->offline,
  // so recording only the drops would see half the instability and take twice
  // as long to flag genuinely broken hardware.
  const { flapping } = await recordFlip({ ...device.toObject?.() ?? device, status: previous.status });

  // Coming back up steadily is what clears the faulty flag.
  if (availability === "AVAILABLE") {
    await clearFlappingIfStable({
      _id: device._id,
      deviceId: device.deviceId,
      status: previous.status,
      flappingSince: previous.flappingSince,
      availabilityFlips: previous.availabilityFlips
    });
  }

  return { flipped: true, flapping };
}

// Sensors report reading names with inconsistent casing (`tds` vs `TDS`). Map
// them onto the canonical names the model, thresholds and UI all key off.
const READING_KEY_ALIASES = {
  ph: "pH",
  turbidity: "turbidity",
  tds: "TDS",
  flowrate: "flowRate",
  totallitres: "totalLitres",
  totalliters: "totalLitres"
};

// Temperature is deliberately not tracked. Devices in the field still publish it,
// so it is dropped quietly here — routing it through the unrecognized-key warning
// below would flood the logs at every telemetry interval.
const IGNORED_READING_KEYS = new Set(["temperature", "temp"]);

function normalizeReadings(raw) {
  const readings = {};
  for (const [key, value] of Object.entries(raw)) {
    const lowerKey = key.toLowerCase();
    if (IGNORED_READING_KEYS.has(lowerKey)) continue;

    const canonical = READING_KEY_ALIASES[lowerKey];
    // Drop unknown keys rather than letting mongoose silently strip them, so
    // the "unmapped sensor field" case is visible in logs instead of vanishing.
    if (!canonical) {
      console.warn(`Ignoring unrecognized telemetry reading "${key}"`);
      continue;
    }
    const num = Number(value);
    if (!Number.isFinite(num)) {
      console.warn(`Ignoring non-numeric telemetry reading "${key}": ${value}`);
      continue;
    }
    readings[canonical] = num;
  }
  return readings;
}

// Accepts both the documented envelope
//   { schemaVersion, timestamp, readings: { pH, turbidity, TDS } }
// and the flat form firmware actually publishes
//   { pH, turbidity, tds, flowRate, totalLitres }
// Envelope fields are optional in the flat form: schemaVersion falls back to a
// default and timestamp to broker-receipt time, since the device sends neither.
function normalizeTelemetryPayload(payload) {
  const isEnvelope = payload.readings && typeof payload.readings === "object";
  const rawReadings = isEnvelope ? payload.readings : payload;
  const readings = normalizeReadings(rawReadings);

  if (Object.keys(readings).length === 0) return null;

  let timestamp = new Date(payload.timestamp ?? Date.now());
  if (Number.isNaN(timestamp.getTime())) {
    console.warn(`Invalid telemetry timestamp "${payload.timestamp}", using receipt time`);
    timestamp = new Date();
  }

  return {
    schemaVersion: String(
      payload.schemaVersion || process.env.MQTT_DEFAULT_SCHEMA_VERSION || "1.0"
    ),
    timestamp,
    readings
  };
}

async function handleTelemetry(device, rawPayload) {
  const normalized = normalizeTelemetryPayload(rawPayload);

  if (!normalized) {
    console.error("Invalid telemetry payload: no recognizable readings");
    return;
  }

  const { schemaVersion, timestamp, readings } = normalized;

  const telemetry = new TelemetryReading({
    deviceRef: device._id,
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp,
    readings,
    ingestMeta: {
      schemaVersion,
      protocol: "MQTT"
    }
  });

  await telemetry.save();

  // Mark device online — telemetry counts as a heartbeat
  await setAvailability(device, "AVAILABLE", { lastSeenAt: new Date() });

  // Resolve any open DEVICE_OFFLINE alert now that we are receiving data
  await clearAlerts({
    type: "DEVICE_OFFLINE",
    deviceId: device._id,
    reason: "device reporting again"
  });

  // Evaluate water quality (best-effort)
  try {
    await evaluateQuality(device.plantId, device._id, device.deviceId);
  } catch (err) {
    console.error("Error evaluating water quality:", err);
  }

  // Publish retained latest metrics
  if (client && client.connected) {
    client.publish(
      `waternet/v1/devices/${device.deviceId}/latest`,
      JSON.stringify({
        deviceId: device.deviceId,
        plantId: device.plantId,
        timestamp,
        readings,
        schemaVersion
      }),
      { qos: 1, retain: true }
    );
  }

  socketEmit("telemetry:new", {
    // Clients key off the Mongo id (that is what device routes use), so send
    // both rather than making every consumer resolve deviceId -> _id.
    deviceRef: device._id.toString(),
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp,
    readings
  });

  console.log(`Stored telemetry for device ${device.deviceId}`);
}

const HEALTH_KEY_ALIASES = {
  uptime: "uptime",
  uptimeseconds: "uptime",
  connectivitystatus: "connectivityStatus",
  connectivity: "connectivityStatus"
};

// Mirrors normalizeTelemetryPayload: accepts the `{ schemaVersion, timestamp,
// health: {...} }` envelope or the flat `{ uptime, connectivityStatus }` form.
function normalizeHealthPayload(payload) {
  const isEnvelope = payload.health && typeof payload.health === "object";
  const rawHealth = isEnvelope ? payload.health : payload;

  const health = {};
  for (const [key, value] of Object.entries(rawHealth)) {
    const canonical = HEALTH_KEY_ALIASES[key.toLowerCase()];
    if (!canonical) continue;
    if (canonical === "uptime") {
      const num = Number(value);
      if (Number.isFinite(num)) health.uptime = num;
    } else {
      health.connectivityStatus = String(value);
    }
  }

  if (Object.keys(health).length === 0) return null;

  let timestamp = new Date(payload.timestamp ?? Date.now());
  if (Number.isNaN(timestamp.getTime())) {
    console.warn(`Invalid health timestamp "${payload.timestamp}", using receipt time`);
    timestamp = new Date();
  }

  return {
    schemaVersion: String(
      payload.schemaVersion || process.env.MQTT_DEFAULT_SCHEMA_VERSION || "1.0"
    ),
    timestamp,
    health
  };
}

async function handleHealth(device, rawPayload) {
  const normalized = normalizeHealthPayload(rawPayload);

  if (!normalized) {
    console.error("Invalid health payload: no recognizable health fields");
    return;
  }

  const { schemaVersion, timestamp, health } = normalized;

  // Store as telemetry with health
  const telemetry = new TelemetryReading({
    deviceRef: device._id,
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp,
    health,
    ingestMeta: {
      schemaVersion,
      protocol: "MQTT"
    }
  });

  await telemetry.save();

  // Update device lastSeenAt and availability
  await setAvailability(device, "AVAILABLE", { lastSeenAt: new Date() });

  // Resolve any open DEVICE_OFFLINE alert now that the device is back
  await clearAlerts({
    type: "DEVICE_OFFLINE",
    deviceId: device._id,
    reason: "device reporting again"
  });

  // Publish retained online status
  if (client && client.connected) {
    client.publish(
      `waternet/v1/devices/${device.deviceId}/status`,
      JSON.stringify({
        deviceId: device.deviceId,
        status: "online",
        lastSeenAt: new Date().toISOString(),
        schemaVersion
      }),
      { qos: 1, retain: true }
    );
  }

  console.log(`Stored health for device ${device.deviceId}`);
}

async function handleLwt(device, payloadText) {
  // LWT payload is often a raw string like "offline"
  if (String(payloadText).trim().toLowerCase() !== "offline") return;

  // Capture the flip once, up front: the second call would be a no-op (already
  // UNAVAILABLE) and would report no flapping.
  const { flapping } = await setAvailability(device, "UNAVAILABLE");

  // Publish retained offline status
  if (client && client.connected) {
    client.publish(
      `waternet/v1/devices/${device.deviceId}/status`,
      JSON.stringify({
        deviceId: device.deviceId,
        status: "offline",
        lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null
      }),
      { qos: 1, retain: true }
    );
  }

  // Create alert immediately — the cron won't catch LWT-triggered offline because
  // the device is already UNAVAILABLE by the time the cron runs its AVAILABLE→UNAVAILABLE query.
  if (flapping) {
    await raiseAlert({
      type: "DEVICE_FLAPPING",
      plantId: device.plantId,
      deviceId: device._id,
      message: `Device ${device.deviceId} is flapping between online and offline`,
      meta: { detectedBy: "lwt" },
      context: { deviceName: device.deviceId }
    });
  } else if (!shouldSuppressOfflineAlert(device)) {
    await raiseAlert({
      type: "DEVICE_OFFLINE",
      plantId: device.plantId,
      deviceId: device._id,
      message: `Device ${device.deviceId} disconnected (LWT)`,
      meta: { detectedBy: "lwt" },
      context: { deviceName: device.deviceId }
    });
  }

  console.log(`Device ${device.deviceId} went offline (LWT)`);
}

function disconnectMqtt() {
  if (client) {
    client.end();
  }
}

module.exports = { connectMqtt, disconnectMqtt, handleTelemetryPayload: handleTelemetry };