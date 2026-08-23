import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileDown, Eye, Loader2, AlertCircle } from "lucide-react";
import { Card, CardHeader } from "../ui/Card.jsx";
import { Select, Field } from "../ui/Input.jsx";
import { Button } from "../ui/Button.jsx";
import { Spinner } from "../ui/Spinner.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Modal } from "../ui/Modal.jsx";
import { DataTable } from "../ui/DataTable.jsx";
import { TimeSeriesChart } from "../charts/TimeSeriesChart.jsx";
import { usePlants } from "../../hooks/usePlants.js";
import { useQualityStats } from "../../hooks/useReports.js";
import { fmtNum } from "../../lib/format.js";
import { api } from "../../lib/api.js";

const RANGES = [
  { value: "24h", label: "Past 24 hours" },
  { value: "7d", label: "Past 7 days" },
  { value: "30d", label: "Past month" },
  { value: "365d", label: "Past 365 days" }
];

const MODES = [
  { value: "aggregate", label: "Average across plants", hint: "One combined mean for every selected plant." },
  { value: "individual", label: "Individual plants", hint: "Each selected plant reported on its own." },
  { value: "comparison", label: "Compare plants", hint: "Selected plants side by side on shared axes." }
];

function statValue(stat, digits = 2) {
  if (!stat || stat.mean === null || stat.mean === undefined) return "—";
  return fmtNum(stat.mean, digits);
}

function StatsTable({ report, stats }) {
  return (
    <DataTable
      dense
      rowKey={(m) => m.key}
      columns={[
        { key: "metric", header: "Metric", render: (m) => <span className="font-medium text-slate-800">{m.label}{m.unit ? ` (${m.unit})` : ""}</span> },
        { key: "mean", header: "Mean", cellClassName: "text-right tabular-nums", render: (m) => statValue(stats[m.key]) },
        { key: "min", header: "Min", cellClassName: "text-right tabular-nums", render: (m) => stats[m.key]?.min != null ? fmtNum(stats[m.key].min, 2) : "—" },
        { key: "max", header: "Max", cellClassName: "text-right tabular-nums", render: (m) => stats[m.key]?.max != null ? fmtNum(stats[m.key].max, 2) : "—" },
        { key: "count", header: "Readings", cellClassName: "text-right tabular-nums", render: (m) => stats[m.key]?.count ?? 0 },
        {
          key: "breach",
          header: "Breach",
          cellClassName: "text-right tabular-nums",
          render: (m) => {
            const pct = stats[m.key]?.breachPct;
            if (pct === null || pct === undefined) return "—";
            return <span className={pct > 0 ? "text-red-600 font-medium" : "text-slate-500"}>{pct}%</span>;
          }
        }
      ]}
      rows={report.metrics}
      empty={<EmptyState title="No metrics" />}
    />
  );
}

function MetricCharts({ report, series, stats }) {
  if (!series?.length) return null;
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
      {report.metrics.map((m) => (
        <Card key={m.key}>
          <CardHeader title={m.label} subtitle={`Bucketed by ${report.range.bucket}`} />
          <TimeSeriesChart
            data={series}
            dataKey={m.key}
            label={m.label}
            unit={m.unit}
            threshold={stats[m.key]?.threshold}
            height={180}
          />
        </Card>
      ))}
    </div>
  );
}

function ReportPreview({ report }) {
  if (report.mode === "aggregate") {
    const empty = report.metrics.every((m) => !report.aggregate.stats[m.key]?.count);
    if (empty) return <EmptyState title="No readings in this period." />;
    return (
      <>
        <StatsTable report={report} stats={report.aggregate.stats} />
        <MetricCharts report={report} series={report.aggregate.series} stats={report.aggregate.stats} />
      </>
    );
  }

  if (!report.perPlant.length) return <EmptyState title="No plants in scope." />;

  if (report.mode === "individual") {
    return (
      <div className="space-y-8">
        {report.perPlant.map((entry) => (
          <div key={entry.plant.id}>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{entry.plant.name}</h3>
            <StatsTable report={report} stats={entry.stats} />
            <MetricCharts report={report} series={entry.series} stats={entry.stats} />
          </div>
        ))}
      </div>
    );
  }

  // Comparison: the per-metric table is the comparison. Overlaid charts need a
  // shared axis per metric, which the document does properly — the preview
  // keeps to the numbers rather than showing a chart the PDF will not match.
  return (
    <div className="space-y-6">
      {report.metrics.map((m) => (
        <div key={m.key}>
          <h3 className="text-sm font-semibold text-slate-900 mb-2">
            {m.label}
            {m.unit ? <span className="font-normal text-slate-500"> ({m.unit})</span> : null}
          </h3>
          <DataTable
            dense
            rowKey={(e) => e.plant.id}
            columns={[
              { key: "plant", header: "Plant", render: (e) => <span className="font-medium text-slate-800">{e.plant.name}</span> },
              { key: "mean", header: "Mean", cellClassName: "text-right tabular-nums", render: (e) => statValue(e.stats[m.key]) },
              { key: "min", header: "Min", cellClassName: "text-right tabular-nums", render: (e) => e.stats[m.key]?.min != null ? fmtNum(e.stats[m.key].min, 2) : "—" },
              { key: "max", header: "Max", cellClassName: "text-right tabular-nums", render: (e) => e.stats[m.key]?.max != null ? fmtNum(e.stats[m.key].max, 2) : "—" },
              { key: "count", header: "Readings", cellClassName: "text-right tabular-nums", render: (e) => e.stats[m.key]?.count ?? 0 },
              {
                key: "breach",
                header: "Breach",
                cellClassName: "text-right tabular-nums",
                render: (e) => {
                  const pct = e.stats[m.key]?.breachPct;
                  if (pct === null || pct === undefined) return "—";
                  return <span className={pct > 0 ? "text-red-600 font-medium" : "text-slate-500"}>{pct}%</span>;
                }
              }
            ]}
            rows={report.perPlant}
            empty={<EmptyState title="No plants" />}
          />
        </div>
      ))}
      <p className="text-xs text-slate-500">
        The generated document overlays every selected plant on one chart per metric.
      </p>
    </div>
  );
}

/**
 * Report builder shared by /admin/reports and the plant detail page.
 *
 * `defaultPlantIds` seeds the selection, which is how a plant page arrives with
 * itself already included while keeping every other option reachable.
 */
export function ReportBuilder({
  defaultPlantIds = [],
  defaultMode = "aggregate",
  defaultRange = "7d",
  lockedPlantId = null
}) {
  const plants = usePlants();
  const [range, setRange] = useState(defaultRange);
  const [mode, setMode] = useState(defaultMode);
  const [selected, setSelected] = useState(() => [...defaultPlantIds]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [viewer, setViewer] = useState(null); // { url, filename }
  const viewerUrl = useRef(null);

  // The seeded plant arrives asynchronously on a deep link, so re-seed if the
  // caller's default changes rather than only on first mount.
  useEffect(() => {
    setSelected((prev) => {
      const missing = defaultPlantIds.filter((id) => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [defaultPlantIds.join(",")]);

  useEffect(() => {
    return () => {
      if (viewerUrl.current) URL.revokeObjectURL(viewerUrl.current);
    };
  }, []);

  const stats = useQualityStats({ plantIds: selected, range, mode });

  const params = useMemo(
    () => ({ plantIds: selected.join(","), range, mode }),
    [selected, range, mode]
  );

  const togglePlant = (id) => {
    if (id === lockedPlantId) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  async function fetchDoc(format, disposition) {
    return api.blob("/api/reports/quality/document", { ...params, format, disposition }, {
      accept:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });
  }

  async function onDownload(format) {
    setBusy(format);
    setError("");
    try {
      const blob = await fetchDoc(format, "attachment");
      const scope = selected.length === 1 ? "plant" : selected.length ? `${selected.length}-plants` : "all-plants";
      api.saveBlob(blob, `waternet-quality-${scope}-${range}.${format}`);
    } catch (err) {
      setError(err.message || `Could not generate the ${format.toUpperCase()}.`);
    } finally {
      setBusy(null);
    }
  }

  async function onView() {
    setBusy("view");
    setError("");
    try {
      const blob = await fetchDoc("pdf", "inline");
      if (viewerUrl.current) URL.revokeObjectURL(viewerUrl.current);
      const url = URL.createObjectURL(blob);
      viewerUrl.current = url;
      setViewer({ url });
    } catch (err) {
      setError(err.message || "Could not render the preview.");
    } finally {
      setBusy(null);
    }
  }

  const modeHint = MODES.find((m) => m.value === mode)?.hint;
  const scopeLabel = selected.length === 0 ? "All plants" : `${selected.length} selected`;

  return (
    <>
      <Card className="mb-4">
        <CardHeader
          title="Generate report"
          subtitle="Water quality statistics as a PDF or Word document."
          action={<FileText size={18} className="text-slate-400" />}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Field label="Time frame">
            <Select value={range} onChange={(e) => setRange(e.target.value)}>
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Report type" hint={modeHint}>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Plants <span className="font-normal text-slate-500">· {scopeLabel}</span>
            </label>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelected((plants.data || []).map((p) => p._id))}
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelected(lockedPlantId ? [lockedPlantId] : [])}
                className="text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
            </div>
          </div>

          {plants.isLoading ? (
            <Spinner />
          ) : (
            <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {(plants.data || []).map((p) => {
                const checked = selected.includes(p._id);
                const locked = p._id === lockedPlantId;
                return (
                  <label
                    key={p._id}
                    className={
                      "flex items-center gap-2.5 px-3 py-2 text-sm " +
                      (locked ? "bg-brand-50/50 cursor-default" : "hover:bg-slate-50 cursor-pointer")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => togglePlant(p._id)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:opacity-60"
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-800">{p.name}</span>
                    {locked ? (
                      <span className="text-[11px] uppercase tracking-wide text-brand-700 font-medium">
                        This plant
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
          <p className="text-xs text-slate-500 mt-1.5">
            {selected.length === 0
              ? "Nothing selected reports on every plant in the network."
              : mode === "comparison" && selected.length < 2
              ? "Pick at least two plants to make a comparison meaningful."
              : `Reporting on ${selected.length} plant${selected.length === 1 ? "" : "s"}.`}
          </p>
        </div>

        {error ? (
          <p className="text-xs text-red-600 mb-3 flex items-center gap-1.5">
            <AlertCircle size={13} /> {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onView} loading={busy === "view"} disabled={!!busy} leftIcon={<Eye size={15} />}>
            View PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDownload("pdf")}
            loading={busy === "pdf"}
            disabled={!!busy}
            leftIcon={<FileDown size={15} />}
          >
            Download PDF
          </Button>
          <Button
            variant="secondary"
            onClick={() => onDownload("docx")}
            loading={busy === "docx"}
            disabled={!!busy}
            leftIcon={<FileDown size={15} />}
          >
            Download DOCX
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Preview"
          subtitle={
            stats.data
              ? `${RANGES.find((r) => r.value === range)?.label} · ${
                  stats.data.scope.allPlants ? "all plants" : `${stats.data.scope.plantCount} plant(s)`
                }`
              : "Loading…"
          }
        />
        {stats.isLoading ? (
          <div className="py-8 grid place-items-center">
            <Spinner label="Crunching readings…" />
          </div>
        ) : stats.isError ? (
          <EmptyState icon={AlertCircle} title="Could not load report stats." />
        ) : stats.data ? (
          <ReportPreview report={stats.data} />
        ) : null}
      </Card>

      <Modal
        open={!!viewer}
        onClose={() => setViewer(null)}
        title="Water quality report"
        subtitle="Rendered PDF"
        size="xl"
      >
        {viewer ? (
          <iframe
            src={viewer.url}
            title="Water quality report"
            className="w-full h-[70vh] rounded-lg border border-slate-200"
          />
        ) : (
          <div className="py-10 grid place-items-center">
            <Loader2 className="animate-spin text-slate-400" />
          </div>
        )}
      </Modal>
    </>
  );
}
