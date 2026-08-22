import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Droplet, KeyRound, LogIn, Mail } from "lucide-react";
import { useAuth, homeRouteForRole } from "../contexts/AuthContext.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Input, Field } from "../components/ui/Input.jsx";

const blockchainEnabled =
  import.meta.env.VITE_AUTH_BLOCKCHAIN_ENABLED?.toString() === "true";

export default function Login() {
  const { user, status, sendOtp, blockchainLogin } = useAuth();
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

          {blockchainEnabled ? (
            <OtpLoginPanel onSendOtp={sendOtp} onLogin={blockchainLogin} />
          ) : (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              No authentication method configured. Set{" "}
              <code className="font-mono text-xs">VITE_AUTH_BLOCKCHAIN_ENABLED=true</code> in{" "}
              <code className="font-mono text-xs">frontend/.env</code>.
            </p>
          )}

          <p className="text-xs text-slate-500 text-center mt-4">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-brand-600 hover:underline font-medium">
              Register
            </Link>
          </p>
        </Card>

        <p className="text-center text-xs text-white/70 mt-4">
          Smart WaterNet — IoT water quality monitoring & maintenance
        </p>
      </div>
    </div>
  );
}

function OtpLoginPanel({ onSendOtp, onLogin }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function handleSendOtp(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!email) {
      setErrorMsg("Enter your email to receive a code.");
      return;
    }
    setSending(true);
    try {
      await onSendOtp(email);
      setSent(true);
      setSuccessMsg("OTP sent. Check your inbox.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to send OTP");
    } finally {
      setSending(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    if (!email || !code) {
      setErrorMsg("Email and OTP are required.");
      return;
    }
    setSubmitting(true);
    try {
      await onLogin({ email, code });
    } catch (err) {
      setErrorMsg(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={14} className="text-emerald-600" />
        <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
          Blockchain auth — OTP access
        </span>
      </div>

      <form onSubmit={handleSendOtp} className="space-y-3">
        <Field label="Email">
          <Input
            type="email"
            placeholder="you@waternet.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={14} />}
          />
        </Field>

        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          size="md"
          loading={sending}
          disabled={!email}
        >
          Send OTP
        </Button>
      </form>

      {sent ? (
        <form onSubmit={handleLogin} className="space-y-3 mt-4">
          <Field label="One-time code">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={submitting}
            disabled={!code || !email}
            leftIcon={<LogIn size={18} />}
          >
            Sign in
          </Button>
        </form>
      ) : null}

      {successMsg ? (
        <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mt-3">
          {successMsg}
        </p>
      ) : null}

      {errorMsg ? (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
          {errorMsg}
        </p>
      ) : null}
    </div>
  );
}
