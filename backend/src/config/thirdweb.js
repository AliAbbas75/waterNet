function getThirdwebApiBase() {
  return process.env.THIRDWEB_API_BASE || "https://api.thirdweb.com";
}

async function getThirdwebMe(thirdwebToken, opts = {}) {
  if (!thirdwebToken) {
    const err = new Error("Missing Thirdweb token");
    err.statusCode = 400;
    throw err;
  }

  const base = getThirdwebApiBase();
  const headers = {
    Authorization: `Bearer ${thirdwebToken}`
  };

  // Some thirdweb endpoints require `x-client-id`.
  // Prefer server env var, but allow passing it from the client for local dev.
  const clientId = process.env.THIRDWEB_CLIENT_ID || opts.clientId;
  if (clientId) headers["x-client-id"] = clientId;

  const res = await fetch(`${base}/v1/wallets/me`, { headers });

  if (!res.ok) {
    let detail = "";
    try {
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const body = await res.json();
        detail = body?.error?.message || body?.error || body?.message || "";
      } else {
        detail = (await res.text()) || "";
      }
    } catch (_e) {
      // ignore parsing errors
    }

    const err = new Error(
      detail
        ? `Thirdweb token verification failed: ${detail}`
        : "Thirdweb token verification failed"
    );
    err.statusCode = 401;
    throw err;
  }

  const data = await res.json();
  return data.result;
}

module.exports = { getThirdwebMe };
