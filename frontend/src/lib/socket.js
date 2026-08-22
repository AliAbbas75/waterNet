import { io } from "socket.io-client";
import { getBackendToken } from "./tokenStore.js";

const DEFAULT_BACKEND_URL = "http://localhost:4000";

function backendOrigin() {
  const env = import.meta.env.VITE_BACKEND_URL;
  const base = typeof env === "string" ? env.replace(/\/$/, "") : DEFAULT_BACKEND_URL;
  return base || (typeof window !== "undefined" ? window.location.origin : DEFAULT_BACKEND_URL);
}

let socket = null;
let socketToken = null;
let publicSocket = null;

export function getSocket() {
  const token = getBackendToken();
  if (!token) return null;

  // Reuse the socket while it is still connecting, not just once connected.
  // Several hooks call getSocket() during the same render pass; keying off
  // `.connected` tore down the in-flight socket on every one of those calls,
  // dropping the listeners the earlier hooks had already registered.
  if (socket && socketToken === token) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socketToken = token;
  socket = io(backendOrigin(), {
    auth: { token },
    // Keep polling as a fallback so the app still receives events if a proxy
    // in front of the backend refuses the WebSocket upgrade.
    transports: ["websocket", "polling"],
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000
  });

  return socket;
}

export function getPublicSocket() {
  if (publicSocket && publicSocket.connected) return publicSocket;
  if (publicSocket) {
    publicSocket.disconnect();
    publicSocket = null;
  }
  publicSocket = io(`${backendOrigin()}/public`, {
    transports: ["websocket"],
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000
  });
  return publicSocket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketToken = null;
  }
  if (publicSocket) {
    publicSocket.disconnect();
    publicSocket = null;
  }
}
