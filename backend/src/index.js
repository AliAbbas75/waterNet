const http = require("http");
const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { initSocket } = require("./services/socket.service");

const { connectDb } = require("./config/db");
const { assertEnv } = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const { openapi } = require("./docs/openapi");
const { requestId } = require("./middleware/requestId");
const { httpLogger } = require("./middleware/httpLogger");
const plantRoutes = require("./routes/plant.routes");
const deviceRoutes = require("./routes/device.routes");
const maintenanceRoutes = require("./routes/maintenance.routes");
const inventoryRoutes = require("./routes/inventory.routes");
const alertRoutes = require("./routes/alert.routes");
const analysisRoutes = require("./routes/analysis.routes");
const { connectMqtt } = require("./services/mqtt.service");
const adminRoutes = require("./routes/admin.routes");
const userRoutes = require("./routes/user.routes");
const publicRoutes = require("./routes/public.routes");
const reportRoutes = require("./routes/reports.routes");
const notificationRoutes = require("./routes/notification.routes");

const app = express();

// Behind nginx every request reaches the backend from the proxy container, so
// req.ip is the same address for all users unless express is told to read
// X-Forwarded-For. rateLimit() buckets on req.ip, so without this the whole
// deployment shares one bucket and five OTP requests lock everyone out for ten
// minutes. Only proxies on private networks are trusted: the backend port is
// published, and a client reaching it directly must not be able to claim any
// address it likes with a forged header.
app.set("trust proxy", process.env.TRUST_PROXY || "loopback, uniquelocal");

app.use(requestId);
app.use(httpLogger);

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

app.use(
  cors({
    // Treat "*" as allow-all to support mobile/web dev without listing every origin.
    origin: !corsOrigins || corsOrigins.includes("*") ? true : corsOrigins,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  })
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/docs.json", (_req, res) => {
  res.json(openapi);
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi, { explorer: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/plants", plantRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/maintenance/tasks", maintenanceRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/analysis", analysisRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);

app.use((err, req, res, _next) => {
  const status = err.statusCode || 500;
  res
    .status(status)
    .json({ ok: false, error: err.message || "Server error", requestId: req.requestId });
});

const port = process.env.PORT || 4000;

(async () => {
  assertEnv();
  await connectDb();
  if (process.env.DISABLE_MQTT === "true") {
    console.log("MQTT disabled via DISABLE_MQTT=true");
  } else {
    try {
      await connectMqtt();
    } catch (err) {
      console.warn("MQTT connect failed; continuing without MQTT:", err?.message || err);
    }
  }
  const server = http.createServer(app);
  initSocket(server);
  server.listen(port, () => {
    console.log(`waterNet backend listening on :${port}`);
  });
  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use. Stop the other process or set PORT to a free port.`);
      process.exit(1);
    }
    console.error("Server failed to start:", err);
    process.exit(1);
  });
})();
