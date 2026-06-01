import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Copy, ShieldCheck } from "lucide-react";
import { api } from "../lib/api.js";
import { Button } from "../components/ui/Button.jsx";
import { Card, CardHeader } from "../components/ui/Card.jsx";
import { Input, Field } from "../components/ui/Input.jsx";
import { Badge, statusVariant } from "../components/ui/Badge.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { homeRouteForRole, useAuth } from "../contexts/AuthContext.jsx";

export default function ProofPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoChecked, setAutoChecked] = useState(false);

  const params = new URLSearchParams(location.search);
  const presetAddress = params.get("address") || "";
  const fromRegister = params.get("from") === "register";

  const verifyAddress = useCallback(async (value) => {
    const nextAddress = String(value || "").trim();
    setError("");
    setResult(null);
    if (!nextAddress) {
      setError("Enter a wallet address.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.get("/api/public/chain-proof", {
        auth: false,
        params: { address: nextAddress }
      });
      setResult(data);
    } catch (err) {
      setError(err.message || "Unable to verify address.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoChecked) return;
    const stored = fromRegister ? sessionStorage.getItem("waternet.register.wallet") || "" : "";
    const nextAddress = presetAddress || stored;
    if (!nextAddress) return;
    setAddress(nextAddress);
    setAutoChecked(true);
    verifyAddress(nextAddress);
  }, [autoChecked, presetAddress, fromRegister, verifyAddress]);

  async function onSubmit(e) {
    e.preventDefault();
    await verifyAddress(address);
  }

  async function handleCopy() {
    const wallet = result?.address || address;
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
      setError("Unable to copy address. You can still select it manually.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        <PageHeader
          title="On-chain role proof"
          description="Verify a WaterNet wallet address against the on-chain registry."
        />

        {fromRegister ? (
          <Card className="mb-4">
            <CardHeader
              title="Registration verified"
              subtitle="Your on-chain registration is complete. Save this wallet address."
            />
            <div className="space-y-3 text-sm text-slate-700">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Wallet</div>
                <div className="font-mono text-xs break-all">{address || result?.address || "—"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
                  onClick={handleCopy}
                  disabled={!address && !result?.address}
                >
                  {copied ? "Copied" : "Copy address"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    sessionStorage.removeItem("waternet.register.wallet");
                    sessionStorage.removeItem("waternet.register.role");
                    navigate(homeRouteForRole(user?.role), { replace: true });
                  }}
                >
                  Continue
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="mb-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Wallet address" required>
              <Input
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </Field>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" loading={loading} leftIcon={<ShieldCheck size={16} />}>
              Verify on chain
            </Button>
          </form>
        </Card>

        {result ? (
          <Card>
            <CardHeader
              title="Chain verification"
              subtitle={result.contractAddress ? `Contract ${result.contractAddress}` : ""}
            />
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(result.role)} dot>
                  {result.role}
                </Badge>
                <Badge variant={result.active ? "safe" : "unsafe"} dot>
                  {result.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Wallet</div>
                <div className="font-mono text-xs break-all">{result.address}</div>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
