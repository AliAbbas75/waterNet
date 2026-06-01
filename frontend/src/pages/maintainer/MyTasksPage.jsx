import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock, PlayCircle } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Stat } from "../../components/ui/Stat.jsx";
import { useMyTasks, useStartTask } from "../../hooks/useMaintenance.js";
import { useAlerts } from "../../hooks/useAlerts.js";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { fmtDate, relTime } from "../../lib/format.js";

export default function MyTasksPage() {
  const { user } = useAuth();
  const tasks = useMyTasks();
  const alerts = useAlerts({ status: "OPEN" });
  const startTask = useStartTask();

  const groups = useMemo(() => {
    const out = { ASSIGNED: [], IN_PROGRESS: [], RESOLVED: [] };
    (tasks.data || []).forEach((t) => {
      if (out[t.status]) out[t.status].push(t);
    });
    return out;
  }, [tasks.data]);

  const urgent = (alerts.data || []).filter((a) => a.severity === "CRITICAL");

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.display_name || user?.email || "Technician"}`}
        description="Your assigned maintenance work and the most urgent alerts on the network."
      />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat label="Assigned" value={groups.ASSIGNED.length} icon={ClipboardList} accent="brand" />
        <Stat
          label="In progress"
          value={groups.IN_PROGRESS.length}
          icon={Clock}
          accent={groups.IN_PROGRESS.length > 0 ? "warn" : "neutral"}
        />
        <Stat
          label="Resolved"
          value={groups.RESOLVED.length}
          icon={CheckCircle2}
          accent="safe"
        />
        <Stat
          label="Urgent alerts"
          value={urgent.length}
          icon={AlertTriangle}
          accent={urgent.length > 0 ? "unsafe" : "neutral"}
        />
      </section>

      {urgent.length > 0 ? (
        <Card className="mb-4 sm:mb-6 border-red-200 bg-red-50">
          <h2 className="text-sm font-semibold text-red-900 mb-2 inline-flex items-center gap-2">
            <AlertTriangle size={16} /> Urgent alerts
          </h2>
          <ul className="space-y-2">
            {urgent.slice(0, 3).map((a) => (
              <li key={a._id} className="rounded-lg bg-white border border-red-200 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900 truncate">{a.message}</p>
                <p className="text-xs text-slate-500">
                  {a.plantId?.name || a.deviceId?.deviceId || ""} • {relTime(a.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {tasks.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading your tasks…" />
        </div>
      ) : !tasks.data?.length ? (
        <EmptyState
          icon={CheckCircle2}
          title="All clear"
          description="You don't have any tasks assigned right now."
        />
      ) : (
        <>
          <TaskGroup
            title="To do"
            description="Assigned tasks waiting to be started"
            tasks={groups.ASSIGNED}
            startTask={startTask}
            primaryAction
          />
          <TaskGroup
            title="In progress"
            description="Tasks you're actively working on"
            tasks={groups.IN_PROGRESS}
            highlight
          />
          <TaskGroup
            title="Recently resolved"
            description="Last completions"
            tasks={groups.RESOLVED.slice(0, 5)}
            collapsedByDefault
          />
        </>
      )}
    </>
  );
}

function TaskGroup({ title, description, tasks, startTask, primaryAction, highlight }) {
  if (!tasks.length) return null;
  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <div className="space-y-3">
        {tasks.map((t) => (
          <TaskCard
            key={t._id}
            task={t}
            startTask={startTask}
            primaryAction={primaryAction}
            highlight={highlight}
          />
        ))}
      </div>
    </section>
  );
}

function TaskCard({ task, startTask, primaryAction, highlight }) {
  return (
    <div
      className={
        "rounded-xl border bg-white p-4 shadow-card flex flex-col sm:flex-row sm:items-center gap-3 " +
        (highlight ? "border-amber-200 bg-amber-50/50" : "border-slate-200")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2 flex-wrap">
          <Badge variant={statusVariant(task.status)} dot>
            {task.status.replace("_", " ")}
          </Badge>
          <span className="text-xs text-slate-500">Assigned {relTime(task.assignedAt)}</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mt-1.5 truncate">{task.title}</h3>
        <p className="text-sm text-slate-600 line-clamp-2">{task.description}</p>
        <p className="text-xs text-slate-500 mt-1.5">
          {task.plantId?.name || "No plant"}
          {task.deviceId?.deviceId ? ` • ${task.deviceId.deviceId}` : ""}
          {task.resolvedAt ? ` • Resolved ${fmtDate(task.resolvedAt, "PP HH:mm")}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 sm:flex-col sm:items-stretch shrink-0">
        {primaryAction && task.status === "ASSIGNED" ? (
          <Button
            size="sm"
            leftIcon={<PlayCircle size={14} />}
            onClick={() => startTask.mutate(task._id)}
            loading={startTask.isPending && startTask.variables === task._id}
          >
            Start
          </Button>
        ) : null}
        <Link to={`/m/tasks/${task._id}`}>
          <Button variant="secondary" size="sm" className="w-full">
            Details
          </Button>
        </Link>
      </div>
    </div>
  );
}
