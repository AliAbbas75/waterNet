import { useMemo, useState } from "react";
import { Package, Pencil, Plus, Search, Trash2, AlertTriangle } from "lucide-react";
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
  useCreateInventoryItem,
  useDeleteInventoryItem,
  useInventory,
  useUpdateInventoryItem
} from "../../hooks/useInventory.js";

export default function InventoryPage() {
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filters = useMemo(() => ({ category, status, lowStock }), [category, status, lowStock]);
  const { data: items, isLoading } = useInventory(filters);
  const del = useDeleteInventoryItem();

  const filtered = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [items, search]);

  const categories = useMemo(
    () => Array.from(new Set((items || []).map((i) => i.category))).sort(),
    [items]
  );

  const lowStockCount = (items || []).filter((i) => i.quantity < i.reorderThreshold).length;

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Item",
        render: (i) => (
          <div className="min-w-0">
            <div className="font-medium text-slate-900 truncate">{i.name}</div>
            <div className="text-xs text-slate-500 capitalize">{i.category}</div>
          </div>
        )
      },
      {
        key: "quantity",
        header: "On hand",
        render: (i) => (
          <div className="flex items-center gap-2">
            <span
              className={
                i.quantity < i.reorderThreshold ? "text-red-600 font-semibold" : "text-slate-800 font-medium"
              }
            >
              {i.quantity}
            </span>
            <span className="text-xs text-slate-500">{i.unit}</span>
            {i.quantity < i.reorderThreshold ? (
              <Badge variant="unsafe" dot>
                Low
              </Badge>
            ) : null}
          </div>
        )
      },
      {
        key: "reorder",
        header: "Reorder at",
        render: (i) => (
          <span className="text-sm text-slate-700">
            {i.reorderThreshold} {i.unit}
          </span>
        )
      },
      {
        key: "status",
        header: "Status",
        render: (i) => (
          <Badge variant={statusVariant(i.status)} dot>
            {i.status}
          </Badge>
        )
      },
      {
        key: "actions",
        header: "",
        cellClassName: "text-right",
        render: (i) => (
          <div className="inline-flex items-center gap-1">
            <button
              onClick={() => setEditing(i)}
              className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              title="Edit"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setConfirmDelete(i)}
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
        title="Inventory"
        description="Devices, sensors, filters and tools tracked across the network."
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setEditing({})}>
            New item
          </Button>
        }
      />

      {lowStockCount > 0 ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-900">
              {lowStockCount} item{lowStockCount > 1 ? "s" : ""} below reorder threshold
            </p>
            <p className="text-amber-800">Low-stock alerts have been generated automatically.</p>
          </div>
        </div>
      ) : null}

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="INSTALLED">Installed</option>
            <option value="FAULTY">Faulty</option>
            <option value="MAINTENANCE">Maintenance</option>
          </Select>
          <Select value={lowStock} onChange={(e) => setLowStock(e.target.value)}>
            <option value="">All items</option>
            <option value="true">Low stock only</option>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading inventory…" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          empty={<EmptyState icon={Package} title="No inventory yet" />}
        />
      )}

      <ItemFormModal
        open={editing !== null}
        item={editing && editing._id ? editing : null}
        onClose={() => setEditing(null)}
      />
      <ConfirmDeleteModal
        item={confirmDelete}
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

function ItemFormModal({ open, item, onClose }) {
  const isEdit = !!item;
  const create = useCreateInventoryItem();
  const update = useUpdateInventoryItem();
  const [form, setForm] = useState(initForm(item));
  const [error, setError] = useState("");

  useMemo(() => setForm(initForm(item)), [item, open]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const body = {
      name: form.name.trim(),
      category: form.category.trim(),
      quantity: Number(form.quantity),
      reorderThreshold: Number(form.reorderThreshold),
      status: form.status,
      unit: form.unit.trim() || "pieces"
    };
    if (!body.name || !body.category || !Number.isFinite(body.quantity)) {
      setError("Name, category and quantity are required.");
      return;
    }
    try {
      if (isEdit) await update.mutateAsync({ id: item._id, ...body });
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
      title={isEdit ? "Edit item" : "New item"}
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
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required hint="(sensor, filter, device, tool, consumable)">
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </Field>
          <Field label="Unit">
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="pieces" />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity" required>
            <Input
              type="number"
              min={0}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </Field>
          <Field label="Reorder at">
            <Input
              type="number"
              min={0}
              value={form.reorderThreshold}
              onChange={(e) => setForm({ ...form, reorderThreshold: e.target.value })}
            />
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}

function initForm(item) {
  return {
    name: item?.name || "",
    category: item?.category || "sensor",
    quantity: item?.quantity ?? 0,
    reorderThreshold: item?.reorderThreshold ?? 0,
    status: item?.status || "AVAILABLE",
    unit: item?.unit || "pieces"
  };
}

function ConfirmDeleteModal({ item, onClose, onConfirm, loading }) {
  return (
    <Modal
      open={!!item}
      onClose={onClose}
      title="Delete inventory item?"
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
        Delete <span className="font-semibold">{item?.name}</span>?
      </p>
    </Modal>
  );
}
