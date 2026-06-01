import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Cpu,
  PlayCircle,
  Plus,
  Send,
  Trash2,
  CheckCheck
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Field, Input, Select, Textarea } from "../../components/ui/Input.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import {
  useAddTaskLog,
  useResolveTask,
  useStartTask,
  useTask,
  useTaskLogs
} from "../../hooks/useMaintenance.js";
import { useInventory } from "../../hooks/useInventory.js";
import { fmtDate, relTime } from "../../lib/format.js";

export default function TaskDetailPage() {
  const { id } = useParams();
  const task = useTask(id);
  const logs = useTaskLogs(id);
  const addLog = useAddTaskLog();
  const startTask = useStartTask();
  const [resolveOpen, setResolveOpen] = useState(false);
  const [logNote, setLogNote] = useState("");

  const sortedLogs = useMemo(
    () => (logs.data || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [logs.data]
  );

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
          <Link to="/m">
            <Button variant="secondary" leftIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          </Link>
        }
      />
    );
  }

  const t = task.data;

  async function submitLog(e) {
    e.preventDefault();
    if (!logNote.trim()) return;
    await addLog.mutateAsync({ id, note: logNote.trim() });
    setLogNote("");
  }

  return (
    <>
      <Link to="/m" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft size={14} /> My tasks
      </Link>
      <PageHeader
        title={t.title}
        description={t.description}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(t.status)} dot>
              {t.status.replace("_", " ")}
            </Badge>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <div className="flex flex-col sm:flex-row gap-2">
              {t.status === "ASSIGNED" ? (
                <Button
                  leftIcon={<PlayCircle size={16} />}
                  onClick={() => startTask.mutate(t._id)}
                  loading={startTask.isPending}
                >
                  Start task
                </Button>
              ) : null}
              {t.status === "IN_PROGRESS" ? (
                <Button
                  variant="success"
                  leftIcon={<CheckCheck size={16} />}
                  onClick={() => setResolveOpen(true)}
                >
                  Mark resolved
                </Button>
              ) : null}
              {t.status === "RESOLVED" ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 size={16} />
                  Resolved {fmtDate(t.resolvedAt, "PP HH:mm")}
                </div>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Activity" subtitle={`${sortedLogs.length} log entries`} />
            {logs.isLoading ? (
              <Spinner />
            ) : !sortedLogs.length ? (
              <EmptyState title="No log entries yet" />
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
                  placeholder="What did you do? What did you find?"
                />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" leftIcon={<Send size={14} />} loading={addLog.isPending} disabled={!logNote.trim()}>
                  Add note
                </Button>
              </div>
            </form>
          </Card>

          {t.materials?.length ? (
            <Card>
              <CardHeader title="Materials logged at resolution" />
              <ul className="space-y-1.5">
                {t.materials.map((m, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-800">{m.name}</span>
                    <span className="text-slate-500">× {m.quantity}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader title="Where" />
            {t.plantId ? (
              <div className="flex items-center gap-2 text-sm text-slate-800 mb-1.5">
                <Building2 size={16} className="text-slate-500" />
                {t.plantId.name}
              </div>
            ) : null}
            {t.deviceId ? (
              <div className="flex items-center gap-2 text-sm text-slate-800">
                <Cpu size={16} className="text-slate-500" />
                {t.deviceId.deviceId}
              </div>
            ) : null}
            {!t.plantId && !t.deviceId ? <p className="text-sm text-slate-500">No plant or device linked.</p> : null}
          </Card>

          <Card>
            <CardHeader title="Details" />
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Assigned by</dt>
                <dd className="text-slate-800">{t.assignedByUserId?.display_name || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Assigned</dt>
                <dd className="text-slate-800">{fmtDate(t.assignedAt, "PP HH:mm")}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Last updated</dt>
                <dd className="text-slate-800">{relTime(t.updatedAt)}</dd>
              </div>
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
        </div>
      </div>

      <ResolveModal taskId={t._id} open={resolveOpen} onClose={() => setResolveOpen(false)} />
    </>
  );
}

function ResolveModal({ taskId, open, onClose }) {
  const resolve = useResolveTask();
  const inventory = useInventory();
  const [summary, setSummary] = useState("");
  const [materials, setMaterials] = useState([]); // [{itemId, name, quantity}]
  const [error, setError] = useState("");
  const [picker, setPicker] = useState({ itemId: "", quantity: 1 });

  useMemo(() => {
    if (open) {
      setSummary("");
      setMaterials([]);
      setError("");
      setPicker({ itemId: "", quantity: 1 });
    }
  }, [open]);

  function addMaterial() {
    const item = (inventory.data || []).find((i) => i._id === picker.itemId);
    if (!item || picker.quantity < 1) return;
    setMaterials((m) => [
      ...m.filter((x) => x.itemId !== item._id),
      { itemId: item._id, name: item.name, quantity: Number(picker.quantity) }
    ]);
    setPicker({ itemId: "", quantity: 1 });
  }

  async function submit() {
    setError("");
    try {
      await resolve.mutateAsync({ id: taskId, resolutionSummary: summary, materials });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to resolve.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Resolve task"
      subtitle="Materials used will be deducted from inventory atomically."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={resolve.isPending}>
            Cancel
          </Button>
          <Button variant="success" onClick={submit} loading={resolve.isPending} leftIcon={<CheckCheck size={16} />}>
            Mark resolved
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Resolution summary">
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What was done? Cause, fix, observations…"
            rows={3}
          />
        </Field>

        <div>
          <div className="flex items-end gap-2">
            <Field label="Add material from inventory">
              <Select
                value={picker.itemId}
                onChange={(e) => setPicker({ ...picker, itemId: e.target.value })}
              >
                <option value="">Select an item…</option>
                {(inventory.data || []).map((i) => (
                  <option key={i._id} value={i._id} disabled={i.quantity === 0}>
                    {i.name} ({i.quantity} {i.unit} on hand)
                  </option>
                ))}
              </Select>
            </Field>
            <div className="w-20">
              <Field label="Qty">
                <Input
                  type="number"
                  min={1}
                  value={picker.quantity}
                  onChange={(e) => setPicker({ ...picker, quantity: e.target.value })}
                />
              </Field>
            </div>
            <Button leftIcon={<Plus size={14} />} onClick={addMaterial} disabled={!picker.itemId}>
              Add
            </Button>
          </div>

          {materials.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {materials.map((m) => (
                <li
                  key={m.itemId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <span className="text-slate-800">{m.name}</span>
                  <span className="text-slate-500">× {m.quantity}</span>
                  <button
                    onClick={() => setMaterials((arr) => arr.filter((x) => x.itemId !== m.itemId))}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
