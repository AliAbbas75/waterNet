import { Activity, AlertTriangle, ClipboardCheck, Microscope } from "lucide-react";
import { Card, CardHeader } from "./Card.jsx";
import { Badge } from "./Badge.jsx";

/**
 * The evidence the alert carried onto the work order — readings at the moment
 * of the breach, when a device was last heard from, how many times it flapped.
 *
 * Captured at raise time rather than looked up now: "silent for 41 minutes" is
 * a fact about when the alert fired, and a live lookup an hour later answers a
 * different question.
 */
export function DiagnosticsCard({ task }) {
  if (!task?.diagnostics?.length) return null;

  return (
    <Card>
      <CardHeader
        title="What the system saw"
        subtitle="Recorded when the alert was raised"
        action={<Microscope size={16} className="text-slate-400" />}
      />
      <dl className="divide-y divide-slate-100">
        {task.diagnostics.map((d, i) => (
          <div key={i} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="text-xs text-slate-500 shrink-0">{d.label}</dt>
            <dd className="text-sm text-slate-800 text-right break-words font-mono text-[13px]">
              {d.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/**
 * The procedure for this kind of fault.
 *
 * Read-only for an admin watching progress; interactive for the maintainer who
 * holds the task. `onToggle` being absent is what makes it read-only — an admin
 * ticking off a site visit they did not make is exactly the record we are
 * trying not to produce.
 */
export function ChecklistCard({ task, onToggle, pending, canEdit = false }) {
  if (!task?.checklist?.length) return null;

  const done = task.checklist.filter((c) => c.done).length;
  const total = task.checklist.length;
  const complete = done === total;

  return (
    <Card>
      <CardHeader
        title="Required steps"
        subtitle={
          complete ? "All steps complete" : `${done} of ${total} done — all required to resolve`
        }
        action={
          <Badge variant={complete ? "safe" : "warn"} dot>
            {done}/{total}
          </Badge>
        }
      />

      <ul className="space-y-1.5">
        {task.checklist.map((item, index) => {
          const busy = pending === index;
          const Row = canEdit ? "button" : "div";
          return (
            <li key={index}>
              <Row
                {...(canEdit
                  ? {
                      type: "button",
                      onClick: () => onToggle(index, !item.done),
                      disabled: busy
                    }
                  : {})}
                className={
                  "w-full flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors " +
                  (canEdit ? "hover:bg-slate-50 disabled:opacity-50 cursor-pointer " : "") +
                  (item.done ? "bg-emerald-50/60" : "")
                }
              >
                <span
                  className={
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border " +
                    (item.done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white")
                  }
                  aria-hidden="true"
                >
                  {item.done ? <ClipboardCheck size={11} /> : null}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={
                      "block text-sm " +
                      (item.done ? "text-slate-500 line-through" : "text-slate-800")
                    }
                  >
                    {item.label}
                  </span>

                  {/* A step that changes the world says so before it is ticked. */}
                  {item.effect === "CLOSE_PLANT" ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-red-700">
                      <AlertTriangle size={11} />
                      Ticking this closes the plant to the public
                    </span>
                  ) : null}

                  {item.done && item.completedByUserId ? (
                    <span className="block text-[11px] text-slate-400">
                      {item.completedByUserId.display_name || "Completed"}
                    </span>
                  ) : null}
                </span>
              </Row>
            </li>
          );
        })}
      </ul>

      {!canEdit ? (
        <p className="mt-3 text-xs text-slate-400">
          Only the assigned maintainer can tick these off.
        </p>
      ) : null}
    </Card>
  );
}

/**
 * The day before the alert, as it stood when the alert fired.
 *
 * Point-in-time values say what broke; this says what it was doing beforehand.
 * A probe that spiked once and recovered and a probe that has read the same
 * number since yesterday produce the same breach value and need completely
 * different visits.
 */
export function MetricsWindowCard({ task }) {
  const w = task?.metricsWindow;
  if (!w) return null;

  return (
    <Card>
      <CardHeader
        title={`Last ${w.windowHours} hours`}
        subtitle={
          w.readingCount
            ? `${w.readingCount.toLocaleString()} readings before the alert`
            : w.note || "No telemetry"
        }
        action={<Activity size={16} className="text-slate-400" />}
      />

      {!w.readingCount ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
          Nothing was reported in the {w.windowHours} hours before this alert — which for an
          offline device is the finding, not a gap in the record.
        </p>
      ) : (
        <div className="space-y-3">
          {w.parameters.map((p) => (
            <div key={p.key} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-900">
                  {p.label}
                  {p.unit ? <span className="ml-1 text-xs text-slate-400">{p.unit}</span> : null}
                </span>
                <span className="inline-flex gap-1.5">
                  {p.flat ? (
                    <Badge variant="warn">stuck</Badge>
                  ) : null}
                  {p.breached ? <Badge variant="unsafe">out of range</Badge> : null}
                </span>
              </div>

              <Sparkline series={w.series} dataKey={p.key} breached={p.breached} />

              <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
                {[
                  ["min", p.min],
                  ["avg", p.avg],
                  ["max", p.max],
                  ["latest", p.latest]
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
                    <dd className="text-sm text-slate-800 tabular-nums">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              {p.safeMin !== null && p.safeMax !== null ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  safe range {p.safeMin} – {p.safeMax}
                  {p.flat ? " · one value all day, treat these numbers with suspicion" : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Hourly averages as bars. Enough to see a spike, a drift or a flat line. */
function Sparkline({ series, dataKey, breached }) {
  const values = series.map((b) => b[dataKey]).filter((v) => v !== null && v !== undefined);
  if (values.length < 2) {
    return <p className="mt-2 text-[11px] text-slate-400">Not enough hours to plot</p>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <div className="mt-2 flex h-10 items-end gap-px" aria-hidden="true">
      {series.map((b, i) => {
        const v = b[dataKey];
        if (v === null || v === undefined) {
          return <span key={i} className="flex-1 rounded-sm bg-slate-100" style={{ height: "2px" }} />;
        }
        // Floor at 8% so a flat series reads as a line rather than vanishing.
        const pct = Math.max(8, ((v - min) / span) * 100);
        return (
          <span
            key={i}
            title={`${b.ts.slice(11, 16)} · ${v}`}
            className={"flex-1 rounded-sm " + (breached ? "bg-red-300" : "bg-brand-300")}
            style={{ height: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
