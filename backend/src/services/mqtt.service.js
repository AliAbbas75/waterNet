const mqtt = require('mqtt');
const cron = require('node-cron');
const TelemetryReading = require('../models/TelemetryReading');
const Device = require('../models/Device');
const { evaluateQuality } = require('../controllers/analysis.controller');
const Alert = require('../models/Alert');

let client = null;

function connectMqtt() {
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  client = mqtt.connect(brokerUrl);

  client.on('connect', () => {
    console.log('Connected to MQTT broker');

    // Subscribe to telemetry and health topics
    client.subscribe('waternet/v1/devices/+/telemetry', { qos: 1 });
    client.subscribe('waternet/v1/devices/+/health', { qos: 1 });
    client.subscribe('waternet/v1/devices/+/lwt', { qos: 1 });
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const parts = topic.split('/');
      const deviceId = parts[3];

      if (!deviceId) return;

      // Check if device exists and not disabled
      const device = await Device.findOne({ deviceId, disabled: false });
      if (!device) {
        console.log(`Ignoring message for unknown/disabled device: ${deviceId}`);
        return;
      }

      if (topic.endsWith('/telemetry')) {
        await handleTelemetry(device, payload);
      } else if (topic.endsWith('/health')) {
        await handleHealth(device, payload);
      } else if (topic.endsWith('/lwt')) {
        await handleLwt(device, payload);
      }
    } catch (err) {
      console.error('Error processing MQTT message:', err);
    }
  });

  client.on('error', (err) => {
    console.error('MQTT error:', err);
  });

  client.on('close', () => {
    console.log('MQTT connection closed');
  });

  // Schedule availability check every minute
  cron.schedule('* * * * *', async () => {
    try {
      const gracePeriod = 6 * 60 * 1000; // 6 minutes
      const cutoff = new Date(Date.now() - gracePeriod);

      const devicesToOffline = await Device.find({
        lastSeenAt: { $lt: cutoff },
        availability: 'AVAILABLE',
        disabled: false
      });

      for (const device of devicesToOffline) {
        await Device.findByIdAndUpdate(device._id, { availability: 'UNAVAILABLE' });

        // Create alert
        const existing = await Alert.findOne({
          type: 'DEVICE_OFFLINE',
          deviceId: device._id,
          status: { $in: ['OPEN', 'ACK'] }
        });

        if (!existing) {
          await Alert.create({
            type: 'DEVICE_OFFLINE',
            severity: 'WARN',
            plantId: device.plantId,
            deviceId: device._id,
            message: `Device ${device.deviceId} is offline`
          });
        }
      }
    } catch (err) {
      console.error('Error in availability check:', err);
    }
  });
}

async function handleTelemetry(device, payload) {
  const { schemaVersion, timestamp, readings } = payload;

  if (!schemaVersion || !timestamp || !readings) {
    console.error('Invalid telemetry payload');
    return;
  }

  const telemetry = new TelemetryReading({
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp: new Date(timestamp),
    readings,
    ingestMeta: {
      schemaVersion,
      protocol: 'MQTT'
    }
  });

  await telemetry.save();

  // Update device lastSeenAt
  await Device.findByIdAndUpdate(device._id, { lastSeenAt: new Date() });

  // Evaluate water quality
  // await evaluateQuality(device.plantId, device._id);

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

  console.log(`Stored telemetry for device ${device.deviceId}`);
}

async function handleHealth(device, payload) {
  const { schemaVersion, timestamp, health } = payload;

  if (!schemaVersion || !timestamp || !health) {
    console.error('Invalid health payload');
    return;
  }

  // Store as telemetry with health
  const telemetry = new TelemetryReading({
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp: new Date(timestamp),
    health,
    ingestMeta: {
      schemaVersion,
      protocol: 'MQTT'
    }
  });

  await telemetry.save();

  // Update device lastSeenAt and availability
  await Device.findByIdAndUpdate(device._id, {
    lastSeenAt: new Date(),
    availability: 'AVAILABLE'
  });

  // Publish retained online status
  if (client && client.connected) {
    client.publish(
      `waternet/v1/devices/${device.deviceId}/status`,
      JSON.stringify({
        deviceId: device.deviceId,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
        schemaVersion
      }),
      { qos: 1, retain: true }
    );
  }

  console.log(`Stored health for device ${device.deviceId}`);
}

async function handleLwt(device, payload) {
  // LWT payload is usually "offline" or similar
  if (payload === 'offline') {
    await Device.findByIdAndUpdate(device._id, {
      availability: 'UNAVAILABLE'
    });

    // Publish retained offline status
    if (client && client.connected) {
      client.publish(
        `waternet/v1/devices/${device.deviceId}/status`,
        JSON.stringify({
          deviceId: device.deviceId,
          status: 'offline',
          lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null
        }),
        { qos: 1, retain: true }
      );
    }

    console.log(`Device ${device.deviceId} went offline (LWT)`);
  }
}

function disconnectMqtt() {
  if (client) {
    client.end();
  }
}

async function handleTelemetry(device, payload) {
  const { schemaVersion, timestamp, readings } = payload;

  if (!schemaVersion || !timestamp || !readings) {
    console.error('Invalid telemetry payload');
    return;
  }

  const telemetry = new TelemetryReading({
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp: new Date(timestamp),
    readings,
    ingestMeta: {
      schemaVersion,
      protocol: 'MQTT'
    }
  });

  await telemetry.save();

  // Update device lastSeenAt
  await Device.findByIdAndUpdate(device._id, { lastSeenAt: new Date() });

  // Evaluate water quality
  await evaluateQuality(device.plantId, device._id);

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

  console.log(`Stored telemetry for device ${device.deviceId}`);
}

async function handleHealth(device, payload) {
  const { schemaVersion, timestamp, health } = payload;

  if (!schemaVersion || !timestamp || !health) {
    console.error('Invalid health payload');
    return;
  }

  // Store as telemetry with health
  const telemetry = new TelemetryReading({
    deviceId: device.deviceId,
    plantId: device.plantId,
    timestamp: new Date(timestamp),
    health,
    ingestMeta: {
      schemaVersion,
      protocol: 'MQTT'
    }
  });

  await telemetry.save();

  // Update device lastSeenAt and availability
  await Device.findByIdAndUpdate(device._id, {
    lastSeenAt: new Date(),
    availability: 'AVAILABLE'
  });

  // Publish retained online status
  if (client && client.connected) {
    client.publish(
      `waternet/v1/devices/${device.deviceId}/status`,
      JSON.stringify({
        deviceId: device.deviceId,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
        schemaVersion
      }),
      { qos: 1, retain: true }
    );
  }

  console.log(`Stored health for device ${device.deviceId}`);
}

async function handleLwt(device, payload) {
  // LWT payload is usually "offline" or similar
  if (payload === 'offline') {
    await Device.findByIdAndUpdate(device._id, {
      availability: 'UNAVAILABLE'
    });

    // Publish retained offline status
    if (client && client.connected) {
      client.publish(
        `waternet/v1/devices/${device.deviceId}/status`,
        JSON.stringify({
          deviceId: device.deviceId,
          status: 'offline',
          lastSeenAt: device.lastSeenAt ? device.lastSeenAt.toISOString() : null
        }),
        { qos: 1, retain: true }
      );
    }

    console.log(`Device ${device.deviceId} went offline (LWT)`);
  }
}

module.exports = { connectMqtt, disconnectMqtt };