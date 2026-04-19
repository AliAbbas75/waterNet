import { clearBackendToken, getBackendToken, setBackendToken } from "./tokenStore";

const DEFAULT_BACKEND_URL = "http://localhost:4000";

function getBackendUrl() {
  return (import.meta.env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL).replace(/\/$/, "");
}

async function fetchJson(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || body?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return body;
}

export async function loginToBackend({ thirdwebToken, walletAddress }) {
  const data = await fetchJson(`${getBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      ...(import.meta.env.VITE_THIRDWEB_CLIENT_ID
        ? { "x-client-id": import.meta.env.VITE_THIRDWEB_CLIENT_ID }
        : {})
    },
    body: JSON.stringify({ token: thirdwebToken, walletAddress })
  });

  if (data?.token) {
    setBackendToken(data.token);
  }

  return data;
}

export async function fetchMe() {
  const token = getBackendToken();
  if (!token) {
    const err = new Error("Not logged in");
    err.status = 401;
    throw err;
  }

  return fetchJson(`${getBackendUrl()}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export async function logout() {
  const token = getBackendToken();
  if (!token) {
    clearBackendToken();
    return { ok: true };
  }

  try {
    const data = await fetchJson(`${getBackendUrl()}/api/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    return data;
  } finally {
    clearBackendToken();
  }
}
