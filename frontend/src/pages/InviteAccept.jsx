import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Lock, Mail, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth, homeRouteForRole } from "../contexts/AuthContext.jsx";
import { Card, CardHeader } from "../components/ui/Card.jsx";
import { Button } from "../components/ui/Button.jsx";
import { Badge, statusVariant } from "../components/ui/Badge.jsx";
import { PageHeader } from "../components/ui/PageHeader.jsx";
import { Spinner } from "../components/ui/Spinner.jsx";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export default function InviteAccept() {
  const { token } = useParams();
  const { user, status } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const inviteQuery = useQuery({
    enabled: !!token,
    queryKey: ["invite", token],
    queryFn: () => api.get(`/api/auth/invites/${token}`, { auth: false })
  });

  const acceptInvite = useMutation({
    mutationFn: () => api.post("/api/auth/accept-invite", { token }),
    onSuccess: (data) => {
      setAccepted(data);
      setErrorMsg("");
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to accept invite");
    }
  });

  const invite = inviteQuery.data;
  const inviteEmail = normalizeEmail(invite?.email);
  const userEmail = normalizeEmail(user?.email);
  const emailMatches = inviteEmail && userEmail && inviteEmail === userEmail;

  const role = accepted?.role || invite?.role;
  const walletAddress = accepted?.wallet_address || user?.wallet_address || "";

  const showLoginCta = status !== "authenticated";
  const canAccept = !showLoginCta && emailMatches && !accepted;

  const statusCard = useMemo(() => {
    if (inviteQuery.isLoading || status === "loading") {
      return (
        <Card>
          <Spinner label="Loading invite…" />
        </Card>
      );
    }

    if (inviteQuery.isError) {
      return (
        <Card>
          <CardHeader title="Invite not available" />
          <p className="text-sm text-slate-600">{inviteQuery.error?.message || "Invite not found or expired."}</p>
        </Card>
      );
    }

    return null;
  }, [inviteQuery, status]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl">
        <PageHeader
          title="Accept your invite"
          description="Upgrade your WaterNet access using the invitation link."
        />

        {statusCard}

        {invite && !inviteQuery.isError ? (
          <Card>
            <CardHeader
              title="Invitation details"
              subtitle={invite.expiresAt ? `Expires ${new Date(invite.expiresAt).toLocaleString()}` : undefined}
              action={<Badge variant={statusVariant(invite.role)}>{invite.role}</Badge>}
            />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Mail size={16} className="text-slate-400" />
                <span>{invite.email}</span>
              </div>

              {showLoginCta ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  <div className="flex items-center gap-2 font-medium">
                    <Lock size={16} />
                    Sign in to accept this invite.
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    You must sign in with the invited email to upgrade your role.
                  </p>
                  <Button
                    className="mt-3"
                    variant="secondary"
                    onClick={() => navigate("/login", { state: { from: location.pathname } })}
                  >
                    Sign in
                  </Button>
                </div>
              ) : !emailMatches ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
                  You are signed in as <strong>{user?.email}</strong>. Please sign in with the invited email
                  to accept this role.
                </div>
              ) : null}

              {errorMsg ? (
                <p className="text-sm text-red-600">{errorMsg}</p>
              ) : null}

              {!accepted ? (
                <Button
                  onClick={() => acceptInvite.mutate()}
                  loading={acceptInvite.isPending}
                  disabled={!canAccept}
                  leftIcon={<ShieldCheck size={16} />}
                >
                  Accept invite
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {accepted ? (
          <Card className="mt-4">
            <CardHeader
              title="Role upgrade complete"
              subtitle="Your role is now verified on chain."
              action={<CheckCircle2 size={20} className="text-emerald-500" />}
            />
            <div className="space-y-3 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(role)} dot>
                  {role}
                </Badge>
                <span className="text-xs text-slate-500">Assigned role</span>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Wallet</div>
                <div className="font-mono text-xs break-all">{walletAddress || "—"}</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Tx Hash</div>
                  <div className="font-mono text-xs break-all">{accepted.txHash || "—"}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">Block</div>
                  <div className="font-mono text-xs">{accepted.blockNumber ?? "—"}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => navigate(homeRouteForRole(role))}>Go to dashboard</Button>
                <Link to="/proof">
                  <Button variant="secondary">Verify on chain</Button>
                </Link>
              </div>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
