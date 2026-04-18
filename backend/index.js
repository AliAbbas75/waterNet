require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { connectDb } = require("./shared/db");
const authRoutes = require("./modules/auth_blockchain/auth.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);

app.use((err, _req, res, _next) => {
  // keep error responses simple and consistent
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message || "Server error" });
});

const port = process.env.PORT || 4000;

(async () => {
  await connectDb(process.env.MONGODB_URI);

  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
})();
