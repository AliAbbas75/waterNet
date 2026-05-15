import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input, Select, Field } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import {
  useCreateDevice,
  useDeleteDevice,
  useDevices,
  useUpdateDevice
} from "../../hooks/useDevices.js";
import { usePlants } from "../../hooks/usePlants.js";
import { relTime } from "../../lib/format.js";

export default function DevicesPage() {
  const [status, setStatus] = useState("");
  const [plantId, setPlantId] = useState("");
  const [disabled, setDisabled] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filters = useMemo(() => ({ status, plantId, disabled }), [status, plantId, disabled]);
  const { data: devices, isLoading } = useDevices(filters);
  const plants = usePlants();
  const navigate = useNavigate();
  const del = useDeleteDevice();

  const filtered = useMemo(() => {
    if (!devices) return [];
    if (!search) return devices;
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.deviceId.toLowerCase().includes(q) ||
        d.plantId?.name?.toLowerCase().includes(q) ||
        d.firmwareVersion?.toLowerCase().includes(q)
    );
  }, [devices, search]);

  const columns = useMemo(
    () => [
      {
        key: "device",
        header: "Device",
        render: (d) => (
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{d.deviceId}</div>
            <div className="text-xs text-slate-500">FW {d.firmwareVersion || "—"}</div>
          </div>
        )
      },
      {
        key: "plant",
        header: "Installed at",
        render: (d) => (
          <span className="text-sm text-slate-700">{d.plantId?.name || <em className="text-slate-400">— Available stock —</em>}</span>
        )
      },
      {
        key: "status",
        header: "Status",
        render: (d) => (
          <Badge variant={statusVariant(d.status)} dot>
            {d.status}
          </Badge>
        )
      },
      {
        key: "availability",
        header: "Online",
        render: (d) => (
          <Badge variant={statusVariant(d.availability)} dot>
            {d.availability === "AVAILABLE" ? "Online" : "Offline"}
          </Badge>
        )
      },
      {
        key: "seen",
        header: "Last seen",
        render: (d) => <span className="text-sm text-slate-500">{relTime(d.lastSeenAt)}</span>
      },
      {
        key: "actions",
        header: "",
        cellClassName: "text-right",
        render: (d) => (
          <div className="inline-flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(d);
              }}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(d);
              }}
              className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )
      }
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Devices"
        description="IoT sensor nodes — pH, turbidity, temperature and TDS — registered in WaterNet."
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setEditing({})}>
            New device
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Search by device ID, plant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available (stock)</option>
            <option value="INSTALLED">Installed</option>
            <option value="FAULTY">Faulty</option>
            <option value="MAINTENANCE">Maintenance</option>
          </Select>
          <Select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
            <option value="">All plants</option>
            {(plants.data || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Select value={disabled} onChange={(e) => setDisabled(e.target.value)}>
            <option value="">Active + disabled</option>
            <option value="false">Active only</option>
            <option value="true">Disabled only</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading devices…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          onRowClick={(d) => navigate(`/admin/devices/${d._id}`)}
          empty={
            <EmptyState
              icon={Cpu}
              title="No devices found"
              description="Add a new device or relax the filters."
            />
          }
        />
      )}

      <DeviceFormModal
        open={editing !== null}
        device={editing && editing._id ? editing : null}
        plants={plants.data || []}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteModal
        device={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={async () => {
          await del.mutateAsync(confirmDelete._id);
          setConfirmDelete(null);
        }}
        loading={del.isPending}
      />
    </>
  );
}

function DeviceFormModal({ open, device, plants, onClose }) {
  const isEdit = !!device;
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const [form, setForm] = useState(initForm(device));
  const [error, setError] = useState("");

  useMemo(() => setForm(initForm(device)), [device, open]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const body = {
      deviceId: form.deviceId.trim(),
      plantId: form.plantId || null,
      firmwareVersion: form.firmwareVersion.trim() || null,
      status: form.status,
      disabled: form.disabled
    };
    if (!body.deviceId) {
      setError("deviceId is required.");
      return;
    }
    try {
      if (isEdit) await update.mutateAsync({ id: device._id, ...body });
      else await create.mutateAsync(body);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save.");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit device" : "New device"}
      subtitle="Devices ingest telemetry over MQTT once their certs are flashed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? "Save changes" : "Create device"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Device ID" required hint="(must match MQTT topic segment)">
          <Input
            value={form.deviceId}
            onChange={(e) => setForm({ ...form, deviceId: e.target.value })}
            placeholder="WN-0001"
            disabled={isEdit}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plant">
            <Select value={form.plantId} onChange={(e) => setForm({ ...form, plantId: e.target.value })}>
              <option value="">— Available stock —</option>
              {plants.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="AVAILABLE">Available</option>
              <option value="INSTALLED">Installed</option>
              <option value="FAULTY">Faulty</option>
              <option value="MAINTENANCE">Maintenance</option>
            </Select>
          </Field>
        </div>
        <Field label="Firmware version">
          <Input
            value={form.firmwareVersion}
            onChange={(e) => setForm({ ...form, firmwareVersion: e.target.value })}
            placeholder="1.2.1"
          />
        </Field>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.disabled}
            onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
            className="rounded border-slate-300"
          />
          Disabled — ignore telemetry from this device
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function initForm(device) {
  return {
    deviceId: device?.deviceId || "",
    plantId: device?.plantId?._id || device?.plantId || "",
    firmwareVersion: device?.firmwareVersion || "",
    status: device?.status || "AVAILABLE",
    disabled: Boolean(device?.disabled)
  };
}

function ConfirmDeleteModal({ device, onClose, onConfirm, loading }) {
  return (
    <Modal
      open={!!device}
      onClose={onClose}
      title="Delete device?"
      subtitle="Telemetry history is preserved; the device record is removed."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        Delete <span className="font-semibold">{device?.deviceId}</span>?
      </p>
    </Modal>
  );
}
