import { getBackendToken, clearBackendToken } from "./tokenStore.js";

const DEFAULT_BACKEND_URL = "http://localhost:4000";

function backendUrl() {
  // If VITE_BACKEND_URL is explicitly set (even to ""), respect it — empty string means
  // "use relative URLs", which is what we want behind the dockerized nginx reverse proxy.
  // If it's undefined (not set in any .env), fall back to the dev default.
  const env = import.meta.env.VITE_BACKEND_URL;
  if (typeof env === "string") return env.replace(/\/$/, "");
  return DEFAULT_BACKEND_URL.replace(/\/$/, "");
}

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    this.body = body ?? null;
  }
}

async function request(path, { method = "GET", body, params, auth = true, headers = {} } = {}) {
  // Build the URL. Empty backendUrl() means "use relative URLs" (typically because nginx
  // proxies /api/* to the backend container), so anchor against window.location.origin
  // to satisfy the URL constructor.
  const base = backendUrl();
  const url = new URL(
    base ? base + path : path,
    base ? undefined : typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    });
  }

  const finalHeaders = {
    Accept: "application/json",
    ...headers
  };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";

  if (auth) {
    const token = getBackendToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (err) {
    throw new ApiError(err?.message || "Network error", { status: 0 });
  }

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    // 401 with any auth-bearing call means the token is dead — drop it.
    if (auth && res.status === 401) clearBackendToken();
    const msg =
      (payload && (payload.error || payload.message)) ||
      `Request failed (${res.status})`;
    throw new ApiError(msg, { status: res.status, body: payload });
  }

  return payload;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),
  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),
  del: (path, opts) => request(path, { ...opts, method: "DELETE" })
};
