const TOKEN_KEY = "waternet_backend_jwt";

export function getBackendToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setBackendToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearBackendToken() {
  localStorage.removeItem(TOKEN_KEY);
}
