import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ConnectButton, useActiveAccount, useAuthToken } from "thirdweb/react";

import { loginToBackend } from "../lib/backendAuth";
import { client, wallets } from "../thirdwebClient";

export default function Login() {
  const navigate = useNavigate();

  const activeAccount = useActiveAccount();
  const authToken = useAuthToken();
  const walletAddress = activeAccount?.address || "";

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canLogin = useMemo(() => {
    return Boolean(walletAddress) && Boolean(authToken);
  }, [walletAddress, authToken]);

  async function onLogin() {
    setError("");
    setResult(null);

    if (!walletAddress) {
      setError("Connect a wallet first.");
      return;
    }

    if (!authToken) {
      setError("Missing Thirdweb auth token. Make sure you are connected with the in-app wallet.");
      return;
    }

    try {
      setStatus("loading");

      const data = await loginToBackend({
        thirdwebToken: authToken,
        walletAddress
      });

      setResult(data);
      setStatus("done");
      navigate("/me");
    } catch (e) {
      setStatus("idle");
      setError(e?.message || "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ margin: "12px 0" }}>Login</h1>

      <p style={{ marginBottom: 12 }}>
        1) Connect with Thirdweb in-app wallet. 2) Click “Login to backend” to exchange your Thirdweb token for a backend JWT.
      </p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {client ? (
          <ConnectButton
            client={client}
            wallets={wallets}
            detailsButton={{
              render: () => (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Connected{walletAddress ? `: ${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : ""}
                </span>
              )
            }}
          />
        ) : (
          <span>
            Missing <code>VITE_THIRDWEB_CLIENT_ID</code>
          </span>
        )}
        <button disabled={!canLogin || status === "loading"} onClick={onLogin}>
          {status === "loading" ? "Logging in…" : "Login to backend"}
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 14 }}>
          Wallet: {walletAddress || "(not connected)"}
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 14 }}>
          Thirdweb token: {authToken ? `present (len ${authToken.length})` : "missing"}
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>
      ) : null}

      {result ? (
        <pre style={{ marginTop: 12, padding: 12, background: "var(--code-bg)", overflowX: "auto" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}

      {!import.meta.env.VITE_THIRDWEB_CLIENT_ID ? (
        <p style={{ marginTop: 16 }}>
          Missing <code>VITE_THIRDWEB_CLIENT_ID</code>. Create <code>.env</code> (see <code>.env.example</code>).
        </p>
      ) : null}
    </div>
  );
}
