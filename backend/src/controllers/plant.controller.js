const mongoose = require("mongoose");
const Plant = require("../models/Plant");
const Device = require("../models/Device");
const User = require("../models/User");
const { emit: socketEmit } = require("../services/socket.service");
const { raiseAlert, clearAlerts } = require("../services/alert.service");
const { logAudit } = require("../services/audit.service");
const { getPlantConsumption, getConsumptionForPlants } = require("../services/consumption.service");

exports.getPlants = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (status) {
      query.operationalStatus = status;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { address: new RegExp(search, 'i') }
      ];
    }

    const plants = await Plant.find(query)
      .populate('coveringMaintainerId', 'display_name email role active')
      .sort({ createdAt: -1 });

    // Batched into a single aggregation so the list does not fan out per plant.
    const consumption = await getConsumptionForPlants(plants);
    const withConsumption = plants.map((plant) => ({
      ...plant.toObject(),
      consumption: consumption.get(String(plant._id)) || null
    }));

    res.json({ plants: withConsumption });
  } catch (err) {
    next(err);
  }
};

exports.getPlant = async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.id)
      .populate('qualityDeviceId', 'deviceId status availability plantId')
      .populate('coveringMaintainerId', 'display_name email role active');
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    const consumption = await getPlantConsumption(plant);
    res.json({ plant: { ...plant.toObject(), consumption } });
  } catch (err) {
    next(err);
  }
};

// GET /api/plants/:id/consumption — standalone so the UI can refresh the metric
// on live telemetry without refetching the whole plant document.
exports.getPlantConsumptionMetrics = async (req, res, next) => {
  try {
    const plant = await Plant.findById(req.params.id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    res.json({ consumption: await getPlantConsumption(plant) });
  } catch (err) {
    next(err);
  }
};

exports.createPlant = async (req, res, next) => {
  try {
    const {
      name,
      address,
      geo,
      operationalStatus,
      operatingHours,
      tankCapacityLitres,
      qualityDeviceId,
      coveringMaintainerId
    } = req.body;

    if (!name || !address || !geo || !geo.lat || !geo.lng) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plant = new Plant({
      name,
      address,
      geo,
      operationalStatus: operationalStatus || 'OPERATIONAL',
      operatingHours,
      ...(tankCapacityLitres !== undefined ? { tankCapacityLitres } : {})
    });

    await plant.save();
    res.status(201).json({ plant });
  } catch (err) {
    next(err);
  }
};

exports.updatePlant = async (req, res, next) => {
  try {
    const {
      name,
      address,
      geo,
      operationalStatus,
      operatingHours,
      tankCapacityLitres,
      qualityDeviceId,
      coveringMaintainerId
    } = req.body;
    const statusReason = typeof req.body.statusReason === 'string' ? req.body.statusReason.trim() : '';

    const previous = await Plant.findById(req.params.id);
    if (!previous) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // A plant may pin one installed device as its quality source; that device
    // must actually belong to this plant, or the readings would be someone else's.
    if (qualityDeviceId) {
      if (!mongoose.Types.ObjectId.isValid(qualityDeviceId)) {
        return res.status(400).json({ error: 'qualityDeviceId must be a valid device id' });
      }
      const qualityDevice = await Device.findById(qualityDeviceId);
      if (!qualityDevice) {
        return res.status(404).json({ error: 'Quality device not found' });
      }
      if (!qualityDevice.plantId || qualityDevice.plantId.toString() !== req.params.id) {
        return res.status(400).json({ error: 'Quality device must belong to this plant' });
      }
      // The picker only offers INSTALLED devices; accepting anything else would
      // persist a pin the dropdown cannot represent, leaving the Select blank.
      if (qualityDevice.status !== 'INSTALLED') {
        return res.status(400).json({ error: 'Quality device must be installed' });
      }
    }

    // Coverage is who answers for this site. Only somebody who can actually
    // hold a work order may be named, or the picker would offer an assignee the
    // dispatch endpoint then refuses.
    if (coveringMaintainerId) {
      if (!mongoose.Types.ObjectId.isValid(coveringMaintainerId)) {
        return res.status(400).json({ error: 'coveringMaintainerId must be a valid user id' });
      }
      const cover = await User.findById(coveringMaintainerId).select('role active display_name');
      if (!cover || !['MAINTAINER', 'MANAGER', 'ADMIN'].includes(cover.role)) {
        return res.status(400).json({ error: 'Coverage must be a maintainer, manager or admin' });
      }
      if (cover.active === false) {
        return res.status(400).json({ error: 'That account is suspended and cannot cover a plant' });
      }
    }

    const statusChanging = operationalStatus && operationalStatus !== previous.operationalStatus;

    // Manual status changes stay available — planned maintenance is a
    // legitimate reason to close a plant with no incident behind it — but every
    // closure needs an explanation on the record.
    if (statusChanging && !statusReason) {
      return res.status(400).json({
        error: 'statusReason is required when changing operational status'
      });
    }

    // Reopening a plant while a water-quality advisory stands would put unsafe
    // water back into public service. The advisory is lifted by resolving the
    // incident ticket, not by editing the plant.
    if (statusChanging && operationalStatus === 'OPERATIONAL' && previous.advisory?.active) {
      return res.status(409).json({
        error: 'Cannot reopen: a water quality advisory is active for this plant',
        advisory: previous.advisory
      });
    }

    const plant = await Plant.findByIdAndUpdate(
      req.params.id,
      {
        name,
        address,
        geo,
        operationalStatus,
        operatingHours,
        ...(tankCapacityLitres !== undefined ? { tankCapacityLitres } : {}),
        ...(qualityDeviceId !== undefined ? { qualityDeviceId: qualityDeviceId || null } : {}),
        ...(coveringMaintainerId !== undefined
          ? { coveringMaintainerId: coveringMaintainerId || null }
          : {})
      },
      { new: true, runValidators: true }
    )
      .populate('qualityDeviceId', 'deviceId status availability plantId')
      .populate('coveringMaintainerId', 'display_name email role active');

    if (
      coveringMaintainerId !== undefined &&
      String(previous.coveringMaintainerId || '') !== String(coveringMaintainerId || '')
    ) {
      await logAudit({
        event: 'plant.coverage_changed',
        req,
        actorUserId: req.user?._id || null,
        targetType: 'PLANT',
        targetId: plant._id,
        meta: {
          plantName: plant.name,
          from: previous.coveringMaintainerId ? String(previous.coveringMaintainerId) : null,
          to: plant.coveringMaintainerId
            ? plant.coveringMaintainerId.display_name || String(plant.coveringMaintainerId._id)
            : null
        }
      });
    }

    const prevStatus = previous.operationalStatus;
    const newStatus = plant.operationalStatus;

    if (prevStatus !== newStatus) {
      // Every closure needs an explanation on the record, whether an incident
      // drove it or an admin simply scheduled maintenance.
      await logAudit({
        event: 'plant.status_changed',
        req,
        actorUserId: req.user?._id || null,
        targetType: 'PLANT',
        targetId: plant._id,
        meta: { from: prevStatus, to: newStatus, plantName: plant.name, reason: statusReason }
      });

      if (newStatus === 'OPERATIONAL') {
        await clearAlerts({
          type: 'AVAILABILITY_CHANGE',
          plantId: plant._id,
          reason: 'plant returned to operational'
        });
      } else {
        await raiseAlert({
          type: 'AVAILABILITY_CHANGE',
          plantId: plant._id,
          message: `Plant "${plant.name}" is now ${newStatus.toLowerCase()}`,
          meta: { from: prevStatus, to: newStatus }
        });
      }

      // Broadcast on every status change. This used to sit inside the
      // "no existing alert" branch, so a second status change while an alert
      // was still open left the public view showing stale availability.
      socketEmit("plant:availability", {
        plantId: plant._id,
        plantName: plant.name,
        operationalStatus: newStatus,
        available: newStatus === 'OPERATIONAL'
      });
    }

    res.json({ plant });
  } catch (err) {
    next(err);
  }
};

exports.deletePlant = async (req, res, next) => {
  try {
    const plant = await Plant.findByIdAndDelete(req.params.id);
    if (!plant) {
      return res.status(404).json({ error: 'Plant not found' });
    }
    res.json({ message: 'Plant deleted' });
  } catch (err) {
    next(err);
  }
};
