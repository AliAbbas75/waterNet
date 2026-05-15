import { syncStorage } from "./storage.js";

const TOKEN_KEY = "waternet_backend_jwt";

export function getBackendToken() {
  return syncStorage.getItem(TOKEN_KEY);
}

export function setBackendToken(token) {
  if (!token) return;
  syncStorage.setItem(TOKEN_KEY, token);
}

export function clearBackendToken() {
  syncStorage.removeItem(TOKEN_KEY);
}
