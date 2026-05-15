import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Card, CardHeader } from "../../components/ui/Card.jsx";
import { Input, Select, Field } from "../../components/ui/Input.jsx";
import { DataTable } from "../../components/ui/DataTable.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import {
  useCreateThreshold,
  useDeleteThreshold,
  useThresholds,
  useUpdateThreshold
} from "../../hooks/useThresholds.js";
import { usePlants } from "../../hooks/usePlants.js";
import { fmtNum } from "../../lib/format.js";

const PARAMS = [
  { key: "pH", label: "pH" },
  { key: "turbidity", label: "Turbidity (NTU)" },
  { key: "temperature", label: "Temperature (°C)" },
  { key: "TDS", label: "TDS (ppm)" }
];

export default function ThresholdsPage() {
  const all = useThresholds();
  const plants = usePlants();
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const del = useDeleteThreshold();

  const plantMap = useMemo(() => {
    const m = {};
    (plants.data || []).forEach((p) => (m[p._id] = p));
    return m;
  }, [plants.data]);

  const globals = (all.data || []).filter((t) => !t.plantId);
  const overrides = (all.data || []).filter((t) => t.plantId);

  return (
    <>
      <PageHeader
        title="Thresholds"
        description="Safe / warn / unsafe bands per parameter. Per-plant overrides take precedence over globals."
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setEditing({})}>
            New threshold
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="Global defaults"
          subtitle="Applied to every plant unless an override is configured."
          action={<SlidersHorizontal size={18} className="text-slate-400" />}
        />
        {all.isLoading ? (
          <Spinner />
        ) : (
          <ThresholdTable
            rows={globals}
            onEdit={(t) => setEditing(t)}
            onDelete={(t) => setConfirmDelete(t)}
            empty={<EmptyState title="No global defaults" description="Add one for each parameter." />}
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Per-plant overrides" subtitle={`${overrides.length} configured`} />
        {all.isLoading ? (
          <Spinner />
        ) : (
          <ThresholdTable
            rows={overrides}
            plantMap={plantMap}
            onEdit={(t) => setEditing(t)}
            onDelete={(t) => setConfirmDelete(t)}
            empty={<EmptyState title="No overrides" description="Plants will fall back to global defaults." />}
          />
        )}
      </Card>

      <ThresholdFormModal
        open={editing !== null}
        threshold={editing && editing._id ? editing : null}
        plants={plants.data || []}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteModal
        threshold={confirmDelete}
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

function ThresholdTable({ rows, plantMap, onEdit, onDelete, empty }) {
  const columns = [
    {
      key: "param",
      header: "Parameter",
      render: (t) => <span className="font-medium">{t.parameter}</span>
    },
    {
      key: "scope",
      header: "Scope",
      render: (t) =>
        t.plantId ? (
          <Badge variant="info">{plantMap?.[t.plantId]?.name || "Plant"}</Badge>
        ) : (
          <Badge variant="muted">Global</Badge>
        )
    },
    {
      key: "safe",
      header: "Safe",
      render: (t) => `${fmtNum(t.safeMin, 1)} – ${fmtNum(t.safeMax, 1)}`
    },
    {
      key: "warn",
      header: "Warn",
      render: (t) => (t.warnMin != null ? `${fmtNum(t.warnMin, 1)} – ${fmtNum(t.warnMax, 1)}` : "—")
    },
    {
      key: "unsafe",
      header: "Unsafe",
      render: (t) =>
        t.unsafeMin != null ? `${fmtNum(t.unsafeMin, 1)} – ${fmtNum(t.unsafeMax, 1)}` : "—"
    },
    {
      key: "actions",
      header: "",
      cellClassName: "text-right",
      render: (t) => (
        <div className="inline-flex items-center gap-1">
          <button
            onClick={() => onEdit(t)}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => onDelete(t)}
            className="p-1.5 rounded-md text-red-500 hover:bg-red-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];
  return <DataTable columns={columns} rows={rows} empty={empty} />;
}

function ThresholdFormModal({ open, threshold, plants, onClose }) {
  const isEdit = !!threshold;
  const create = useCreateThreshold();
  const update = useUpdateThreshold();
  const [form, setForm] = useState(initForm(threshold));
  const [error, setError] = useState("");

  useMemo(() => setForm(initForm(threshold)), [threshold, open]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const body = {
      plantId: form.plantId || null,
      parameter: form.parameter,
      safeMin: Number(form.safeMin),
      safeMax: Number(form.safeMax),
      warnMin: form.warnMin === "" ? null : Number(form.warnMin),
      warnMax: form.warnMax === "" ? null : Number(form.warnMax),
      unsafeMin: form.unsafeMin === "" ? null : Number(form.unsafeMin),
      unsafeMax: form.unsafeMax === "" ? null : Number(form.unsafeMax)
    };
    if (!Number.isFinite(body.safeMin) || !Number.isFinite(body.safeMax)) {
      setError("Safe min and max are required.");
      return;
    }
    if (body.safeMin >= body.safeMax) {
      setError("Safe min must be less than safe max.");
      return;
    }
    try {
      if (isEdit) await update.mutateAsync({ id: threshold._id, ...body });
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
      title={isEdit ? "Edit threshold" : "New threshold"}
      subtitle="Define what reading values are considered safe, warning, or unsafe."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={pending}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Parameter" required>
            <Select
              value={form.parameter}
              onChange={(e) => setForm({ ...form, parameter: e.target.value })}
              disabled={isEdit}
            >
              {PARAMS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Scope">
            <Select
              value={form.plantId}
              onChange={(e) => setForm({ ...form, plantId: e.target.value })}
              disabled={isEdit}
            >
              <option value="">Global default</option>
              {plants.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Safe range" required>
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="any"
              placeholder="min"
              value={form.safeMin}
              onChange={(e) => setForm({ ...form, safeMin: e.target.value })}
            />
            <Input
              type="number"
              step="any"
              placeholder="max"
              value={form.safeMax}
              onChange={(e) => setForm({ ...form, safeMax: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Warn range" hint="(optional)">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="any"
              placeholder="min"
              value={form.warnMin}
              onChange={(e) => setForm({ ...form, warnMin: e.target.value })}
            />
            <Input
              type="number"
              step="any"
              placeholder="max"
              value={form.warnMax}
              onChange={(e) => setForm({ ...form, warnMax: e.target.value })}
            />
          </div>
        </Field>
        <Field label="Unsafe range" hint="(optional)">
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="any"
              placeholder="min"
              value={form.unsafeMin}
              onChange={(e) => setForm({ ...form, unsafeMin: e.target.value })}
            />
            <Input
              type="number"
              step="any"
              placeholder="max"
              value={form.unsafeMax}
              onChange={(e) => setForm({ ...form, unsafeMax: e.target.value })}
            />
          </div>
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function initForm(t) {
  return {
    plantId: t?.plantId || "",
    parameter: t?.parameter || "pH",
    safeMin: t?.safeMin ?? "",
    safeMax: t?.safeMax ?? "",
    warnMin: t?.warnMin ?? "",
    warnMax: t?.warnMax ?? "",
    unsafeMin: t?.unsafeMin ?? "",
    unsafeMax: t?.unsafeMax ?? ""
  };
}

function ConfirmDeleteModal({ threshold, onClose, onConfirm, loading }) {
  return (
    <Modal
      open={!!threshold}
      onClose={onClose}
      title="Delete threshold?"
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
        Delete the <span className="font-semibold">{threshold?.parameter}</span>{" "}
        {threshold?.plantId ? "override" : "global default"}?
      </p>
    </Modal>
  );
}
