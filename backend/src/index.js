const express = require("express");
const cors = require("cors");

const { connectDb } = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const plantRoutes = require("./routes/plant.routes");
const deviceRoutes = require("./routes/device.routes");
const maintenanceRoutes = require("./routes/maintenance.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const alertRoutes = require("./routes/alert.routes");
const analysisRoutes = require("./routes/analysis.routes");
const { connectMqtt } = require("./services/mqtt.service");

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
      : true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-client-id",
      "x-thirdweb-client-id",
      "thirdweb-client-id"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/plants", plantRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/maintenance/tasks", maintenanceRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/analysis", analysisRoutes);

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

const port = process.env.PORT || 4000;

(async () => {
  await connectDb();
  connectMqtt();
  app.listen(port, () => {
    console.log(`waterNet backend listening on :${port}`);
  });
})();
