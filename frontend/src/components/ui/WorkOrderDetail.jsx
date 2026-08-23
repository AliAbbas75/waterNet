import { AlertTriangle, ClipboardCheck, Microscope } from "lucide-react";
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
