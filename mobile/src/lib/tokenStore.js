import { storage } from "./storage.js";

const TOKEN_KEY = "waternet_backend_jwt";

// On RN we can't read tokens synchronously, so this surface is async. The
// AuthContext reads it once at boot, then keeps the JWT in memory for the
// API layer to grab via the in-memory cache below.
let inMemoryToken = null;

export async function loadToken() {
  inMemoryToken = await storage.getItem(TOKEN_KEY);
  return inMemoryToken;
}

export function getToken() {
  return inMemoryToken;
}

export async function setToken(token) {
  inMemoryToken = token || null;
  await storage.setItem(TOKEN_KEY, token || null);
}

export async function clearToken() {
  inMemoryToken = null;
  await storage.removeItem(TOKEN_KEY);
}
