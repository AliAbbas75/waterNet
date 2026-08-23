import { io } from "socket.io-client";
import { getBackendToken } from "./tokenStore.js";
import { queryClient } from "./queryClient.js";

const DEFAULT_BACKEND_URL = "http://localhost:4000";

function backendOrigin() {
  const env = import.meta.env.VITE_BACKEND_URL;
  const base = typeof env === "string" ? env.replace(/\/$/, "") : DEFAULT_BACKEND_URL;
  return base || (typeof window !== "undefined" ? window.location.origin : DEFAULT_BACKEND_URL);
}

let socket = null;
let socketToken = null;
let publicSocket = null;

/**
 * Refetch everything when a socket comes back.
 *
 * Socket.io reconnects on its own, but the events emitted while it was away are
 * gone — they are fire-and-forget broadcasts, not a replayable log. Without
 * this, one dropped connection leaves every screen frozen at the moment the
 * link died, and the only cure is a manual refresh. A backend redeploy or ten
 * seconds of bad wifi is enough to do it.
 *
 * `connect` fires on the first connection too, which is harmless: the queries
 * have either just been fetched or are about to be.
 */
function resyncOnReconnect(s) {
  s.on("connect", () => {
    queryClient.invalidateQueries();
  });
}

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

  resyncOnReconnect(socket);
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
