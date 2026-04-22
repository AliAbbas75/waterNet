const mongoose = require("mongoose");

let connected = false;

async function connectDb() {
  if (connected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  connected = true;

  console.log("Connected to MongoDB");
}

module.exports = { connectDb };
