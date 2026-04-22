const express = require("express");
const cors = require("cors");

const { connectDb } = require("./config/db");
const { assertEnv } = require("./config/env");
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const { requestId } = require("./middleware/requestId");
const { httpLogger } = require("./middleware/httpLogger");

const app = express();

app.use(requestId);
app.use(httpLogger);

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
app.use("/api/admin", adminRoutes);

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
  app.listen(port, () => {
    console.log(`waterNet backend listening on :${port}`);
  });
})();
