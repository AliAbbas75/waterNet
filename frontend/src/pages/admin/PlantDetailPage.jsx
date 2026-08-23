import { Link, useParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { ArrowLeft, Cpu, MapPin, Clock, Activity } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Badge, statusVariant, plantStatusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Select } from "../../components/ui/Input.jsx";
import { TimeSeriesChart } from "../../components/charts/TimeSeriesChart.jsx";
import { PlantMap } from "../../components/map/PlantMap.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { usePlant, usePlantState, usePlantConsumption, useUpdatePlant } from "../../hooks/usePlants.js";
import { ConsumptionCard, ConsumptionBadge } from "../../components/plants/ConsumptionCard.jsx";
import { useDevices, useDeviceReadings } from "../../hooks/useDevices.js";
import { useThresholds } from "../../hooks/useThresholds.js";
import { fmtNum, relTime, fmtDate } from "../../lib/format.js";

const PARAMS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "TDS", label: "TDS", unit: "ppm" },
  { key: "flowRate", label: "Flow rate", unit: "L/min" }
];

export default function PlantDetailPage() {
  const { id } = useParams();
  const plant = usePlant(id);
  const state = usePlantState(id);
  const consumption = usePlantConsumption(id);
  const devices = useDevices({ plantId: id });
  const updatePlant = useUpdatePlant();
  const globalThresholds = useThresholds();
  const plantThresholds = useThresholds(id);
  const [qualityDeviceId, setQualityDeviceId] = useState("");
  const [saveError, setSaveError] = useState("");

  // The pin as actually persisted. The Select is free to hold an unsaved
  // choice, but everything that reports on the plant reads this instead, so
  // the chart cannot drift away from the caption beneath it.
  const savedQualityDeviceId = plant.data?.qualityDeviceId
    ? plant.data.qualityDeviceId._id || plant.data.qualityDeviceId
    : "";

  useEffect(() => {
    setQualityDeviceId(savedQualityDeviceId);
    setSaveError("");
  }, [savedQualityDeviceId]);

  const plantDevices = useMemo(
    () => (devices.data || []).filter((d) => d.status === "INSTALLED"),
    [devices.data]
  );

  const thresholdMap = useMemo(() => {
    const map = {};
    (globalThresholds.data || []).forEach((t) => {
      if (!t.plantId) map[t.parameter] = t;
    });
    (plantThresholds.data || []).forEach((t) => {
      if (t.plantId) map[t.parameter] = t; // override wins
    });
    return map;
  }, [globalThresholds.data, plantThresholds.data]);

  const overall = useMemo(() => {
    const cats = (state.data?.states || []).map((s) => s.category);
    if (cats.includes("UNSAFE")) return "UNSAFE";
    if (cats.includes("WARNING")) return "WARNING";
    if (cats.includes("SAFE")) return "SAFE";
    return "NO_DATA";
  }, [state.data]);

  if (plant.isLoading) {
    return (
      <div className="py-12 grid place-items-center">
        <Spinner label="Loading plant…" />
      </div>
    );
  }
  if (plant.error || !plant.data) {
    return (
      <EmptyState
        title="Plant not found"
        description="It may have been deleted or you don't have access."
        action={
          <Link to="/admin/plants">
            <Button variant="secondary" leftIcon={<ArrowLeft size={16} />}>
              Back to plants
            </Button>
          </Link>
        }
      />
    );
  }

  const p = plant.data;
  const mapItem = [{ plant: p, overall }];

  return (
    <>
      <Link
        to="/admin/plants"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"
      >
        <ArrowLeft size={14} /> Plants
      </Link>
      <PageHeader
        title={p.name}
        description={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} />
              {p.address}
            </span>
            {p.operatingHours ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} />
                {p.operatingHours}
              </span>
            ) : null}
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            <Badge variant={plantStatusVariant(p.operationalStatus)} dot>
              {p.operationalStatus}
            </Badge>
            <Badge variant={statusVariant(overall)} dot>
              Water: {overall.replace("_", " ")}
            </Badge>
            <ConsumptionBadge consumption={consumption.data} />
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
        <div className="lg:col-span-2">
          <Card padded={false}>
            <PlantMap plants={mapItem} height={280} zoom={13} />
          </Card>
        </div>
        <ConsumptionCard query={consumption} />
      </div>

      <div>
        <Card>
          <CardHeader title="Devices at this plant" subtitle={`${devices.data?.length || 0} installed`} />
          {devices.isLoading ? (
            <Spinner />
          ) : !devices.data?.length ? (
            <EmptyState icon={Cpu} title="No devices installed yet." />
          ) : (
            <>
              <div className="space-y-2 mb-4">
                <label className="block text-sm font-medium text-slate-700">Quality device</label>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <div className="flex-1">
                    <Select
                      value={qualityDeviceId}
                      onChange={(e) => setQualityDeviceId(e.target.value)}
                    >
                      <option value="">Auto (all devices)</option>
                      {plantDevices.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.deviceId}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    onClick={async () => {
                      setSaveError("");
                      try {
                        await updatePlant.mutateAsync({
                          id,
                          name: plant.data.name,
                          address: plant.data.address,
                          geo: plant.data.geo,
                          operationalStatus: plant.data.operationalStatus,
                          operatingHours: plant.data.operatingHours,
                          qualityDeviceId: qualityDeviceId || null
                        });
                      } catch (err) {
                        setSaveError(err.message || "Failed to save quality device.");
                      }
                    }}
                    loading={updatePlant.isPending}
                    disabled={updatePlant.isPending || !plant.data}
                  >
                    Save
                  </Button>
                </div>
                {saveError ? <p className="text-xs text-red-600">{saveError}</p> : null}
                {plant.data?.qualityDeviceId ? (
                  <p className="text-sm text-slate-500">
                    Using {plant.data.qualityDeviceId.deviceId} for water quality analysis.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    No specific device selected; all installed devices are eligible.
                  </p>
                )}
              </div>
              <ul className="space-y-2">
                {devices.data.map((d) => (
                  <li key={d._id}>
                    <Link
                      to={`/admin/devices/${d._id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.deviceId}</p>
                        <p className="text-xs text-slate-500 truncate">
                          FW {d.firmwareVersion || "—"} • Seen {relTime(d.lastSeenAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={statusVariant(d.availability)} dot>
                          {d.availability === "AVAILABLE" ? "Online" : "Offline"}
                        </Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Activity size={16} className="text-brand-600" />
          Current water quality
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {PARAMS.map((param) => (
            <ParameterCard
              key={param.key}
              param={param}
              states={state.data?.states || []}
              threshold={thresholdMap[param.key]}
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Trends</h2>
        <DeviceTrends
          devices={devices.data || []}
          qualityDeviceId={savedQualityDeviceId}
          thresholdMap={thresholdMap}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Threshold overrides for this plant</h2>
        <DataTable
          columns={[
            { key: "parameter", header: "Parameter", render: (t) => <span className="font-medium">{t.parameter}</span> },
            { key: "safe", header: "Safe range", render: (t) => `${fmtNum(t.safeMin, 1)} – ${fmtNum(t.safeMax, 1)}` },
            { key: "warn", header: "Warn range", render: (t) => t.warnMin != null ? `${fmtNum(t.warnMin, 1)} – ${fmtNum(t.warnMax, 1)}` : "—" },
            { key: "scope", header: "Scope", render: (t) => (t.plantId ? "Per-plant" : "Global default") }
          ]}
          rows={[
            ...(plantThresholds.data || []).filter((t) => t.plantId),
            ...(globalThresholds.data || []).filter((t) => !t.plantId)
          ]}
          empty={<EmptyState title="No thresholds configured" />}
        />
      </section>
    </>
  );
}

function ParameterCard({ param, states, threshold }) {
  // Find the most recent reason for this parameter across devices, if any.
  let worstCategory = "NO_DATA";
  let value = null;
  let lastEvaluated = null;
  for (const s of states) {
    if (lastEvaluated == null || new Date(s.lastEvaluatedAt) > new Date(lastEvaluated)) {
      lastEvaluated = s.lastEvaluatedAt;
    }
    const rsn = s.reasons?.find((r) => r.parameter === param.key);
    if (rsn) {
      if (rsn.threshold === "unsafe") worstCategory = "UNSAFE";
      else if (rsn.threshold === "warn" && worstCategory !== "UNSAFE") worstCategory = "WARNING";
      value = rsn.value ?? value;
    }
  }

  // If we didn't find a reason, infer category from overall.
  if (worstCategory === "NO_DATA" && states.length) worstCategory = "SAFE";

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{param.label}</p>
          <p className="text-2xl font-semibold text-slate-900 mt-1">
            {value != null ? fmtNum(value, 2) : "—"}
            {value != null && param.unit ? <span className="text-base font-normal text-slate-500 ml-1">{param.unit}</span> : null}
          </p>
        </div>
        <Badge variant={statusVariant(worstCategory)} dot>
          {worstCategory.replace("_", " ")}
        </Badge>
      </div>
      <p className="text-xs text-slate-500 mt-2">
        {threshold
          ? `Safe ${fmtNum(threshold.safeMin, 1)} – ${fmtNum(threshold.safeMax, 1)} ${param.unit}`
          : "No threshold set"}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">
        {lastEvaluated ? `Evaluated ${relTime(lastEvaluated)}` : "Waiting on telemetry"}
      </p>
    </Card>
  );
}

function DeviceTrends({ devices, qualityDeviceId, thresholdMap }) {
  if (!devices.length) {
    return <EmptyState title="No devices to chart." />;
  }
  // The plant's pinned quality device wins; otherwise fall back to the first
  // installed one, which is usually enough for an at-a-glance.
  const focus =
    (qualityDeviceId && devices.find((d) => d._id === qualityDeviceId)) ||
    devices.find((d) => d.status === "INSTALLED") ||
    devices[0];
  if (!focus) {
    return <EmptyState title="No devices to chart." />;
  }
  return <DeviceTrendCharts deviceId={focus._id} thresholdMap={thresholdMap} deviceLabel={focus.deviceId} />;
}

function DeviceTrendCharts({ deviceId, thresholdMap, deviceLabel }) {
  const { data, isLoading } = useDeviceReadings(deviceId, 400);
  const points = (data?.readings || []).filter((r) => r.readings).reverse();
  if (isLoading) {
    return (
      <Card>
        <Spinner />
      </Card>
    );
  }
  if (!points.length) {
    return (
      <Card>
        <EmptyState title="No telemetry yet for this device." description={`Charts will appear once readings arrive from ${deviceLabel}.`} />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {PARAMS.map((p) => (
        <Card key={p.key}>
          <CardHeader
            title={p.label}
            subtitle={
              points[points.length - 1]?.timestamp
                ? `Last reading ${fmtDate(points[points.length - 1].timestamp, "PP HH:mm")}`
                : ""
            }
            action={
              <span className="text-xs text-slate-500">
                Device {deviceLabel}
              </span>
            }
          />
          <TimeSeriesChart
            data={points}
            dataKey={p.key}
            label={p.label}
            unit={p.unit}
            threshold={thresholdMap[p.key]}
          />
        </Card>
      ))}
    </div>
  );
}
