import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ConnectButton, useActiveAccount, useAuthToken } from "thirdweb/react";
import { Droplet, Eye, EyeOff, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import clsx from "clsx";
import { useDevUsers } from "../hooks/useUsers.js";
import { useAuth, homeRouteForRole } from "../contexts/AuthContext.jsx";
import { thirdwebClient, thirdwebClientId, thirdwebWallets } from "../lib/thirdwebClient.js";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Select, Field } from "../components/ui/Input.jsx";

const ALLOW_DEV_LOGIN = String(import.meta.env.VITE_ALLOW_DEV_LOGIN || "").toLowerCase() === "true";

export default function Login() {
  const { user, status, devLogin, thirdwebLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || null;

  useEffect(() => {
    if (status === "authenticated" && user) {
      navigate(redirectTo || homeRouteForRole(user.role), { replace: true });
    }
  }, [status, user, navigate, redirectTo]);

  return (
    <div className="min-h-screen bg-water-hero flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        <Card className="bg-white/95 backdrop-blur-md p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-brand-600 text-white shadow-lg">
              <Droplet size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">WaterNet</h1>
              <p className="text-sm text-slate-500">Sign in to continue</p>
            </div>
          </div>

          {ALLOW_DEV_LOGIN ? <DevLoginPanel onLogin={devLogin} /> : null}

          {thirdwebClient ? (
            <ThirdwebPanel hidden={ALLOW_DEV_LOGIN} onLogin={thirdwebLogin} />
          ) : !ALLOW_DEV_LOGIN ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No authentication method configured. Set <code className="font-mono text-xs">VITE_THIRDWEB_CLIENT_ID</code>{" "}
              or <code className="font-mono text-xs">VITE_ALLOW_DEV_LOGIN=true</code> in <code className="font-mono text-xs">frontend/.env</code>.
            </p>
          ) : null}
        </Card>

        <p className="text-center text-xs text-white/70 mt-4">
          Smart WaterNet — IoT water quality monitoring & maintenance
        </p>
      </div>
    </div>
  );
}

function DevLoginPanel({ onLogin }) {
  const { data: devUsers, isLoading, error } = useDevUsers();
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showCreds, setShowCreds] = useState(true);

  // Auto-select admin once users load.
  useEffect(() => {
    if (!selected && devUsers?.length) {
      const admin = devUsers.find((u) => u.email === "admin@waternet.local");
      setSelected((admin || devUsers[0]).email);
    }
  }, [devUsers, selected]);

  const grouped = useMemo(() => {
    const groups = { SUPER_ADMIN: [], ADMIN: [], MAINTAINER: [], PUBLIC: [] };
    (devUsers || []).forEach((u) => groups[u.role]?.push(u));
    return groups;
  }, [devUsers]);

  async function onSubmit(e) {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);
    try {
      await onLogin({ email: selected });
    } catch (err) {
      setErrorMsg(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} className="text-brand-600" />
        <span className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Dev mode — sign in as a seeded user
        </span>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="User">
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={isLoading || !devUsers?.length}
          >
            {isLoading ? (
              <option>Loading…</option>
            ) : error ? (
              <option>Backend unreachable — check that the server is running.</option>
            ) : !devUsers?.length ? (
              <option>No seeded users — run `npm run seed` from the repo root.</option>
            ) : (
              Object.entries(grouped).map(([role, list]) =>
                list.length ? (
                  <optgroup key={role} label={role}>
                    {list.map((u) => (
                      <option key={u.email} value={u.email}>
                        {u.display_name ? `${u.display_name} — ` : ""}
                        {u.email}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )
            )}
          </Select>
        </Field>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submitting}
          disabled={!selected || isLoading || !devUsers?.length}
          leftIcon={<LogIn size={18} />}
        >
          Sign in
        </Button>

        {errorMsg ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowCreds((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1.5"
        >
          {showCreds ? <EyeOff size={12} /> : <Eye size={12} />}
          {showCreds ? "Hide credentials note" : "About dev users"}
        </button>
        {showCreds ? (
          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
            Dev login is only available when{" "}
            <code className="font-mono">ALLOW_DEV_LOGIN=true</code> is set in the backend and{" "}
            <code className="font-mono">NODE_ENV !== production</code>. It bypasses Thirdweb so you can run the
            full app offline. Disable both before deploying.
          </p>
        ) : null}
      </form>
    </div>
  );
}

function ThirdwebPanel({ hidden, onLogin }) {
  const account = useActiveAccount();
  const authToken = useAuthToken();
  const walletAddress = account?.address || "";
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit() {
    setErrorMsg("");
    if (!walletAddress || !authToken) {
      setErrorMsg("Connect a wallet first.");
      return;
    }
    setSubmitting(true);
    try {
      await onLogin({ token: authToken, walletAddress, clientId: thirdwebClientId });
    } catch (err) {
      setErrorMsg(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={clsx(hidden && "border-t border-slate-200 pt-5 mt-3")}>
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className="text-slate-500" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Sign in with Thirdweb wallet
        </span>
      </div>
      <div className="flex flex-col gap-3">
        <ConnectButton client={thirdwebClient} wallets={thirdwebWallets} />
        <Button
          variant="secondary"
          size="md"
          onClick={onSubmit}
          disabled={!walletAddress || !authToken || submitting}
          loading={submitting}
        >
          Sign in with connected wallet
        </Button>
        {errorMsg ? (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
