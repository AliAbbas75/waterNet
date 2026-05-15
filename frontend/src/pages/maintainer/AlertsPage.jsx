import { useMemo, useState } from "react";
import { AlertTriangle, Check, ShieldAlert } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { useAckAlert, useAlerts } from "../../hooks/useAlerts.js";
import { relTime } from "../../lib/format.js";

export default function MaintainerAlertsPage() {
  const [status, setStatus] = useState("OPEN");
  const filters = useMemo(() => ({ status }), [status]);
  const alerts = useAlerts(filters);
  const ack = useAckAlert();

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Open issues across the network. Acknowledge what you'll handle."
        action={<ShieldAlert size={20} className="text-slate-400" />}
      />

      <Card className="mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ACK">Acknowledged</option>
          <option value="RESOLVED">Resolved</option>
        </Select>
      </Card>

      {alerts.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner />
        </div>
      ) : !alerts.data?.length ? (
        <EmptyState icon={AlertTriangle} title="No alerts here right now" />
      ) : (
        <ul className="space-y-2">
          {alerts.data.map((a) => (
            <li
              key={a._id}
              className="rounded-xl border border-slate-200 bg-white shadow-card p-4 flex items-start gap-3"
            >
              <div
                className={
                  a.severity === "CRITICAL"
                    ? "grid place-items-center h-9 w-9 rounded-lg bg-red-50 text-red-600 shrink-0"
                    : a.severity === "WARN"
                    ? "grid place-items-center h-9 w-9 rounded-lg bg-amber-50 text-amber-600 shrink-0"
                    : "grid place-items-center h-9 w-9 rounded-lg bg-sky-50 text-sky-600 shrink-0"
                }
              >
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={statusVariant(a.severity)} dot>
                    {a.severity}
                  </Badge>
                  <Badge variant={statusVariant(a.status)} dot>
                    {a.status}
                  </Badge>
                  <span className="text-xs text-slate-500">{relTime(a.createdAt)}</span>
                </div>
                <p className="text-sm font-medium text-slate-900 mt-1.5 truncate">{a.message}</p>
                <p className="text-xs text-slate-500 truncate">
                  {[a.plantId?.name, a.deviceId?.deviceId].filter(Boolean).join(" • ")}
                </p>
              </div>
              {a.status === "OPEN" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Check size={14} />}
                  onClick={() => ack.mutate(a._id)}
                  loading={ack.isPending && ack.variables === a._id}
                >
                  Acknowledge
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
