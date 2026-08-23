import { useMemo, useState } from "react";
import { Package, PackageX, Search, TrendingDown } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader.jsx";
import { Card } from "../../components/ui/Card.jsx";
import { Stat } from "../../components/ui/Stat.jsx";
import { Input, Select } from "../../components/ui/Input.jsx";
import { Badge } from "../../components/ui/Badge.jsx";
import { Spinner } from "../../components/ui/Spinner.jsx";
import { EmptyState } from "../../components/ui/EmptyState.jsx";
import { useInventory } from "../../hooks/useInventory.js";

const CATEGORY_LABEL = {
  sensor: "Sensors",
  device: "Devices",
  filter: "Filters",
  consumable: "Consumables",
  tool: "Tools"
};

/**
 * A manager's read-only view of the shelf their restocking work orders are
 * about. Deliberately not the admin inventory page: showing Add and Delete
 * buttons that would come back 403 is worse than not showing them at all.
 */
export default function StockPage() {
  const items = useInventory();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items.data || [])
      .filter((i) => (category ? i.category === category : true))
      .filter((i) => (q ? i.name.toLowerCase().includes(q) : true))
      .sort((a, b) => shortfall(b) - shortfall(a) || a.name.localeCompare(b.name));
  }, [items.data, search, category]);

  const low = (items.data || []).filter((i) => i.quantity <= i.reorderThreshold);
  const out = (items.data || []).filter((i) => i.quantity === 0);

  return (
    <>
      <PageHeader
        title="Stock"
        description="What is on the shelf, and what needs ordering. Read-only — stock levels are changed by an admin."
        action={<Package size={20} className="text-slate-400" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Items tracked" value={items.data?.length ?? "—"} icon={Package} accent="brand" />
        <Stat
          label="At or below reorder point"
          value={low.length}
          icon={TrendingDown}
          accent={low.length ? "warn" : "safe"}
        />
        <Stat
          label="Out of stock"
          value={out.length}
          icon={PackageX}
          accent={out.length ? "unsafe" : "safe"}
        />
      </div>

      <Card className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            placeholder="Search stock…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {items.isLoading ? (
        <div className="py-12 grid place-items-center">
          <Spinner label="Loading stock…" />
        </div>
      ) : !rows.length ? (
        <Card>
          <EmptyState icon={Package} title="Nothing here" description="No stock matches those filters." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((item) => (
            <StockCard key={item._id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

function shortfall(item) {
  return Math.max(0, (item.reorderThreshold || 0) - (item.quantity || 0));
}

function StockCard({ item }) {
  const short = shortfall(item);
  const isOut = item.quantity === 0;
  const isLow = item.quantity <= item.reorderThreshold;

  // Bar is read against the reorder point, not an imagined capacity: "how far
  // below the line am I" is the number that decides whether to order.
  const target = Math.max(item.reorderThreshold * 2, item.quantity, 1);
  const pct = Math.min(100, Math.round((item.quantity / target) * 100));
  const markerPct = Math.min(100, Math.round((item.reorderThreshold / target) * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
          <p className="text-xs text-slate-500">{CATEGORY_LABEL[item.category] || item.category}</p>
        </div>
        {isOut ? (
          <Badge variant="unsafe" dot>
            Out of stock
          </Badge>
        ) : isLow ? (
          <Badge variant="warn" dot>
            Reorder
          </Badge>
        ) : (
          <Badge variant="safe" dot>
            In stock
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold text-slate-900 tabular-nums">{item.quantity}</span>
        <span className="text-xs text-slate-500">{item.unit || "units"}</span>
      </div>

      <div className="relative mt-2 h-1.5 rounded-full bg-slate-100">
        <div
          className={
            "h-1.5 rounded-full " +
            (isOut ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500")
          }
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute -top-0.5 h-2.5 w-px bg-slate-400"
          style={{ left: `${markerPct}%` }}
          title={`Reorder point: ${item.reorderThreshold}`}
        />
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Reorder point {item.reorderThreshold}
        {short ? <span className="text-amber-700"> · {short} short</span> : null}
      </p>
    </div>
  );
}
