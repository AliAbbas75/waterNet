const Plant = require("../models/Plant");
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

    const plants = await Plant.find(query).sort({ createdAt: -1 });

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
    const plant = await Plant.findById(req.params.id);
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
    const { name, address, geo, operationalStatus, operatingHours, tankCapacityLitres } = req.body;

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
    const { name, address, geo, operationalStatus, operatingHours, tankCapacityLitres } = req.body;

    const previous = await Plant.findById(req.params.id);
    if (!previous) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = await Plant.findByIdAndUpdate(
      req.params.id,
      {
        name,
        address,
        geo,
        operationalStatus,
        operatingHours,
        ...(tankCapacityLitres !== undefined ? { tankCapacityLitres } : {})
      },
      { new: true, runValidators: true }
    );

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
        meta: { from: prevStatus, to: newStatus, plantName: plant.name }
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
