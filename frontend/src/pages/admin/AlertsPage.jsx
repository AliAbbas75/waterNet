import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  AlertTriangle,
  BellRing,
  ClipboardList,
  History,
  UserPlus,
  XCircle,
  ArrowRight
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Field, Select, Textarea } from "../../components/ui/Input.jsx";
import { useAlerts, useDispatchAlert, useResolveAlert } from "../../hooks/useAlerts.js";
import { useAuditTrail } from "../../hooks/useAudit.js";
import { useUsers } from "../../hooks/useUsers.js";
import { relTime } from "../../lib/format.js";

// The monitored condition stopped on its own, but a person still has to
// record what was done before the alert can close.
// ACK is set by assigning the alert, never by a button that only marked it as
// seen — so it is labelled by what is actually true of it: somebody has it.
const STATUS_LABEL = {
  OPEN: "Open",
  ACK: "Being handled",
  CLEARED_PENDING_REVIEW: "Awaiting review",
  RESOLVED: "Resolved"
};

// A work order's state in the words an operator uses, not the enum.
const TICKET_STATUS = {
  TRIAGE: { label: "Needs routing", variant: "warn" },
  ASSIGNED: { label: "Assigned", variant: "info" },
  IN_PROGRESS: { label: "In progress", variant: "info" },
  BLOCKED: { label: "Blocked", variant: "unsafe" },
  RESOLVED: { label: "Done", variant: "safe" },
  CANCELLED: { label: "Cancelled", variant: "muted" }
};

const personName = (u) => (u ? u.display_name || u.email : null);

// Whose work this is, per the alert policy — used to put the right people at
// the top of the assignee list.
const OWNER_GROUP_LABEL = {
  MAINTAINER: "Maintainers — field work",
  MANAGER: "Managers — stock and procurement",
  ADMIN: "Admins"
};

export default function AlertsPage() {
  const [status, setStatus] = useState("OPEN");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const filters = useMemo(() => ({ status, type, severity }), [status, type, severity]);
  const alerts = useAlerts(filters);
  const dispatch = useDispatchAlert();
  const resolve = useResolveAlert();

  const [dispatching, setDispatching] = useState(null); // alert being assigned
  const [closing, setClosing] = useState(null); // alert being closed by hand
  const [trailFor, setTrailFor] = useState(null); // alert whose history is open
  const [outcome, setOutcome] = useState(null); // what the last action produced

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
        key: "message",
        header: "Alert",
        render: (a) => (
          <div className="min-w-0">
            <p className="text-sm text-slate-800 truncate">{a.message}</p>
            <p className="text-xs text-slate-500 truncate">
              {[
                a.type.replace(/_/g, " ").toLowerCase(),
                a.plantId?.name,
                a.deviceId?.deviceId,
                a.inventoryItemId?.name
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
        )
      },
      {
        key: "ticket",
        header: "Work order",
        mobileLabel: "Work order",
        render: (a) => <TicketCell alert={a} />
      },
      {
        key: "status",
        header: "Status",
        render: (a) => (
          <Badge
            variant={a.status === "CLEARED_PENDING_REVIEW" ? "warn" : statusVariant(a.status)}
            dot
          >
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
        render: (a) => {
          const ticket = a.ticketId;
          const assigned = !!ticket?.assignedToUserId;
          if (a.status === "RESOLVED") {
            return (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrailFor(a)}
                leftIcon={<History size={14} />}
              >
                History
              </Button>
            );
          }
          return (
            <div className="inline-flex gap-1.5">
              <Button
                size="sm"
                onClick={() => setDispatching(a)}
                leftIcon={<UserPlus size={14} />}
                title="Hand this to the person who will deal with it"
              >
                {assigned ? "Reassign" : "Assign"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTrailFor(a)}
                leftIcon={<History size={14} />}
                title="Show this alert's full history"
              >
                History
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClosing(a)}
                leftIcon={<XCircle size={14} />}
                title="Close without sending anyone — needs a reason"
              >
                Close
              </Button>
            </div>
          );
        }
      }
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Every alert here is answered by giving it to a person. Assigning opens the work order and sends it out; the alert closes when that work is done."
        action={<BellRing size={20} className="text-slate-400" />}
      />

      {outcome ? <OutcomeBanner outcome={outcome} onDismiss={() => setOutcome(null)} /> : null}

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACK">Being handled</option>
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

      <DispatchModal
        alert={dispatching}
        onClose={() => setDispatching(null)}
        loading={dispatch.isPending}
        onConfirm={async ({ assignedToUserId, note }) => {
          const res = await dispatch.mutateAsync({
            id: dispatching._id,
            assignedToUserId,
            note
          });
          setOutcome({ kind: "dispatch", ticketId: res.ticketId, assignedTo: res.assignedTo });
          setDispatching(null);
        }}
      />
      <CloseModal
        alert={closing}
        onClose={() => setClosing(null)}
        loading={resolve.isPending}
        onConfirm={async (note) => {
          const res = await resolve.mutateAsync({ id: closing._id, note });
          setOutcome({ kind: "close", cancelledTicketId: res.cancelledTicketId });
          setClosing(null);
        }}
      />
      <AuditTrailModal alert={trailFor} onClose={() => setTrailFor(null)} />
    </>
  );
}

/**
 * The answer to "where did this go". Every row says whether work exists for it,
 * what state that work is in, and who is holding it.
 */
function TicketCell({ alert }) {
  const ticket = alert.ticketId;
  if (!ticket) {
    return (
      <span className="text-sm text-slate-400">
        {alert.status === "OPEN" ? "none yet" : "none"}
      </span>
    );
  }
  const meta = TICKET_STATUS[ticket.status] || { label: ticket.status, variant: "muted" };
  const assignee = personName(ticket.assignedToUserId);

  return (
    <Link
      to={`/admin/maintenance/${ticket._id}`}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex flex-col gap-0.5 group"
    >
      <span className="inline-flex items-center gap-1.5">
        <ClipboardList size={14} className="text-slate-400" />
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </span>
      <span className="text-xs text-slate-500 group-hover:text-brand-700 group-hover:underline">
        {assignee || "waiting for an assignee"}
      </span>
    </Link>
  );
}

/** Says plainly what the click just did, since none of it happens on this page. */
function OutcomeBanner({ outcome, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 12000);
    return () => clearTimeout(t);
  }, [outcome, onDismiss]);

  let text;
  if (outcome.kind === "dispatch") {
    text = `Assigned to ${outcome.assignedTo}. The alert stays open until the work order is resolved.`;
  } else {
    text = outcome.cancelledTicketId
      ? "Alert closed and its open work order cancelled. The reason is on both records."
      : "Alert closed. The reason is on the record.";
  }

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-100">
      <Check size={16} className="mt-0.5 shrink-0 text-brand-600" />
      <p className="flex-1 text-sm text-brand-900">{text}</p>
      {outcome.ticketId ? (
        <Link
          to={`/admin/maintenance/${outcome.ticketId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline shrink-0"
        >
          Open work order <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * The primary way an alert is answered. An alert is not something you dismiss,
 * it is something you give to somebody — so this asks who, and hands them the
 * instruction along with it.
 */
function DispatchModal({ alert, onClose, onConfirm, loading }) {
  const users = useUsers();
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setAssignedToUserId(
      alert?.ticketId?.assignedToUserId?._id ||
        alert?.plantId?.coveringMaintainerId?._id ||
        ""
    );
    setNote("");
    setError("");
  }, [alert]);

  const ticket = alert?.ticketId;
  const ownerRole = ticket?.ownerRole || "MAINTAINER";
  // Whoever covers this plant is the person who can be there soonest, so they
  // are the default rather than an alphabetical accident.
  const cover = alert?.plantId?.coveringMaintainerId || null;

  // The role the policy says owns this work is listed first, so the obvious
  // choice is the one under the cursor.
  const candidates = useMemo(() => {
    const all = (users.data || []).filter(
      (u) => ["MAINTAINER", "MANAGER", "ADMIN"].includes(u.role) && u.active !== false
    );
    const coverId = cover?._id ? String(cover._id) : null;
    const covering = all.filter((u) => String(u._id) === coverId);
    const rest = all.filter((u) => String(u._id) !== coverId);
    return {
      covering,
      preferred: rest.filter((u) => u.role === ownerRole),
      others: rest.filter((u) => u.role !== ownerRole)
    };
  }, [users.data, ownerRole, cover]);

  // Sending somebody outside their patch is allowed — coverage says who is
  // responsible, not who is permitted — but it should be a visible choice.
  const offPatch =
    cover?._id && assignedToUserId && String(assignedToUserId) !== String(cover._id);

  if (!alert) return null;

  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title={ticket?.assignedToUserId ? "Reassign this alert" : "Assign this alert"}
      subtitle={alert.message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            loading={loading}
            leftIcon={<UserPlus size={14} />}
            onClick={() => {
              if (!assignedToUserId) {
                setError("Choose who this is going to.");
                return;
              }
              onConfirm({ assignedToUserId, note: note.trim() || undefined });
            }}
          >
            {ticket?.assignedToUserId ? "Reassign" : "Assign"}
          </Button>
        </>
      }
    >
      <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
        {ticket
          ? "This routes the existing work order."
          : "This opens a work order for the alert and routes it."}{" "}
        The alert stays open until that work order is resolved — that is the only
        point at which anyone can say the problem went away.
      </div>

      <Field label="Assign to" required>
        <Select
          value={assignedToUserId}
          onChange={(e) => setAssignedToUserId(e.target.value)}
          disabled={users.isLoading}
        >
          <option value="">{users.isLoading ? "Loading people…" : "Choose a person…"}</option>
          {candidates.covering.length ? (
            <optgroup label={`Covers ${alert.plantId?.name || "this plant"}`}>
              {candidates.covering.map((u) => (
                <option key={u._id} value={u._id}>
                  {personName(u)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {candidates.preferred.length ? (
            <optgroup label={OWNER_GROUP_LABEL[ownerRole] || "Suggested"}>
              {candidates.preferred.map((u) => (
                <option key={u._id} value={u._id}>
                  {personName(u)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {candidates.others.length ? (
            <optgroup label="Others">
              {candidates.others.map((u) => (
                <option key={u._id} value={u._id}>
                  {personName(u)} ({u.role})
                </option>
              ))}
            </optgroup>
          ) : null}
        </Select>
      </Field>

      <Field label="Instructions" hint="Optional — goes on the work order for them to read.">
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. check the power supply at the cabinet before replacing the board"
        />
      </Field>
      {offPatch ? (
        <p className="mt-2 text-xs text-amber-700">
          {personName(cover)} covers {alert.plantId?.name || "this plant"} and will usually
          get there sooner.
        </p>
      ) : null}
      {!cover && alert.plantId ? (
        <p className="mt-2 text-xs text-slate-500">
          No one covers {alert.plantId.name} yet — set it on the plant so future alerts
          route themselves.
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </Modal>
  );
}

/**
 * The escape hatch, deliberately not the default: closing an alert because it
 * was a false positive or was already dealt with off-system. It costs a reason,
 * and it cancels any work order rather than stranding a maintainer with a job
 * for an incident that no longer officially exists.
 */
function CloseModal({ alert, onClose, onConfirm, loading }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setNote("");
    setError("");
  }, [alert]);

  if (!alert) return null;

  const liveTicket =
    alert.ticketId && !["RESOLVED", "CANCELLED"].includes(alert.ticketId.status)
      ? alert.ticketId
      : null;

  return (
    <Modal
      open={!!alert}
      onClose={onClose}
      title="Close without dispatch"
      subtitle={alert.message}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => {
              if (!note.trim()) {
                setError("Say why — it goes on the permanent record.");
                return;
              }
              onConfirm(note.trim());
            }}
          >
            Close alert
          </Button>
        </>
      }
    >
      {liveTicket ? (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          This alert has an open work order
          {personName(liveTicket.assignedToUserId)
            ? ` with ${personName(liveTicket.assignedToUserId)}`
            : " waiting to be assigned"}
          . Closing here cancels it. If the work is genuinely needed,{" "}
          <Link to={`/admin/maintenance/${liveTicket._id}`} className="underline font-medium">
            resolve the work order instead
          </Link>{" "}
          — the alert closes by itself when you do.
        </div>
      ) : null}
      <Field label="Why is this being closed without anyone doing the work?" required>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. false positive — probe was unplugged during scheduled calibration"
        />
      </Field>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </Modal>
  );
}

const EVENT_LABEL = {
  "alert.raised": "Raised by the system",
  "alert.acknowledged": "Acknowledged (before assignment replaced it)",
  "alert.dispatched": "Assigned to a person",
  "alert.resolved": "Closed by hand, without dispatch",
  "alert.resolved_by_ticket": "Resolved — the work order was completed",
  "alert.auto_resolved": "Auto-cleared — condition stopped",
  "alert.cleared_pending_review": "Condition cleared — awaiting review",
  "alert.reopened": "Reopened — condition returned"
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
                {l.actorUserId ? personName(l.actorUserId) : "System"} · {relTime(l.createdAt)}
              </p>
              {l.meta?.assignedTo ? (
                <p className="mt-1 text-xs text-slate-600">
                  to {l.meta.assignedTo}
                  {l.meta.role ? ` (${l.meta.role})` : ""}
                </p>
              ) : null}
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
