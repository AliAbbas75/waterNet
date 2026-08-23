import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Inbox,
  PauseCircle,
  Plus,
  Search,
  Timer,
  Wrench
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input, Select, Field, Textarea } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import {
  CLOSED_PHASES,
  OPEN_PHASES,
  PHASE_LABEL,
  TaskStatusTag,
  isOpenStatus
} from "../../components/ui/TaskStatus.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { useCreateTask, useTaskBoard } from "../../hooks/useMaintenance.js";
import { usePlants } from "../../hooks/usePlants.js";
import { useDevices } from "../../hooks/useDevices.js";
import { useUsers } from "../../hooks/useUsers.js";
import { relTime } from "../../lib/format.js";

// Which statuses each tab counts. Kept beside the tabs rather than imported, so
// it is plain that the number and the filter are the same definition.
const PHASE_STATUSES = {
  PENDING: ["TRIAGE", "ASSIGNED"],
  IN_PROGRESS: ["IN_PROGRESS", "BLOCKED"],
  COMPLETED: ["RESOLVED"],
  CANCELLED: ["CANCELLED"]
};

// The two groups are composed from the phases above rather than listed again:
// a status can never end up counted by a group but by no tab within it.
PHASE_STATUSES.OPEN = OPEN_PHASES.flatMap((p) => PHASE_STATUSES[p]);
PHASE_STATUSES.CLOSED = CLOSED_PHASES.flatMap((p) => PHASE_STATUSES[p]);

const SORTS = [
  { key: "urgent", label: "Most urgent first" },
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "updated", label: "Recently updated" }
];

const PER_PAGE = 25;

export default function MaintenancePage() {
  // The board reads its opening state from the URL, so a link can point at one
  // plant's closed work and actually land there. Read once into state rather
  // than driving every control from the params, which would make each keystroke
  // a navigation.
  const [params, setParams] = useSearchParams();
  const initial = (key, fallback = "") => params.get(key) ?? fallback;

  // Opens on live work. The board used to default to everything, ordered by
  // severity, so a resolved CRITICAL sat above an untouched MINOR and the first
  // page filled with jobs nobody had to act on. Finished work is still one
  // click away — it is just no longer in front of the work that is not.
  const [phase, setPhase] = useState(() => initial("phase", "OPEN"));
  const [plantId, setPlantId] = useState(() => initial("plantId"));
  const [severity, setSeverity] = useState(() => initial("severity"));
  const [assignee, setAssignee] = useState(() => initial("assignee"));
  const [sort, setSort] = useState(() => initial("sort", "urgent"));
  const [attention, setAttention] = useState(() => initial("attention") === "true");
  const [search, setSearch] = useState(() => initial("search"));
  const [debouncedSearch, setDebouncedSearch] = useState(() => initial("search"));
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();
  const plants = usePlants();
  const users = useUsers();

  // Search hits the database now rather than filtering one page in memory, so
  // it waits for a pause in typing instead of firing on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Any filter change invalidates the page you were on. Page 4 of a filter that
  // now has one page is a blank screen with no explanation.
  useEffect(() => {
    setPage(1);
  }, [phase, plantId, severity, assignee, sort, attention, debouncedSearch]);

  // Mirror the filters back into the URL so the view can be linked and survives
  // a refresh. Replace rather than push: filtering is not navigation, and back
  // should leave the board rather than undo six keystrokes one at a time.
  useEffect(() => {
    const next = {};
    if (phase !== "OPEN") next.phase = phase;
    if (plantId) next.plantId = plantId;
    if (severity) next.severity = severity;
    if (assignee) next.assignee = assignee;
    if (sort !== "urgent") next.sort = sort;
    if (attention) next.attention = "true";
    if (debouncedSearch) next.search = debouncedSearch;
    setParams(next, { replace: true });
    // setParams is deliberately not a dependency: react-router rebuilds it
    // whenever the URL changes, so listing it would have this effect retrigger
    // itself on its own write. A stale copy is safe here because `next` is a
    // complete object rather than an updater — it never reads the old params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plantId, severity, assignee, sort, attention, debouncedSearch]);

  const filters = useMemo(
    () => ({
      phase,
      plantId,
      severity,
      assignedToUserId: assignee,
      search: debouncedSearch,
      attention: attention ? "true" : "",
      sort,
      page,
      limit: PER_PAGE
    }),
    [phase, plantId, severity, assignee, debouncedSearch, attention, sort, page]
  );

  const board = useTaskBoard(filters);
  const rows = board.data?.tasks || [];
  const counts = board.data?.counts || {};
  const total = board.data?.total ?? 0;
  const pages = board.data?.pages ?? 1;

  const countFor = (p) => PHASE_STATUSES[p].reduce((n, st) => n + (counts[st] || 0), 0);
  const allCount = Object.values(counts).reduce((n, v) => n + v, 0);

  const unrouted = counts.TRIAGE || 0;
  const blocked = counts.BLOCKED || 0;

  // Whether anything besides the tab is narrowing the list. An empty Open tab
  // means "all caught up" only when nothing else is filtering it — otherwise it
  // just means this plant, or this assignee, has nothing open.
  const hasNarrowingFilter = Boolean(
    plantId || severity || assignee || debouncedSearch || attention
  );

  const assignableUsers = (users.data || []).filter((u) =>
    ["MAINTAINER", "MANAGER", "ADMIN"].includes(u.role)
  );

  const columns = useMemo(
    () => [
      {
        key: "severity",
        header: "",
        cellClassName: "w-1 p-0",
        render: (t) => <SeverityStripe severity={t.severity} muted={!isOpenStatus(t.status)} />
      },
      {
        key: "title",
        header: "Work order",
        render: (t) => (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-medium text-slate-900">{t.title}</span>
              {t.origin === "SYSTEM" ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-400">
                  auto
                </span>
              ) : null}
              {t.recurrenceCount > 0 ? (
                <Badge variant="warn" className="shrink-0">
                  {t.recurrenceCount + 1}x
                </Badge>
              ) : null}
            </div>
            <div className="truncate text-xs text-slate-500">
              {[t.plantId?.name, t.deviceId?.deviceId].filter(Boolean).join(" • ") ||
                "No plant linked"}
            </div>
          </div>
        )
      },
      {
        key: "severity-label",
        header: "Severity",
        render: (t) => (
          <Badge variant={statusVariant(t.severity)} dot>
            {t.severity}
          </Badge>
        )
      },
      {
        key: "status",
        header: "Status",
        render: (t) => <TaskStatusTag status={t.status} blockedReason={t.blockedReason} />
      },
      {
        key: "assignee",
        header: "Assignee",
        render: (t) =>
          t.assignedToUserId ? (
            <div className="inline-flex items-center gap-2">
              <Avatar name={t.assignedToUserId.display_name} size={24} />
              <span className="truncate text-sm text-slate-700">
                {t.assignedToUserId.display_name}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-700">
              <Inbox size={13} />
              Unrouted
            </span>
          )
      },
      {
        key: "age",
        header: "Age",
        render: (t) => <AgeCell task={t} />
      }
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Work orders"
        description="Every job the network has raised or been given — what it is, who holds it, and how long it has been waiting."
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New task
          </Button>
        }
      />

      {/* The states that need somebody to act rather than wait. They double as a
          filter, because a number you cannot click is just a number. */}
      {unrouted > 0 || blocked > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {unrouted > 0 ? (
            <AttentionChip
              active={attention}
              icon={Inbox}
              onClick={() => setAttention((v) => !v)}
            >
              {unrouted} unrouted
            </AttentionChip>
          ) : null}
          {blocked > 0 ? (
            <AttentionChip
              active={attention}
              icon={PauseCircle}
              onClick={() => setAttention((v) => !v)}
            >
              {blocked} held up
            </AttentionChip>
          ) : null}
          {attention ? (
            <button
              onClick={() => setAttention(false)}
              className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800"
            >
              show everything
            </button>
          ) : null}
        </div>
      ) : null}

      <Card className="mb-4">
        {/* Live work on the left, finished work on the right, with a rule
            between them. The two groups used to be one undifferentiated row, so
            "Completed 20" sat beside "Pending 26" as though they were equally
            worth opening. Categorisation comes before search because most
            people arrive wanting a stage, not a keyword. */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <PhaseTab
            active={phase === "OPEN"}
            count={countFor("OPEN")}
            onClick={() => setPhase("OPEN")}
            tone="open"
          >
            Open
          </PhaseTab>
          {OPEN_PHASES.map((p) => (
            <PhaseTab
              key={p}
              active={phase === p}
              count={countFor(p)}
              onClick={() => setPhase(p)}
              subdued
            >
              {PHASE_LABEL[p]}
            </PhaseTab>
          ))}

          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />

          <PhaseTab
            active={phase === "CLOSED"}
            count={countFor("CLOSED")}
            onClick={() => setPhase("CLOSED")}
            tone="closed"
          >
            Closed
          </PhaseTab>
          {CLOSED_PHASES.map((p) => (
            <PhaseTab
              key={p}
              active={phase === p}
              count={countFor(p)}
              onClick={() => setPhase(p)}
              subdued
            >
              {PHASE_LABEL[p]}
            </PhaseTab>
          ))}
          <PhaseTab active={phase === ""} count={allCount} onClick={() => setPhase("")} subdued>
            Everything
          </PhaseTab>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Input
              placeholder="Search title or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
            />
          </div>
          <Select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
            <option value="">All plants</option>
            {(plants.data || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Any severity</option>
            <option value="CRITICAL">Critical</option>
            <option value="MAJOR">Major</option>
            <option value="MINOR">Minor</option>
            <option value="INFO">Info</option>
          </Select>
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Anyone</option>
            <option value="none">Nobody yet</option>
            {assignableUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.display_name || u.email}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            {board.isLoading
              ? "Loading…"
              : `${total} ${total === 1 ? "work order" : "work orders"}${
                  phase ? ` · ${PHASE_LABEL[phase].toLowerCase()}` : ""
                }`}
          </p>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="w-auto text-xs"
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {board.isLoading && !board.data ? (
        <div className="grid place-items-center py-12">
          <Spinner label="Loading work orders…" />
        </div>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows}
            onRowClick={(t) => navigate(`/admin/maintenance/${t._id}`)}
            // Finished work recedes wherever the two are shown together, so the
            // open rows are still the ones the eye lands on.
            rowClassName={(t) => (isOpenStatus(t.status) ? "" : "bg-slate-50/60 text-slate-400")}
            empty={
              // An empty Open tab is the good outcome, and saying "nothing
              // matches these filters" reads like something went wrong.
              phase === "OPEN" && !hasNarrowingFilter ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nothing open"
                  description="Every work order has been closed out. Finished work is under Closed."
                />
              ) : (
                <EmptyState
                  icon={Wrench}
                  title="Nothing here"
                  description="No work orders match these filters."
                />
              )
            }
          />

          {pages > 1 ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Page {board.data?.page} of {pages}
              </p>
              <div className="inline-flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft size={14} />}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  Next
                  <ChevronRight size={14} className="ml-1 inline" />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <CreateTaskModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

/**
 * Severity as a shape, not only a word — scannable down the left edge.
 *
 * Finished work keeps its colour but loses its saturation. A closed CRITICAL is
 * still a fact worth seeing in the mixed view, but a full-strength red bar next
 * to a live one makes the eye stop at the wrong row.
 */
function SeverityStripe({ severity, muted = false }) {
  const tones = {
    CRITICAL: "bg-red-500",
    MAJOR: "bg-amber-500",
    MINOR: "bg-sky-400",
    INFO: "bg-slate-300"
  };
  return (
    <span
      aria-hidden="true"
      className={
        "block h-full min-h-[2.5rem] w-1 rounded-r " +
        (tones[severity] || tones.INFO) +
        (muted ? " opacity-30" : "")
      }
    />
  );
}

/**
 * A tab, at one of two weights.
 *
 * The group tabs (Open, Closed) are the decision most people are making, so
 * they carry the weight; the phases inside each group are a refinement and read
 * quieter. Selected-Closed is slate rather than brand: finished work should
 * never wear the same colour as work that still needs doing, or the board looks
 * equally urgent whichever tab you are on.
 */
function PhaseTab({ active, count, onClick, children, tone = "open", subdued = false }) {
  const activeTone = tone === "closed" ? "bg-slate-600 text-white ring-slate-600" : "bg-brand-600 text-white ring-brand-600";
  const idleTone = subdued
    ? "bg-transparent text-slate-500 ring-transparent hover:bg-slate-100 hover:text-slate-700"
    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50";

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset transition-colors " +
        (subdued ? "px-2.5 py-1 text-xs font-medium " : "px-3 py-1.5 text-sm font-semibold ") +
        (active ? activeTone : idleTone)
      }
    >
      {children}
      <span
        className={
          "tabular-nums " +
          (active ? "text-white/70" : subdued ? "text-slate-400" : "text-slate-400")
        }
      >
        {count}
      </span>
    </button>
  );
}

function AttentionChip({ active, icon: Icon, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors " +
        (active
          ? "bg-amber-500 text-white ring-amber-500"
          : "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100")
      }
    >
      <Icon size={14} />
      {children}
    </button>
  );
}

/**
 * How long this has been waiting, and whether that is now a problem.
 *
 * An unrouted ticket past its triage deadline is itself an incident, so it says
 * so here rather than looking like every other row.
 */
function AgeCell({ task }) {
  const overdue =
    task.status === "TRIAGE" && task.triageDueAt && new Date(task.triageDueAt) < new Date();

  // How long a finished job has been sitting there is not the question anyone
  // is asking about it — when it was closed is. Live work still reports its age,
  // because that is exactly what makes it worth chasing.
  if (!isOpenStatus(task.status)) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span className="text-sm text-slate-400">
          {task.resolvedAt ? `closed ${relTime(task.resolvedAt)}` : relTime(task.createdAt)}
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="text-sm text-slate-500">{relTime(task.createdAt)}</span>
      {overdue ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
          <Timer size={11} />
          triage overdue
        </span>
      ) : task.status === "BLOCKED" ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
          <AlertTriangle size={11} />
          held up
        </span>
      ) : null}
    </span>
  );
}

function CreateTaskModal({ open, onClose }) {
  const create = useCreateTask();
  const plants = usePlants();
  const devices = useDevices();
  const users = useUsers();
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToUserId: "",
    plantId: "",
    deviceId: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ title: "", description: "", assignedToUserId: "", plantId: "", deviceId: "" });
      setError("");
    }
  }, [open]);

  const assignableUsers = (users.data || []).filter((u) =>
    ["MAINTAINER", "MANAGER", "ADMIN"].includes(u.role)
  );
  const devicesForPlant = (devices.data || []).filter(
    (d) => !form.plantId || (d.plantId && (d.plantId._id || d.plantId) === form.plantId)
  );

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim() || !form.description.trim() || !form.assignedToUserId) {
      setError("Title, description and assignee are required.");
      return;
    }
    try {
      await create.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        assignedToUserId: form.assignedToUserId,
        plantId: form.plantId || undefined,
        deviceId: form.deviceId || undefined
      });
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create task.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New maintenance task"
      subtitle="Assign work to a maintainer."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={create.isPending}>
            Create task
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Title" required>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Replace carbon filter cartridge"
          />
        </Field>
        <Field label="Description" required>
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What needs to happen?"
            rows={3}
          />
        </Field>
        <Field label="Assignee" required>
          <Select
            value={form.assignedToUserId}
            onChange={(e) => setForm({ ...form, assignedToUserId: e.target.value })}
          >
            <option value="">Select an assignee…</option>
            {assignableUsers.map((u) => (
              <option key={u._id} value={u._id}>
                {u.display_name || u.email} ({u.role})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plant">
            <Select
              value={form.plantId}
              onChange={(e) => setForm({ ...form, plantId: e.target.value, deviceId: "" })}
            >
              <option value="">— Any —</option>
              {(plants.data || []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Device">
            <Select
              value={form.deviceId}
              onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
            >
              <option value="">— Any —</option>
              {devicesForPlant.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.deviceId}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
