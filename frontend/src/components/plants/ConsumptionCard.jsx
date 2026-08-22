import { Droplets, TrendingDown, AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { EmptyState } from "../ui/EmptyState.jsx";
import { Spinner } from "../ui/Spinner.jsx";
import { fmtNum, relTime } from "../../lib/format.js";

export function consumptionVariant(status) {
  switch (status) {
    case "WARNING":
      return "warn";
    case "OK":
      return "safe";
    default:
      return "muted";
  }
}

export function consumptionLabel(status) {
  switch (status) {
    case "WARNING":
      return "Low water";
    case "OK":
      return "Healthy";
    default:
      return "No data";
  }
}

/** Compact badge for list rows and page headers. */
export function ConsumptionBadge({ consumption }) {
  if (!consumption?.hasData) return <Badge variant="muted" dot>No flow data</Badge>;
  return (
    <Badge variant={consumptionVariant(consumption.status)} dot>
      {consumptionLabel(consumption.status)} · {fmtNum(consumption.tankRemainingLitres, 0)} L
    </Badge>
  );
}

export function ConsumptionCard({ query }) {
  const c = query?.data;

  if (query?.isLoading) {
    return (
      <Card>
        <CardHeader title="Water consumption" />
        <Spinner />
      </Card>
    );
  }

  if (!c?.hasData) {
    return (
      <Card>
        <CardHeader title="Water consumption" subtitle="Today" />
        <EmptyState
          icon={Droplets}
          title="No flow data yet"
          description="Consumption appears once devices at this plant report totalLitres."
        />
      </Card>
    );
  }

  const pct = Math.max(0, Math.min(100, c.percentRemaining));
  const barColor = c.status === "WARNING" ? "bg-amber-500" : "bg-brand-500";

  return (
    <Card>
      <CardHeader
        title="Water consumption"
        subtitle={`Today · resets midnight (${c.timezone})`}
        action={<ConsumptionBadge consumption={c} />}
      />

      {c.status === "WARNING" ? (
        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-inset ring-amber-200"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            Only {fmtNum(c.tankRemainingLitres, 0)} L left in the tank, below the{" "}
            {fmtNum(c.warningThresholdLitres, 0)} L warning level.
          </span>
        </div>
      ) : null}

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-slate-900">
          {fmtNum(c.tankRemainingLitres, 0)}
          <span className="ml-1 text-sm font-normal text-slate-500">
            / {fmtNum(c.tankCapacityLitres, 0)} L remaining
          </span>
        </span>
        <span className="text-sm text-slate-500">{fmtNum(pct, 0)}%</span>
      </div>
      {c.refillsToday > 0 ? (
        <p className="mb-1 text-xs text-slate-500">
          Refilled {c.refillsToday}× today — draw has exceeded a full tank
        </p>
      ) : null}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-slate-500">
            <TrendingDown size={14} /> Consumed today
          </dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {fmtNum(c.consumedTodayLitres, 1)} <span className="text-xs font-normal text-slate-500">L</span>
          </dd>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <dt className="flex items-center gap-1.5 text-slate-500">
            <Droplets size={14} /> Lifetime daily avg
          </dt>
          <dd className="mt-0.5 font-medium text-slate-900">
            {c.averageDailyConsumptionLitres == null ? (
              <span className="text-slate-400">—</span>
            ) : (
              <>
                {fmtNum(c.averageDailyConsumptionLitres, 1)}{" "}
                <span className="text-xs font-normal text-slate-500">L/day</span>
              </>
            )}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        {c.daysObserved > 0
          ? `Averaged over ${c.daysObserved} complete day${c.daysObserved === 1 ? "" : "s"} · ${fmtNum(
              c.lifetimeConsumptionLitres,
              0
            )} L lifetime`
          : "Not enough history yet for a daily average"}
        {c.lastReadingAt ? ` · updated ${relTime(c.lastReadingAt)}` : ""}
      </p>
    </Card>
  );
}
