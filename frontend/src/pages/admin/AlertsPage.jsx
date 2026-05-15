import { useMemo, useState } from "react";
import { Check, CheckCheck, AlertTriangle, BellRing } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { useAckAlert, useAlerts, useResolveAlert } from "../../hooks/useAlerts.js";
import { relTime } from "../../lib/format.js";

export default function AlertsPage() {
  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("");
  const filters = useMemo(() => ({ status, type }), [status, type]);
  const alerts = useAlerts(filters);
  const ack = useAckAlert();
  const resolve = useResolveAlert();

  const columns = useMemo(
    () => [
      {
        key: "severity",
        header: "Severity",
        render: (a) => (
          <Badge variant={statusVariant(a.severity)} dot>
            {a.severity}
          </Badge>
        )
      },
      {
        key: "type",
        header: "Type",
        render: (a) => <span className="text-sm text-slate-700">{a.type.replace(/_/g, " ")}</span>
      },
      {
        key: "message",
        header: "Message",
        render: (a) => (
          <div className="min-w-0">
            <p className="text-sm text-slate-800 truncate">{a.message}</p>
            <p className="text-xs text-slate-500 truncate">
              {[a.plantId?.name, a.deviceId?.deviceId, a.inventoryItemId?.name].filter(Boolean).join(" • ")}
            </p>
          </div>
        )
      },
      {
        key: "status",
        header: "Status",
        render: (a) => (
          <Badge variant={statusVariant(a.status)} dot>
            {a.status}
          </Badge>
        )
      },
      {
        key: "time",
        header: "Raised",
        render: (a) => <span className="text-sm text-slate-500">{relTime(a.createdAt)}</span>
      },
      {
        key: "actions",
        header: "",
        cellClassName: "text-right",
        render: (a) => (
          <div className="inline-flex gap-1.5">
            {a.status === "OPEN" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => ack.mutate(a._id)}
                loading={ack.isPending && ack.variables === a._id}
                leftIcon={<Check size={14} />}
              >
                Ack
              </Button>
            ) : null}
            {a.status !== "RESOLVED" ? (
              <Button
                size="sm"
                onClick={() => resolve.mutate(a._id)}
                loading={resolve.isPending && resolve.variables === a._id}
                leftIcon={<CheckCheck size={14} />}
              >
                Resolve
              </Button>
            ) : null}
          </div>
        )
      }
    ],
    [ack, resolve]
  );

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Quality, availability, device offline and inventory alerts raised by the system."
        action={<BellRing size={20} className="text-slate-400" />}
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACK">Acknowledged</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="QUALITY_UNSAFE">Quality unsafe</option>
            <option value="DEVICE_OFFLINE">Device offline</option>
            <option value="LOW_INVENTORY">Low inventory</option>
            <option value="AVAILABILITY_CHANGE">Availability change</option>
          </Select>
        </div>
      </Card>

      {alerts.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading alerts…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={alerts.data || []}
          empty={
            <EmptyState
              icon={AlertTriangle}
              title="No alerts"
              description="No alerts match the current filters."
            />
          }
        />
      )}
    </>
  );
}
