import { useMemo, useState } from "react";
import { BarChart3, Building2, TrendingUp, Trophy, Activity } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Select, Field } from "../../components/ui/Input.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { TimeSeriesChart } from "../../components/charts/TimeSeriesChart.jsx";
import {
  useMaintenancePerformance,
  useQualityTrends,
  useUptime
} from "../../hooks/useReports.js";
import { usePlants } from "../../hooks/usePlants.js";
import { useThresholds } from "../../hooks/useThresholds.js";
import { fmtMinutes, fmtNum } from "../../lib/format.js";

const RANGES = [
  { value: 1, label: "Last 24 hours", bucket: "hour" },
  { value: 7, label: "Last 7 days", bucket: "day" },
  { value: 30, label: "Last 30 days", bucket: "day" }
];
const PARAMS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "TDS", label: "TDS", unit: "ppm" }
];

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const [plantId, setPlantId] = useState("");
  const plants = usePlants();
  const range = RANGES.find((r) => r.value === days) || RANGES[1];

  const { from, to } = useMemo(() => {
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const trends = useQualityTrends({ plantId: plantId || undefined, from, to, bucket: range.bucket });
  const perf = useMaintenancePerformance({ from, to });
  const uptime = useUptime({ from, to });
  const thresholds = useThresholds(plantId || undefined);
  const globalThresholds = useThresholds();

  const thresholdMap = useMemo(() => {
    const m = {};
    (globalThresholds.data || []).forEach((t) => {
      if (!t.plantId) m[t.parameter] = t;
    });
    (thresholds.data || []).forEach((t) => {
      if (t.plantId) m[t.parameter] = t;
    });
    return m;
  }, [globalThresholds.data, thresholds.data]);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Historical trends, maintenance performance and device uptime across the network."
        action={<BarChart3 size={20} className="text-slate-400" />}
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Time range">
            <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plant scope (quality only)">
            <Select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
              <option value="">All plants</option>
              {(plants.data || []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-600" />
          Water quality trends
        </h2>
        {trends.isLoading ? (
          <Card>
            <Spinner />
          </Card>
        ) : !trends.data?.points?.length ? (
          <Card>
            <EmptyState title="No readings in this range" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {PARAMS.map((p) => (
              <Card key={p.key}>
                <CardHeader title={p.label} subtitle={`Bucketed by ${range.bucket}`} />
                <TimeSeriesChart
                  data={trends.data.points}
                  dataKey={p.key}
                  label={p.label}
                  unit={p.unit}
                  threshold={thresholdMap[p.key]}
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader
            title="Maintenance performance"
            subtitle={
              perf.data
                ? `${perf.data.totalTasks} tasks • MTTR ${fmtMinutes(perf.data.mttrMinutes)}`
                : "Loading…"
            }
            action={<Trophy size={18} className="text-amber-500" />}
          />
          {perf.isLoading ? (
            <Spinner />
          ) : !perf.data ? (
            <EmptyState title="No data" />
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {Object.entries(perf.data.byStatus).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-slate-200 p-2 text-center">
                    <div className="text-xs text-slate-500">{k.replace("_", " ")}</div>
                    <div className="text-lg font-semibold text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Leaderboard</h3>
              {perf.data.leaderboard.length === 0 ? (
                <p className="text-sm text-slate-500">No resolved tasks in this range.</p>
              ) : (
                <ul className="space-y-2">
                  {perf.data.leaderboard.slice(0, 5).map((u, i) => (
                    <li
                      key={u.user.id || i}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="grid place-items-center h-6 w-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                          {i + 1}
                        </span>
                        <Avatar name={u.user.name} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{u.user.name}</p>
                          <p className="text-xs text-slate-500">
                            avg {fmtMinutes(u.avgMinutes)} / task
                          </p>
                        </div>
                      </div>
                      <Badge variant="brand">{u.resolved} resolved</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Device uptime"
            subtitle={
              uptime.data
                ? `Average ${uptime.data.averageUptimePct}% • expected ${uptime.data.expectedReadings} readings`
                : "Loading…"
            }
            action={<Activity size={18} className="text-emerald-500" />}
          />
          {uptime.isLoading ? (
            <Spinner />
          ) : !uptime.data?.devices?.length ? (
            <EmptyState title="No active devices" />
          ) : (
            <DataTable
              columns={[
                {
                  key: "device",
                  header: "Device",
                  render: (d) => (
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{d.deviceId}</p>
                      <p className="text-xs text-slate-500 inline-flex items-center gap-1">
                        <Building2 size={12} />
                        {d.plant?.name || "Unassigned"}
                      </p>
                    </div>
                  )
                },
                {
                  key: "uptime",
                  header: "Uptime",
                  render: (d) => (
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={
                            d.uptimePct > 80
                              ? "h-full bg-emerald-500"
                              : d.uptimePct > 50
                              ? "h-full bg-amber-500"
                              : "h-full bg-red-500"
                          }
                          style={{ width: `${Math.min(100, d.uptimePct)}%` }}
                        />
                      </div>
                      <span className="text-sm tabular-nums">{fmtNum(d.uptimePct, 1)}%</span>
                    </div>
                  )
                },
                {
                  key: "avail",
                  header: "",
                  cellClassName: "text-right",
                  render: (d) => (
                    <Badge variant={statusVariant(d.availability)} dot>
                      {d.availability === "AVAILABLE" ? "Online" : "Offline"}
                    </Badge>
                  )
                }
              ]}
              rows={uptime.data.devices.slice().sort((a, b) => b.uptimePct - a.uptimePct)}
              empty={<EmptyState title="No devices" />}
              dense
            />
          )}
        </Card>
      </section>
    </>
  );
}
