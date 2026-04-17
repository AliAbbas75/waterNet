const mongoose = require("mongoose");

let hasConnected = false;

async function connectDb(mongoUri) {
  if (hasConnected) return;
  if (!mongoUri) {
    throw Object.assign(new Error("Missing MONGODB_URI"), { statusCode: 500 });
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoUri);
  hasConnected = true;
  console.log("Connected to MongoDB");
}

module.exports = { connectDb };
