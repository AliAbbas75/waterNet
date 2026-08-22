import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy, Droplet, KeyRound, LogIn, Mail, User } from "lucide-react";
import { useAuth, homeRouteForRole } from "../contexts/AuthContext.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Card } from "../components/ui/Card.jsx";
import { Input, Field } from "../components/ui/Input.jsx";

export default function Register() {
  const { register, blockchainLogin } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState("form");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [createdUser, setCreatedUser] = useState(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleRegister(e) {
    e.preventDefault();
    setErrorMsg("");
    if (!email) {
      setErrorMsg("Email is required.");
      return;
    }
    setSubmitting(true);
    try {
      await register(email, displayName || undefined);
      setStep("otp");
    } catch (err) {
      setErrorMsg(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErrorMsg("");
    if (!code) {
      setErrorMsg("Enter the OTP code.");
      return;
    }
    setSubmitting(true);
    try {
      const user = await blockchainLogin({ email, code });
      setCreatedUser(user || null);
      if (user?.wallet_address) {
        sessionStorage.setItem("waternet.register.wallet", user.wallet_address);
        sessionStorage.setItem("waternet.register.role", user.role || "");
        navigate(`/proof?address=${encodeURIComponent(user.wallet_address)}&from=register`, {
          replace: true
        });
        return;
      }
      setStep("proof");
    } catch (err) {
      setErrorMsg(err.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    const wallet = createdUser?.wallet_address || "";
    if (!wallet) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(wallet);
      } else {
        const temp = document.createElement("textarea");
        temp.value = wallet;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setErrorMsg("Unable to copy address. You can still select it manually.");
    }
  }

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
              <p className="text-sm text-slate-500">Create your account</p>
            </div>
          </div>

          {step === "form" ? (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound size={14} className="text-emerald-600" />
                <span className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                  Register — OTP access
                </span>
              </div>
              <form onSubmit={handleRegister} className="space-y-3">
                <Field label="Email" required>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail size={14} />}
                  />
                </Field>
                <Field label="Display name">
                  <Input
                    placeholder="Optional"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    leftIcon={<User size={14} />}
                  />
                </Field>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  loading={submitting}
                  disabled={!email}
                >
                  Create account
                </Button>
              </form>
            </div>
          ) : step === "otp" ? (
            <div className="mb-5">
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
                Account created. An OTP was sent to <strong>{email}</strong>. Enter it below to sign in.
              </p>
              <form onSubmit={handleLogin} className="space-y-3">
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
                  disabled={!code}
                  leftIcon={<LogIn size={18} />}
                >
                  Sign in
                </Button>
              </form>
            </div>
          ) : (
            <div className="mb-5">
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
                <strong>On-chain registration complete.</strong> Save your wallet address for reference.
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Wallet address</div>
                <div className="mt-1 font-mono text-xs break-all text-slate-800">
                  {createdUser?.wallet_address || "—"}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
                    onClick={handleCopy}
                    disabled={!createdUser?.wallet_address}
                  >
                    {copied ? "Copied" : "Copy address"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => navigate(homeRouteForRole(createdUser?.role), { replace: true })}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          )}

          {errorMsg ? (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
              {errorMsg}
            </p>
          ) : null}

          <p className="text-xs text-slate-500 text-center mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-600 hover:underline font-medium">
              Sign in
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
