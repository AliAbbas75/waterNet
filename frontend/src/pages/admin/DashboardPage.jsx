import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Droplets,
  Inbox,
  PauseCircle,
  ShieldAlert
} from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Stat } from "../../components/ui/Stat.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Badge, statusVariant, plantStatusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { useOverview } from "../../hooks/useReports.js";
import { useAlerts } from "../../hooks/useAlerts.js";
import { usePlants } from "../../hooks/usePlants.js";
import { useTasks } from "../../hooks/useMaintenance.js";
import { PlantMap } from "../../components/map/PlantMap.jsx";
import { relTime } from "../../lib/format.js";

export default function DashboardPage() {
  const overview = useOverview();
  const alerts = useAlerts({ status: "OPEN" });
  const plants = usePlants();
  const tasks = useTasks({ status: "ASSIGNED" });
  const inProgress = useTasks({ status: "IN_PROGRESS" });

  const o = overview.data;
  const sev = (name) => o?.alertsBySeverity?.find((x) => x._id === name)?.n || 0;
  const critical = sev("CRITICAL");
  const major = sev("MAJOR");
  const mapPlants = (plants.data || []).map((p) => ({ plant: p, overall: "NO_DATA" }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Real-time monitoring of every filter plant and IoT device in the network."
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Stat
          label="Filter plants"
          value={o ? o.plants.total : "—"}
          icon={Building2}
          accent="brand"
          to="/admin/plants"
          trend={
            o
              ? `${o.plants.byStatus.find((x) => x._id === "OPERATIONAL")?.n || 0} operational`
              : "Loading…"
          }
        />
        <Stat
          label="Active devices"
          value={o ? `${o.devices.total - (o.devices.byAvailability.find((x) => x._id === "UNAVAILABLE")?.n || 0)} / ${o.devices.total}` : "—"}
          icon={Cpu}
          accent="safe"
          to="/admin/devices"
          trend={o ? `${o.devices.availablePct}% online` : "Loading…"}
        />
        <Stat
          label="Live alerts"
          value={o ? o.openAlerts : "—"}
          icon={AlertTriangle}
          accent={o && critical > 0 ? "unsafe" : o && o.openAlerts > 0 ? "warn" : "neutral"}
          to="/admin/alerts"
          trend={
            o
              ? critical > 0
                ? `${critical} critical · ${major} major`
                : o.openAlerts > 0
                ? `${major} major`
                : "All systems steady"
              : "Loading…"
          }
        />
        <Stat
          label="Work in hand"
          value={o ? o.work.pending + o.work.inProgress : "—"}
          icon={ClipboardList}
          accent={o && o.work.unrouted > 0 ? "warn" : "neutral"}
          to="/admin/maintenance"
          trend={
            o ? `${o.work.pending} pending · ${o.work.inProgress} in progress` : "Loading…"
          }
        />
      </section>

      {/* The three states that need a person to act rather than wait. Shown
          only when non-zero: a row of permanent zeroes trains people to skip it. */}
      {o && (o.work.unrouted > 0 || o.work.blocked > 0 || o.plants.advisories > 0) ? (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {o.plants.advisories > 0 ? (
            <AttentionTile
              to="/admin/plants"
              tone="unsafe"
              icon={ShieldAlert}
              value={o.plants.advisories}
              label={o.plants.advisories === 1 ? "plant under advisory" : "plants under advisory"}
              hint="Water unsafe to drink"
            />
          ) : null}
          {o.work.unrouted > 0 ? (
            <AttentionTile
              to="/admin/maintenance"
              tone={o.work.overdueTriage > 0 ? "unsafe" : "warn"}
              icon={Inbox}
              value={o.work.unrouted}
              label={o.work.unrouted === 1 ? "work order unrouted" : "work orders unrouted"}
              hint={
                o.work.overdueTriage > 0
                  ? `${o.work.overdueTriage} past the triage deadline`
                  : "Waiting for an assignee"
              }
            />
          ) : null}
          {o.work.blocked > 0 ? (
            <AttentionTile
              to="/admin/maintenance"
              tone="warn"
              icon={PauseCircle}
              value={o.work.blocked}
              label={o.work.blocked === 1 ? "job held up" : "jobs held up"}
              hint="Started, then stopped"
            />
          ) : null}
        </section>
      ) : null}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-5 pb-3">
            <CardHeader
              title="Plant locations"
              subtitle={plants.data ? `${plants.data.length} plants across the network` : ""}
              action={
                <Link to="/admin/plants" className="text-sm text-brand-700 hover:underline inline-flex items-center gap-1">
                  Manage <ArrowRight size={14} />
                </Link>
              }
            />
          </div>
          {plants.isLoading ? (
            <div className="grid place-items-center h-[360px]">
              <Spinner />
            </div>
          ) : (
            <PlantMap plants={mapPlants} height={360} />
          )}
        </Card>

        <Card padded={false}>
          <div className="p-5 pb-3">
            <CardHeader
              title="Recent open alerts"
              subtitle={alerts.data ? `${alerts.data.length} open` : ""}
              action={
                <Link to="/admin/alerts" className="text-sm text-brand-700 hover:underline inline-flex items-center gap-1">
                  All alerts <ArrowRight size={14} />
                </Link>
              }
            />
          </div>
          <AlertList alerts={alerts.data} loading={alerts.isLoading} />
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
        <Card>
          <CardHeader
            title="Pending maintenance"
            subtitle={tasks.data ? `${tasks.data.length} assigned, awaiting start` : ""}
            action={
              <Link
                to="/admin/maintenance"
                className="text-sm text-brand-700 hover:underline inline-flex items-center gap-1"
              >
                All tasks <ArrowRight size={14} />
              </Link>
            }
          />
          <TaskList tasks={tasks.data} loading={tasks.isLoading} emptyLabel="No pending tasks." />
        </Card>
        <Card>
          <CardHeader
            title="Network health"
            subtitle="Plant operational status"
            action={<Droplets className="text-brand-500" size={18} />}
          />
          <PlantStatusBreakdown plants={plants.data} loading={plants.isLoading} />
        </Card>
      </section>
    </>
  );
}

const SEVERITY_ORDER = { CRITICAL: 0, MAJOR: 1, WARN: 1, MINOR: 2, INFO: 3 };

function AlertList({ alerts, loading }) {
  if (loading) {
    return (
      <div className="px-5 pb-5">
        <Spinner />
      </div>
    );
  }
  if (!alerts?.length) {
    return (
      <div className="px-5 pb-5">
        <EmptyState
          icon={CheckCircle2}
          title="All clear"
          description="No open alerts in the system right now."
        />
      </div>
    );
  }
  const sorted = [...alerts].sort((a, b) => {
    const sd = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    return sd !== 0 ? sd : new Date(b.createdAt) - new Date(a.createdAt);
  });
  return (
    <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
      {sorted.slice(0, 8).map((a) => (
        <li key={a._id} className="px-5 py-3 flex items-start gap-3">
          <div
            className={
              a.severity === "CRITICAL"
                ? "mt-0.5 grid place-items-center h-8 w-8 rounded-lg bg-red-50 text-red-600"
                : (a.severity === "MAJOR" || a.severity === "WARN")
                ? "mt-0.5 grid place-items-center h-8 w-8 rounded-lg bg-amber-50 text-amber-600"
                : "mt-0.5 grid place-items-center h-8 w-8 rounded-lg bg-sky-50 text-sky-600"
            }
          >
            <ShieldAlert size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant(a.severity)} dot>
                {a.severity}
              </Badge>
              <span className="text-xs text-slate-500">{relTime(a.createdAt)}</span>
            </div>
            <p className="text-sm text-slate-800 mt-1 truncate">{a.message}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {a.plantId?.name || a.inventoryItemId?.name || a.deviceId?.deviceId || ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TaskList({ tasks, loading, emptyLabel }) {
  if (loading) return <Spinner />;
  if (!tasks?.length) {
    return <EmptyState icon={CheckCircle2} title={emptyLabel} />;
  }
  return (
    <ul className="space-y-2">
      {tasks.slice(0, 5).map((t) => (
        <li key={t._id}>
          <Link
            to={`/admin/maintenance/${t._id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
              <p className="text-xs text-slate-500 truncate">
                {t.assignedToUserId?.display_name || "Unassigned"} • {t.plantId?.name || "—"}
              </p>
            </div>
            <Badge variant={statusVariant(t.status)} dot>
              {t.status.replace("_", " ")}
            </Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PlantStatusBreakdown({ plants, loading }) {
  if (loading) return <Spinner />;
  if (!plants?.length) return <EmptyState title="No plants registered yet" />;
  const groups = plants.reduce(
    (acc, p) => {
      acc[p.operationalStatus] = (acc[p.operationalStatus] || 0) + 1;
      return acc;
    },
    { OPERATIONAL: 0, MAINTENANCE: 0, CLOSED: 0 }
  );
  const total = plants.length;
  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([status, n]) => {
        const pct = total ? (n / total) * 100 : 0;
        return (
          <div key={status}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Badge variant={plantStatusVariant(status)} dot>
                  {status}
                </Badge>
              </div>
              <span className="text-sm text-slate-600">
                {n} of {total}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={
                  status === "OPERATIONAL"
                    ? "h-full bg-emerald-500"
                    : status === "MAINTENANCE"
                    ? "h-full bg-amber-500"
                    : "h-full bg-red-500"
                }
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A thing somebody has to act on, not a number to watch.
 *
 * Rendered only when non-zero — a row of permanent zeroes is scenery, and
 * scenery is what people stop reading.
 */
function AttentionTile({ to, tone, icon: Icon, value, label, hint }) {
  const tones = {
    unsafe: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100/70",
    warn: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100/70"
  };
  return (
    <Link
      to={to}
      className={
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors " +
        (tones[tone] || tones.warn)
      }
    >
      <Icon size={20} className="shrink-0" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">
          {value} {label}
        </span>
        <span className="block text-xs opacity-80">{hint}</span>
      </span>
      <ArrowRight size={15} className="ml-auto shrink-0 opacity-60" />
    </Link>
  );
}
