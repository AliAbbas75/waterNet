import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, Search, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Input, Select, Field, Textarea } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge, statusVariant } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import {
  useCreatePlant,
  useDeletePlant,
  usePlants,
  useUpdatePlant
} from "../../hooks/usePlants.js";
import { relTime } from "../../lib/format.js";

export default function PlantsPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null = closed, {} = creating, plant = editing
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filters = useMemo(() => ({ status, search }), [status, search]);
  const { data: plants, isLoading } = usePlants(filters);
  const navigate = useNavigate();
  const del = useDeletePlant();

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Plant",
        render: (p) => (
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{p.name}</div>
            <div className="text-xs text-slate-500 truncate">{p.address}</div>
          </div>
        )
      },
      {
        key: "status",
        header: "Status",
        render: (p) => (
          <Badge variant={statusVariant(p.operationalStatus)} dot>
            {p.operationalStatus}
          </Badge>
        )
      },
      {
        key: "hours",
        header: "Hours",
        render: (p) => <span className="text-sm text-slate-700">{p.operatingHours || "—"}</span>
      },
      {
        key: "updated",
        header: "Updated",
        mobileLabel: "Updated",
        render: (p) => <span className="text-sm text-slate-500">{relTime(p.updatedAt)}</span>
      },
      {
        key: "actions",
        header: "",
        cellClassName: "text-right",
        render: (p) => (
          <div className="inline-flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(p);
              }}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDelete(p);
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
        title="Plants"
        description="Government and society-managed filter plants registered in WaterNet."
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setEditing({})}>
            New plant
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search by name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="OFFLINE">Offline</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading plants…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={plants || []}
          onRowClick={(p) => navigate(`/admin/plants/${p._id}`)}
          empty={
            <EmptyState
              icon={Building2}
              title="No plants found"
              description="Try clearing filters or add a new plant."
            />
          }
        />
      )}

      <PlantFormModal
        open={editing !== null}
        plant={editing && editing._id ? editing : null}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteModal
        plant={confirmDelete}
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

function PlantFormModal({ open, plant, onClose }) {
  const isEdit = !!plant;
  const create = useCreatePlant();
  const update = useUpdatePlant();
  const [form, setForm] = useState(initForm(plant));
  const [error, setError] = useState("");

  // Re-init when target changes.
  useMemo(() => setForm(initForm(plant)), [plant, open]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const body = {
      name: form.name.trim(),
      address: form.address.trim(),
      geo: { lat: Number(form.lat), lng: Number(form.lng) },
      operationalStatus: form.operationalStatus,
      operatingHours: form.operatingHours.trim() || null
    };
    if (!body.name || !body.address || !Number.isFinite(body.geo.lat) || !Number.isFinite(body.geo.lng)) {
      setError("Name, address, and geo coordinates are required.");
      return;
    }
    try {
      if (isEdit) await update.mutateAsync({ id: plant._id, ...body });
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
      title={isEdit ? "Edit plant" : "New plant"}
      subtitle="Register a filter plant for monitoring."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? "Save changes" : "Create plant"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="E-11 Markaz Filter Plant"
          />
        </Field>
        <Field label="Address" required>
          <Textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Street, sector, city"
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" required hint="(decimal)">
            <Input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => setForm({ ...form, lat: e.target.value })}
            />
          </Field>
          <Field label="Longitude" required hint="(decimal)">
            <Input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => setForm({ ...form, lng: e.target.value })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Operational status">
            <Select
              value={form.operationalStatus}
              onChange={(e) => setForm({ ...form, operationalStatus: e.target.value })}
            >
              <option value="OPERATIONAL">Operational</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OFFLINE">Offline</option>
            </Select>
          </Field>
          <Field label="Operating hours" hint="(e.g. 06:00-22:00)">
            <Input
              value={form.operatingHours}
              onChange={(e) => setForm({ ...form, operatingHours: e.target.value })}
              placeholder="24/7"
            />
          </Field>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function initForm(plant) {
  return {
    name: plant?.name || "",
    address: plant?.address || "",
    lat: plant?.geo?.lat ?? "",
    lng: plant?.geo?.lng ?? "",
    operationalStatus: plant?.operationalStatus || "OPERATIONAL",
    operatingHours: plant?.operatingHours || ""
  };
}

function ConfirmDeleteModal({ plant, onClose, onConfirm, loading }) {
  return (
    <Modal
      open={!!plant}
      onClose={onClose}
      title="Delete plant?"
      subtitle="This cannot be undone. Devices at this plant will not be deleted."
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
        Delete <span className="font-semibold">{plant?.name}</span>?
      </p>
    </Modal>
  );
}
