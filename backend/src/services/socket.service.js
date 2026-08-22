const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;
let publicNs = null;

function initSocket(httpServer) {
  const rawOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const corsConfig = {
    origin: !rawOrigins.length || rawOrigins.includes("*") ? true : rawOrigins,
    methods: ["GET", "POST"]
  };

  io = new Server(httpServer, { cors: corsConfig });

  // Authenticated namespace — requires JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Unauthorized"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "");
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id} (user: ${socket.userId})`);
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  // Public namespace — no auth, plant availability events only
  publicNs = io.of("/public");
  publicNs.on("connection", (socket) => {
    socket.on("disconnect", () => {});
  });

  return io;
}

function emit(event, data) {
  if (io) io.emit(event, data);
  // Mirror plant:availability to the public namespace so unauthenticated users receive it
  if (event === "plant:availability" && publicNs) {
    publicNs.emit(event, data);
  }
}

function emitPublic(event, data) {
  if (publicNs) publicNs.emit(event, data);
}

module.exports = { initSocket, emit, emitPublic };
