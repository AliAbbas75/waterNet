import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCheck, AlertTriangle, BellRing, ClipboardList, History } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Field, Textarea } from "../../components/ui/Input.jsx";
import { useAckAlert, useAlerts, useResolveAlert } from "../../hooks/useAlerts.js";
import { useAuditTrail } from "../../hooks/useAudit.js";
import { relTime } from "../../lib/format.js";

// The monitored condition stopped on its own, but a person still has to
// record what was done before the alert can close.
const STATUS_LABEL = {
  OPEN: "Open",
  ACK: "Acknowledged",
  CLEARED_PENDING_REVIEW: "Awaiting review",
  RESOLVED: "Resolved"
};

export default function AlertsPage() {
  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const filters = useMemo(() => ({ status, type, severity }), [status, type, severity]);
  const alerts = useAlerts(filters);
  const ack = useAckAlert();
  const resolve = useResolveAlert();
  const [resolving, setResolving] = useState(null); // alert awaiting a closing note
  const [trailFor, setTrailFor] = useState(null);   // alert whose history is open

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
        key: "ticket",
        header: "Work order",
        mobileLabel: "Work order",
        render: (a) =>
          a.ticketId ? (
            <Link
              to={`/admin/maintenance/${a.ticketId}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-sm text-brand-700 hover:underline"
            >
              <ClipboardList size={14} />
              Open ticket
            </Link>
          ) : (
            <span className="text-sm text-slate-400">no ticket</span>
          )
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
          <Badge variant={a.status === "CLEARED_PENDING_REVIEW" ? "warn" : statusVariant(a.status)} dot>
            {STATUS_LABEL[a.status] || a.status}
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
              <Button size="sm" onClick={() => setResolving(a)} leftIcon={<CheckCheck size={14} />}>
                Resolve
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTrailFor(a)}
              leftIcon={<History size={14} />}
              title="Show this alert's full history"
            >
              History
            </Button>
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
            <option value="CLEARED_PENDING_REVIEW">Awaiting review</option>
            <option value="RESOLVED">Resolved</option>
          </Select>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
            <option value="INFO">Info</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            <option value="QUALITY_UNSAFE">Quality unsafe</option>
            <option value="DEVICE_OFFLINE">Device offline</option>
            <option value="DEVICE_FLAPPING">Device unstable</option>
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
      <ResolveModal
        alert={resolving}
        onClose={() => setResolving(null)}
        loading={resolve.isPending}
        onConfirm={async (note) => {
          await resolve.mutateAsync({ id: resolving._id, note });
          setResolving(null);
        }}
      />
      <AuditTrailModal alert={trailFor} onClose={() => setTrailFor(null)} />
    </>
  );
}

/**
 * Closing an alert now costs a sentence. One-click resolve is exactly what let
 * alerts vanish with no record of what was actually done about them.
 */
function ResolveModal({ alert, onClose, onConfirm, loading }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useMemo(() => {
    setNote("");
    setError("");
  }, [alert]);

  if (!alert) return null;

  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title="Resolve alert"
      subtitle={alert.message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            onClick={() => {
              if (!note.trim()) {
                setError("Say what was done - it goes on the permanent record.");
                return;
              }
              onConfirm(note.trim());
            }}
          >
            Resolve
          </Button>
        </>
      }
    >
      {alert.ticketId ? (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          This alert has a work order. Normally the ticket is closed and the alert
          follows - resolving here bypasses that.{" "}
          <Link to={`/admin/maintenance/${alert.ticketId}`} className="underline font-medium">
            Open the ticket instead
          </Link>
        </div>
      ) : null}
      <Field label="What was done?" required>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. replaced the turbidity probe, readings back within range"
        />
      </Field>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </Modal>
  );
}

const EVENT_LABEL = {
  "alert.raised": "Raised by the system",
  "alert.acknowledged": "Acknowledged",
  "alert.resolved": "Resolved",
  "alert.auto_resolved": "Auto-cleared - condition stopped",
  "alert.cleared_pending_review": "Condition cleared - awaiting review",
  "alert.reopened": "Reopened - condition returned",
  "ticket.opened": "Work order opened"
};

/** The answer to "where did this go after I clicked the button". */
function AuditTrailModal({ alert, onClose }) {
  const trail = useAuditTrail("ALERT", alert?._id);

  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title="Alert history"
      subtitle={alert?.message}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {trail.isLoading ? (
        <Spinner />
      ) : !trail.data?.length ? (
        <EmptyState
          icon={History}
          title="No recorded history"
          description="This alert predates audit logging, which began with the alert revamp."
        />
      ) : (
        <ol className="relative border-l border-slate-200 pl-4 space-y-4">
          {[...trail.data].reverse().map((l) => (
            <li key={l._id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand-500" />
              <p className="text-sm font-medium text-slate-900">
                {EVENT_LABEL[l.event] || l.event}
              </p>
              <p className="text-xs text-slate-500">
                {l.actorUserId ? l.actorUserId.display_name || l.actorUserId.email : "System"} ·{" "}
                {relTime(l.createdAt)}
              </p>
              {l.meta?.note ? (
                <p className="mt-1 text-sm text-slate-700 bg-slate-50 rounded px-2 py-1">
                  {l.meta.note}
                </p>
              ) : null}
              {l.meta?.reason ? (
                <p className="mt-1 text-xs text-slate-500">{l.meta.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
