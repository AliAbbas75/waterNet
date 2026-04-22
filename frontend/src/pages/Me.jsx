import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchMe, logout } from "../lib/backendAuth";

export default function Me() {
  const navigate = useNavigate();

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setStatus("loading");
        setError("");
        const res = await fetchMe();
        if (!cancelled) {
          setData(res);
          setStatus("done");
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e?.message || "Failed to load /me");
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ margin: "12px 0" }}>Me</h1>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={onLogout}>Logout</button>
        <button
          onClick={() => {
            setData(null);
            setError("");
            setStatus("loading");
            fetchMe()
              .then((res) => {
                setData(res);
                setStatus("done");
              })
              .catch((e) => {
                setStatus("error");
                setError(e?.message || "Refresh failed");
              });
          }}
        >
          Refresh
        </button>
      </div>

      {status === "loading" ? <p>Loading…</p> : null}
      {status === "error" ? (
        <p style={{ color: "crimson" }}>
          {error} {String(error || "").includes("Not logged in") ? "(Go to Login)" : ""}
        </p>
      ) : null}

      {data ? (
        <pre style={{ marginTop: 12, padding: 12, background: "var(--code-bg)", overflowX: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
