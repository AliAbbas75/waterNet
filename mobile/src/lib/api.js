import { BACKEND_URL } from "./config.js";
import { clearToken, getToken } from "./tokenStore.js";

export class ApiError extends Error {
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status ?? 0;
    this.body = body ?? null;
  }
}

async function request(path, { method = "GET", body, params, auth = true, headers = {} } = {}) {
  let url = BACKEND_URL + path;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const q = qs.toString();
    if (q) url += (url.includes("?") ? "&" : "?") + q;
  }

  const finalHeaders = { Accept: "application/json", ...headers };
  if (body !== undefined) finalHeaders["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
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
    throw new ApiError(err?.message || "Network error — is the backend reachable?", { status: 0 });
  }

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    if (auth && res.status === 401) {
      await clearToken();
    }
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
