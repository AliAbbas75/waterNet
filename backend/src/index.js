const express = require("express");
const cors = require("cors");

const { connectDb } = require("./config/db");
const authRoutes = require("./routes/auth.routes");

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

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

const port = process.env.PORT || 4000;

(async () => {
  await connectDb();
  app.listen(port, () => {
    console.log(`waterNet backend listening on :${port}`);
  });
})();
