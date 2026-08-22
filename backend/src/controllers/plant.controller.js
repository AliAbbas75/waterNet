const Plant = require("../models/Plant");
const Alert = require("../models/Alert");
const { emit: socketEmit } = require("../services/socket.service");
const { notifyAdminsOfAlert } = require("../services/alert.notification.service");
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
      if (newStatus === 'OPERATIONAL') {
        // Plant restored — resolve any open availability alert
        await Alert.updateMany(
          { type: 'AVAILABILITY_CHANGE', plantId: plant._id, status: { $in: ['OPEN', 'ACK'] } },
          { status: 'RESOLVED', resolvedAt: new Date() }
        );
      } else {
        // Plant went CLOSED or MAINTENANCE
        const existing = await Alert.findOne({
          type: 'AVAILABILITY_CHANGE',
          plantId: plant._id,
          status: { $in: ['OPEN', 'ACK'] }
        });
        if (!existing) {
          const alert = await Alert.create({
            type: 'AVAILABILITY_CHANGE',
            severity: newStatus === 'CLOSED' ? 'CRITICAL' : 'WARN',
            plantId: plant._id,
            message: `Plant "${plant.name}" is now ${newStatus.toLowerCase()}`
          });
          socketEmit("alert:new", { alert });
          // Broadcast availability change to public namespace for public users
          socketEmit("plant:availability", {
            plantId: plant._id,
            plantName: plant.name,
            operationalStatus: newStatus,
            available: false
          });
          notifyAdminsOfAlert(alert).catch((err) =>
            console.error("Alert notification error:", err?.message || err)
          );
        }
      }

      // Always broadcast current status to public namespace on any change
      if (newStatus === 'OPERATIONAL') {
        socketEmit("plant:availability", {
          plantId: plant._id,
          plantName: plant.name,
          operationalStatus: newStatus,
          available: true
        });
      }
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
