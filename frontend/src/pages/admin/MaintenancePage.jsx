import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Wrench } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input, Select, Field, Textarea } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { Avatar } from "../../components/ui/Avatar.jsx";
import { useCreateTask, useTasks } from "../../hooks/useMaintenance.js";
import { usePlants } from "../../hooks/usePlants.js";
import { useDevices } from "../../hooks/useDevices.js";
import { useUsers } from "../../hooks/useUsers.js";
import { relTime } from "../../lib/format.js";

export default function MaintenancePage() {
  const [status, setStatus] = useState("");
  const [plantId, setPlantId] = useState("");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const filters = useMemo(() => ({ status, plantId }), [status, plantId]);
  const tasks = useTasks(filters);
  const plants = usePlants();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (!tasks.data) return [];
    if (!search) return tasks.data;
    const q = search.toLowerCase();
    return tasks.data.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.plantId?.name?.toLowerCase().includes(q) ||
        t.assignedToUserId?.display_name?.toLowerCase().includes(q)
    );
  }, [tasks.data, search]);

  const columns = useMemo(
    () => [
      {
        key: "title",
        header: "Task",
        render: (t) => (
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{t.title}</div>
            <div className="text-xs text-slate-500 truncate">{t.description}</div>
          </div>
        )
      },
      {
        key: "plant",
        header: "Plant",
        render: (t) => <span className="text-sm text-slate-700">{t.plantId?.name || "—"}</span>
      },
      {
        key: "assignee",
        header: "Assignee",
        render: (t) =>
          t.assignedToUserId ? (
            <div className="inline-flex items-center gap-2">
              <Avatar name={t.assignedToUserId.display_name} size={24} />
              <span className="text-sm text-slate-700">{t.assignedToUserId.display_name}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-400">Unassigned</span>
          )
      },
      {
        key: "status",
        header: "Status",
        render: (t) => (
          <Badge variant={statusVariant(t.status)} dot>
            {t.status.replace("_", " ")}
          </Badge>
        )
      },
      {
        key: "updated",
        header: "Updated",
        render: (t) => <span className="text-sm text-slate-500">{relTime(t.updatedAt)}</span>
      }
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Tasks assigned to maintainers — from filter changes to sensor calibration."
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New task
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search title, plant, assignee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select value={plantId} onChange={(e) => setPlantId(e.target.value)}>
            <option value="">All plants</option>
            {(plants.data || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {tasks.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading tasks…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          onRowClick={(t) => navigate(`/admin/maintenance/${t._id}`)}
          empty={<EmptyState icon={Wrench} title="No tasks found" />}
        />
      )}

      <CreateTaskModal open={creating} onClose={() => setCreating(false)} />
    </>
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

  useMemo(() => {
    if (open) setForm({ title: "", description: "", assignedToUserId: "", plantId: "", deviceId: "" });
  }, [open]);

  const assignableUsers = (users.data || []).filter((u) => ["MAINTAINER", "ADMIN"].includes(u.role));
  const devicesForPlant = (devices.data || []).filter((d) => !form.plantId || (d.plantId && (d.plantId._id || d.plantId) === form.plantId));

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
            <Select value={form.plantId} onChange={(e) => setForm({ ...form, plantId: e.target.value, deviceId: "" })}>
              <option value="">— Any —</option>
              {(plants.data || []).map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Device">
            <Select value={form.deviceId} onChange={(e) => setForm({ ...form, deviceId: e.target.value })}>
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
