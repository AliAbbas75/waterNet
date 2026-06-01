import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Droplet, MapPin, MessageSquarePlus, Activity } from "lucide-react";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { PlantMap } from "../../components/map/PlantMap.jsx";
import { usePublicPlantStatus } from "../../hooks/usePublic.js";
import { fmtNum, relTime } from "../../lib/format.js";

const PARAMS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "TDS", label: "TDS", unit: "ppm" }
];

export default function PublicPlantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const status = usePublicPlantStatus(id);

  if (status.isLoading) {
    return (
      <div className="py-12 grid place-items-center">
        <Spinner label="Loading plant…" />
      </div>
    );
  }
  if (status.error || !status.data?.plant) {
    return (
      <div className="px-4 sm:px-6 pt-6 max-w-screen-md mx-auto">
        <EmptyState
          title="Plant not found"
          action={
            <Link to="/app">
              <Button variant="secondary" leftIcon={<ArrowLeft size={16} />}>
                Back to nearby
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  const { plant, overall, available, devices, readings } = status.data;

  // Aggregate latest readings across devices.
  const latest = aggregateLatest(readings);
  const lastTs = latestTimestamp(readings);

  return (
    <div className="px-4 sm:px-6 pt-4 sm:pt-6 max-w-screen-md mx-auto">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3">
        <ArrowLeft size={14} /> Nearby
      </Link>

      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{plant.name}</h1>
          <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1">
            <MapPin size={14} />
            {plant.address}
          </p>
          {plant.operatingHours ? (
            <p className="text-sm text-slate-500 mt-1 inline-flex items-center gap-1">
              <Clock size={14} />
              {plant.operatingHours}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={statusVariant(overall)} dot>
            {overall === "NO_DATA" ? "No data" : overall}
          </Badge>
          {available ? (
            <Badge variant="safe" dot>
              Water flowing
            </Badge>
          ) : (
            <Badge variant="unsafe" dot>
              Currently offline
            </Badge>
          )}
        </div>
      </div>

      <Card className="mb-4" padded={false}>
        <PlantMap plants={[{ plant, overall }]} height={220} zoom={14} />
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Current readings"
          subtitle={lastTs ? `Last update ${relTime(lastTs)}` : "Awaiting telemetry"}
          action={<Activity size={18} className="text-brand-500" />}
        />
        {!Object.keys(latest).length ? (
          <EmptyState icon={Droplet} title="No live readings yet" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {PARAMS.map((p) => (
              <div key={p.key} className="rounded-lg border border-slate-200 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{p.label}</p>
                <p className="text-xl font-semibold text-slate-900 mt-0.5">
                  {latest[p.key] != null ? fmtNum(latest[p.key], 2) : "—"}
                  {latest[p.key] != null && p.unit ? (
                    <span className="text-sm font-normal text-slate-500 ml-1">{p.unit}</span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <CardHeader title="Devices" subtitle={`${devices?.length || 0} installed at this plant`} />
        {!devices?.length ? (
          <p className="text-sm text-slate-500">No devices reporting yet.</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li
                key={d._id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-800">{d.deviceId}</p>
                  <p className="text-xs text-slate-500">
                    {d.lastSeenAt ? `Seen ${relTime(d.lastSeenAt)}` : "Never seen"}
                  </p>
                </div>
                <Badge variant={statusVariant(d.availability)} dot>
                  {d.availability === "AVAILABLE" ? "Online" : "Offline"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-4 bg-brand-50 border-brand-100">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-brand-900">Notice an issue?</h3>
            <p className="text-sm text-brand-800">
              Strange taste, no water, broken display? Let the operations team know.
            </p>
          </div>
          <Button
            onClick={() => navigate("/app/report", { state: { plantId: plant._id, plantName: plant.name } })}
            leftIcon={<MessageSquarePlus size={16} />}
          >
            Report an issue
          </Button>
        </div>
      </Card>
    </div>
  );
}

function aggregateLatest(readings) {
  if (!readings) return {};
  const out = {};
  const counts = {};
  Object.values(readings).forEach((r) => {
    if (!r?.readings) return;
    for (const k of ["pH", "turbidity", "temperature", "TDS"]) {
      if (typeof r.readings[k] === "number") {
        out[k] = (out[k] || 0) + r.readings[k];
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  });
  for (const k of Object.keys(out)) out[k] = out[k] / counts[k];
  return out;
}

function latestTimestamp(readings) {
  if (!readings) return null;
  let max = null;
  Object.values(readings).forEach((r) => {
    if (r?.timestamp) {
      const t = new Date(r.timestamp).getTime();
      if (!max || t > max) max = t;
    }
  });
  return max ? new Date(max).toISOString() : null;
}
