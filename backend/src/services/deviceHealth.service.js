const Device = require("../models/Device");
const { logAudit } = require("./audit.service");
const { emit: socketEmit } = require("./socket.service");

/**
 * Device health rules: when a device counts as offline, and when it counts as
 * broken rather than merely down.
 *
 * The distinction matters because they need different responses. A device that
 * is down needs someone to go and restart it. A device that keeps cycling is
 * faulty hardware, and treating each flip as fresh news buries the queue.
 */

// A device is offline once it has missed several consecutive reports. Deriving
// the threshold from its own cadence is the only rule that holds across a fleet
// where reporting intervals differ by three orders of magnitude — a flat 60s
// grace would mark every 30-minute sensor offline immediately.
const MISSED_REPORTS_BEFORE_OFFLINE = 3;
const MIN_GRACE_SECONDS = 60;

function graceSecondsFor(device) {
  const interval = Number(device?.expectedIntervalSeconds) || 60;
  return Math.max(MIN_GRACE_SECONDS, MISSED_REPORTS_BEFORE_OFFLINE * interval);
}

// Flapping thresholds. Loose enough to ignore a single reconnect, tight enough
// to catch genuinely unstable hardware inside one detection cycle.
function flapWindowMinutes() {
  const raw = Number(process.env.DEVICE_FLAP_WINDOW_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

function flapThreshold() {
  const raw = Number(process.env.DEVICE_FLAP_THRESHOLD);
  return Number.isFinite(raw) && raw > 1 ? raw : 4;
}

/**
 * Builds the query for devices that have gone quiet, evaluating each device's
 * own grace period server-side so this stays one query rather than a scan.
 */
function offlineCandidateQuery(now = new Date()) {
  return {
    availability: "AVAILABLE",
    disabled: false,
    $expr: {
      $lt: [
        "$lastSeenAt",
        {
          $subtract: [
            now,
            {
              $multiply: [
                1000,
                {
                  $max: [
                    MIN_GRACE_SECONDS,
                    {
                      $multiply: [
                        MISSED_REPORTS_BEFORE_OFFLINE,
                        { $ifNull: ["$expectedIntervalSeconds", 60] }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

/**
 * Records an availability flip and decides whether the device is now flapping.
 *
 * Returns { flapping, flips } — `flapping` is true only on the transition into
 * the faulty state, so the caller raises one alert rather than one per flip.
 */
async function recordFlip(device, at = new Date()) {
  const windowMs = flapWindowMinutes() * 60 * 1000;
  const cutoff = new Date(at.getTime() - windowMs);

  const flips = [...(device.availabilityFlips || []), at].filter((d) => new Date(d) >= cutoff);

  const threshold = flapThreshold();
  const alreadyFlagged = device.status === "FAULTY" && device.flappingSince;
  const nowFlapping = flips.length >= threshold;

  const update = { availabilityFlips: flips };
  let becameFaulty = false;

  if (nowFlapping && !alreadyFlagged) {
    // FAULTY already exists in the Device status enum, so an unstable device
    // needs no new vocabulary — it is not "available", it is broken.
    update.status = "FAULTY";
    update.flappingSince = at;
    becameFaulty = true;
  }

  await Device.updateOne({ _id: device._id }, update);

  if (becameFaulty) {
    await logAudit({
      event: "device.flagged_faulty",
      targetType: "DEVICE",
      targetId: device._id,
      meta: {
        deviceId: device.deviceId,
        flips: flips.length,
        windowMinutes: flapWindowMinutes(),
        threshold
      }
    });
    socketEmit("device:availability", {
      deviceRef: device._id.toString(),
      deviceId: device.deviceId,
      plantId: device.plantId ? String(device.plantId) : null,
      availability: device.availability,
      status: "FAULTY"
    });
  }

  return { flapping: becameFaulty, flips: flips.length };
}

/**
 * A device already known to be faulty should not keep raising offline alerts.
 * There is an open ticket saying the hardware is unreliable; repeating it only
 * pushes the alerts that still need triage off the top of the queue.
 */
function shouldSuppressOfflineAlert(device) {
  return device?.status === "FAULTY";
}

/** Clears the faulty flag once a device has reported steadily again. */
async function clearFlappingIfStable(device, at = new Date()) {
  if (device.status !== "FAULTY" || !device.flappingSince) return false;

  const windowMs = flapWindowMinutes() * 60 * 1000;
  const cutoff = new Date(at.getTime() - windowMs);
  const flips = (device.availabilityFlips || []).filter((d) => new Date(d) >= cutoff);

  // Steady for a full window with no flips: the fault looks resolved.
  if (flips.length > 0) return false;

  await Device.updateOne(
    { _id: device._id },
    { status: "INSTALLED", flappingSince: null, availabilityFlips: [] }
  );

  await logAudit({
    event: "device.stability_restored",
    targetType: "DEVICE",
    targetId: device._id,
    meta: { deviceId: device.deviceId, steadyForMinutes: flapWindowMinutes() }
  });
  return true;
}

module.exports = {
  graceSecondsFor,
  offlineCandidateQuery,
  recordFlip,
  shouldSuppressOfflineAlert,
  clearFlappingIfStable,
  flapWindowMinutes,
  flapThreshold,
  MISSED_REPORTS_BEFORE_OFFLINE,
  MIN_GRACE_SECONDS
};
