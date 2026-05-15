import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Cpu, Power, Plug, PlugZap, Wrench } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Field, Select } from "../../components/ui/Input.jsx";
import { TimeSeriesChart } from "../../components/charts/TimeSeriesChart.jsx";
import {
  useDevice,
  useDeviceReadings,
  useInstallDevice,
  useUninstallDevice,
  useUpdateDevice
} from "../../hooks/useDevices.js";
import { usePlants } from "../../hooks/usePlants.js";
import { useThresholds } from "../../hooks/useThresholds.js";
import { fmtDate, fmtNum, relTime } from "../../lib/format.js";

const PARAMS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "TDS", label: "TDS", unit: "ppm" }
];

export default function DeviceDetailPage() {
  const { id } = useParams();
  const device = useDevice(id);
  const readings = useDeviceReadings(id, 400);
  const plants = usePlants();
  const globalThresholds = useThresholds();
  const plantId = device.data?.plantId?._id || device.data?.plantId;
  const plantThresholds = useThresholds(plantId);
  const [installOpen, setInstallOpen] = useState(false);
  const install = useInstallDevice();
  const uninstall = useUninstallDevice();
  const update = useUpdateDevice();

  const thresholdMap = useMemo(() => {
    const map = {};
    (globalThresholds.data || []).forEach((t) => {
      if (!t.plantId) map[t.parameter] = t;
    });
    (plantThresholds.data || []).forEach((t) => {
      if (t.plantId) map[t.parameter] = t;
    });
    return map;
  }, [globalThresholds.data, plantThresholds.data]);

  if (device.isLoading) {
    return (
      <div className="py-12 grid place-items-center">
        <Spinner label="Loading device…" />
      </div>
    );
  }
  if (device.error || !device.data) {
    return (
      <EmptyState
        title="Device not found"
        action={
          <Link to="/admin/devices">
            <Button variant="secondary" leftIcon={<ArrowLeft size={16} />}>
              Back to devices
            </Button>
          </Link>
        }
      />
    );
  }

  const d = device.data;
  const points = (readings.data?.readings || []).filter((r) => r.readings).reverse();
  const latest = points[points.length - 1]?.readings;

  return (
    <>
      <Link
        to="/admin/devices"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-3"
      >
        <ArrowLeft size={14} /> Devices
      </Link>
      <PageHeader
        title={d.deviceId}
        description={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span>Firmware {d.firmwareVersion || "—"}</span>
            <span>•</span>
            <span>Last seen {relTime(d.lastSeenAt)}</span>
          </span>
        }
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariant(d.status)} dot>
              {d.status}
            </Badge>
            <Badge variant={statusVariant(d.availability)} dot>
              {d.availability === "AVAILABLE" ? "Online" : "Offline"}
            </Badge>
            {d.disabled ? (
              <Badge variant="muted" dot>
                Disabled
              </Badge>
            ) : null}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Installation" subtitle={d.plantId?.name || "Not installed at any plant"} />
          <div className="flex flex-wrap gap-2">
            {d.plantId ? (
              <>
                <Link to={`/admin/plants/${d.plantId._id || d.plantId}`}>
                  <Button variant="secondary" size="sm">
                    Open plant
                  </Button>
                </Link>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<PlugZap size={14} />}
                  onClick={() => uninstall.mutate(d._id)}
                  loading={uninstall.isPending}
                >
                  Uninstall
                </Button>
              </>
            ) : (
              <Button leftIcon={<Plug size={14} />} size="sm" onClick={() => setInstallOpen(true)}>
                Install at plant
              </Button>
            )}
            {!d.disabled ? (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Power size={14} />}
                onClick={() =>
                  update.mutate({
                    id: d._id,
                    plantId: d.plantId?._id || d.plantId || null,
                    status: d.status,
                    firmwareVersion: d.firmwareVersion,
                    disabled: true
                  })
                }
                loading={update.isPending}
              >
                Disable
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Power size={14} />}
                onClick={() =>
                  update.mutate({
                    id: d._id,
                    plantId: d.plantId?._id || d.plantId || null,
                    status: d.status,
                    firmwareVersion: d.firmwareVersion,
                    disabled: false
                  })
                }
                loading={update.isPending}
              >
                Re-enable
              </Button>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <dt className="text-slate-500">Installed at</dt>
            <dd className="text-slate-800 sm:text-right">{d.installDate ? fmtDate(d.installDate, "PP") : "—"}</dd>
            <dt className="text-slate-500">Created</dt>
            <dd className="text-slate-800 sm:text-right">{fmtDate(d.createdAt, "PP")}</dd>
            <dt className="text-slate-500">Last seen</dt>
            <dd className="text-slate-800 sm:text-right">{d.lastSeenAt ? fmtDate(d.lastSeenAt, "PP HH:mm") : "Never"}</dd>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Latest readings" subtitle={latest ? "Live" : "No telemetry yet"} />
          {!latest ? (
            <EmptyState icon={Cpu} title="No readings yet" />
          ) : (
            <ul className="space-y-2">
              {PARAMS.map((p) => (
                <li key={p.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-sm text-slate-600">{p.label}</span>
                  <span className="font-medium text-slate-900">
                    {fmtNum(latest[p.key], 2)}{" "}
                    <span className="text-xs text-slate-500 font-normal">{p.unit}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section className="mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Wrench size={16} className="text-brand-600" />
          Recent telemetry
        </h2>
        {readings.isLoading ? (
          <Card>
            <Spinner />
          </Card>
        ) : !points.length ? (
          <Card>
            <EmptyState title="No telemetry data" description="Charts will appear once readings arrive." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {PARAMS.map((p) => (
              <Card key={p.key}>
                <CardHeader
                  title={p.label}
                  subtitle={`Last ${points.length} readings`}
                  action={
                    <span className="text-xs text-slate-500">
                      {points[points.length - 1]?.timestamp
                        ? fmtDate(points[points.length - 1].timestamp, "PP HH:mm")
                        : ""}
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
        )}
      </section>

      <InstallModal
        open={installOpen}
        plants={plants.data || []}
        onClose={() => setInstallOpen(false)}
        loading={install.isPending}
        onConfirm={async (plantId) => {
          await install.mutateAsync({ id: d._id, plantId });
          setInstallOpen(false);
        }}
      />
    </>
  );
}

function InstallModal({ open, plants, onClose, onConfirm, loading }) {
  const [plantId, setPlantId] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install device"
      subtitle="Assigns this device to a plant and marks it INSTALLED."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(plantId)} loading={loading} disabled={!plantId}>
            Install
          </Button>
        </>
      }
    >
      <Field label="Plant" required>
        <Select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
          <option value="">Select a plant…</option>
          {plants.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
