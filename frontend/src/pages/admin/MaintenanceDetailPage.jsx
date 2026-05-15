import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Building2, Cpu, MessageCircle } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Field, Select, Textarea } from "../../components/ui/Input.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import {
  useAddTaskLog,
  useAssignTask,
  useTask,
  useTaskLogs
} from "../../hooks/useMaintenance.js";
import { useUsers } from "../../hooks/useUsers.js";
import { fmtDate, relTime } from "../../lib/format.js";

export default function MaintenanceDetailPage() {
  const { id } = useParams();
  const task = useTask(id);
  const logs = useTaskLogs(id);
  const users = useUsers();
  const addLog = useAddTaskLog();
  const assign = useAssignTask();
  const [assignOpen, setAssignOpen] = useState(false);
  const [logNote, setLogNote] = useState("");

  if (task.isLoading) {
    return (
      <div className="py-12 grid place-items-center">
        <Spinner label="Loading task…" />
      </div>
    );
  }
  if (task.error || !task.data) {
    return (
      <EmptyState
        title="Task not found"
        action={
          <Link to="/admin/maintenance">
            <Button variant="secondary" leftIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          </Link>
        }
      />
    );
  }

  const t = task.data;
  const sortedLogs = useMemo(() => (logs.data || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)), [logs.data]);

  async function submitLog(e) {
    e.preventDefault();
    if (!logNote.trim()) return;
    await addLog.mutateAsync({ id, note: logNote.trim() });
    setLogNote("");
  }

  return (
    <>
      <Link
        to="/admin/maintenance"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"
      >
        <ArrowLeft size={14} /> Maintenance
      </Link>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(t.status)} dot>
              {t.status.replace("_", " ")}
            </Badge>
            <Button variant="secondary" leftIcon={<ArrowRightLeft size={14} />} onClick={() => setAssignOpen(true)}>
              Reassign
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader title="Activity" subtitle={`${sortedLogs.length} log entries`} />
            {logs.isLoading ? (
              <Spinner />
            ) : !sortedLogs.length ? (
              <EmptyState icon={MessageCircle} title="No log entries yet" />
            ) : (
              <ol className="relative border-l border-slate-200 ml-3 space-y-4">
                {sortedLogs.map((log) => (
                  <li key={log._id} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-brand-500 ring-4 ring-white" />
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Avatar name={log.authorUserId?.display_name} size={20} />
                      <span className="font-medium text-slate-700">
                        {log.authorUserId?.display_name || "Unknown"}
                      </span>
                      <span>•</span>
                      <span>{fmtDate(log.createdAt, "PP HH:mm")}</span>
                      {log.structuredFields?.type === "SOFT_HANDOFF" ? (
                        <Badge variant="warn" className="ml-1">
                          Soft handoff
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{log.note}</p>
                  </li>
                ))}
              </ol>
            )}
            <form onSubmit={submitLog} className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <Field label="Add a note">
                <Textarea
                  value={logNote}
                  onChange={(e) => setLogNote(e.target.value)}
                  placeholder="Progress update, observations, or handoff context…"
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" loading={addLog.isPending} disabled={!logNote.trim()}>
                  Add log entry
                </Button>
              </div>
            </form>
          </Card>

          {t.materials?.length ? (
            <Card>
              <CardHeader title="Materials used" subtitle="Logged at resolution" />
              <ul className="space-y-1.5">
                {t.materials.map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-800">{m.name}</span>
                    <span className="text-slate-500">{m.quantity}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Assigned to</dt>
                <dd className="text-slate-800 inline-flex items-center gap-2">
                  {t.assignedToUserId ? (
                    <>
                      <Avatar name={t.assignedToUserId.display_name} size={20} />
                      <span>{t.assignedToUserId.display_name}</span>
                    </>
                  ) : (
                    "Unassigned"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Assigned by</dt>
                <dd className="text-slate-800">{t.assignedByUserId?.display_name || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Assigned at</dt>
                <dd className="text-slate-800">{fmtDate(t.assignedAt, "PP HH:mm")}</dd>
              </div>
              {t.resolvedAt ? (
                <>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Resolved at</dt>
                    <dd className="text-slate-800">{fmtDate(t.resolvedAt, "PP HH:mm")}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Resolved by</dt>
                    <dd className="text-slate-800">{t.resolvedByUserId?.display_name || "—"}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {t.resolutionSummary ? (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
                  Resolution
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{t.resolutionSummary}</p>
              </div>
            ) : null}
          </Card>

          {t.plantId ? (
            <Card>
              <CardHeader title="Plant" />
              <Link
                to={`/admin/plants/${t.plantId._id || t.plantId}`}
                className="flex items-center gap-2 text-sm text-brand-700 hover:underline"
              >
                <Building2 size={16} />
                {t.plantId.name || "Plant"}
              </Link>
            </Card>
          ) : null}
          {t.deviceId ? (
            <Card>
              <CardHeader title="Device" />
              <Link
                to={`/admin/devices/${t.deviceId._id || t.deviceId}`}
                className="flex items-center gap-2 text-sm text-brand-700 hover:underline"
              >
                <Cpu size={16} />
                {t.deviceId.deviceId || "Device"}
              </Link>
            </Card>
          ) : null}
        </div>
      </div>

      <ReassignModal
        open={assignOpen}
        task={t}
        logs={sortedLogs}
        users={(users.data || []).filter((u) => ["MAINTAINER", "ADMIN"].includes(u.role))}
        onClose={() => setAssignOpen(false)}
        onConfirm={async ({ assignedToUserId, handoffLogId, handoffNote }) => {
          await assign.mutateAsync({ id, assignedToUserId, handoffLogId, handoffNote });
          setAssignOpen(false);
        }}
        loading={assign.isPending}
      />
    </>
  );
}

function ReassignModal({ open, task, logs, users, onClose, onConfirm, loading }) {
  const inProgress = task?.status === "IN_PROGRESS";
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [handoffLogId, setHandoffLogId] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [error, setError] = useState("");

  // The handoff log must be authored by the current assignee.
  const currentAssigneeId = task?.assignedToUserId?._id || task?.assignedToUserId;
  const eligibleLogs = (logs || []).filter(
    (l) => String(l.authorUserId?._id || l.authorUserId) === String(currentAssigneeId)
  );

  useMemo(() => {
    if (open) {
      setAssignedToUserId("");
      setHandoffLogId("");
      setHandoffNote("");
      setError("");
    }
  }, [open]);

  async function submit() {
    setError("");
    if (!assignedToUserId) {
      setError("Choose a new assignee.");
      return;
    }
    if (inProgress && String(assignedToUserId) !== String(currentAssigneeId) && !handoffLogId) {
      setError("Pick a handoff log entry by the current technician before reassigning.");
      return;
    }
    try {
      await onConfirm({ assignedToUserId, handoffLogId: handoffLogId || undefined, handoffNote });
    } catch (err) {
      setError(err.message || "Reassign failed.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reassign task"
      subtitle={
        inProgress
          ? "Task is in progress — soft handoff with the current technician's log is required."
          : "Pick the new assignee."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={submit} loading={loading}>
            Reassign
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="New assignee" required>
          <Select value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)}>
            <option value="">Select a user…</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.display_name || u.email} ({u.role})
              </option>
            ))}
          </Select>
        </Field>
        {inProgress ? (
          <>
            <Field
              label="Handoff log entry"
              hint="(authored by current technician)"
              required={String(assignedToUserId) !== String(currentAssigneeId)}
            >
              <Select value={handoffLogId} onChange={(e) => setHandoffLogId(e.target.value)}>
                <option value="">Select a log…</option>
                {eligibleLogs.map((l) => (
                  <option key={l._id} value={l._id}>
                    {fmtDate(l.createdAt, "PP HH:mm")} — {l.note.slice(0, 60)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Handoff note (optional)">
              <Textarea value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} rows={2} />
            </Field>
          </>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {inProgress && !eligibleLogs.length ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            The current technician hasn't logged a handoff entry yet. Ask them to add a note describing
            progress and materials used before reassigning.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
