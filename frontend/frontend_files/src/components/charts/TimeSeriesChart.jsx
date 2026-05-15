import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { format } from "date-fns";

const COLORS = {
  pH: "#0e7490",
  turbidity: "#0891b2",
  temperature: "#a16207",
  TDS: "#7c3aed"
};

export function TimeSeriesChart({ data, dataKey, label, unit, threshold, height = 220 }) {
  const points = (data || []).map((p) => ({
    ...p,
    ts: typeof p.ts === "string" ? new Date(p.ts).getTime() : new Date(p.timestamp).getTime(),
    value: pickValue(p, dataKey)
  }));

  if (!points.length) {
    return <div className="text-sm text-slate-500 px-2 py-6 text-center">No data</div>;
  }

  const minVal = Math.min(...points.map((p) => p.value).filter((v) => Number.isFinite(v)));
  const maxVal = Math.max(...points.map((p) => p.value).filter((v) => Number.isFinite(v)));
  const pad = Math.max(0.5, (maxVal - minVal) * 0.15);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
        <XAxis
          dataKey="ts"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v) => format(new Date(v), "MMM d HH:mm")}
          tick={{ fontSize: 11, fill: "#64748b" }}
          minTickGap={40}
        />
        <YAxis
          domain={[Math.min(minVal - pad, threshold?.safeMin ?? minVal - pad), Math.max(maxVal + pad, threshold?.safeMax ?? maxVal + pad)]}
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={48}
          tickFormatter={(v) => (Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(1))}
        />
        {threshold?.safeMin !== undefined && threshold?.safeMax !== undefined ? (
          <ReferenceArea y1={threshold.safeMin} y2={threshold.safeMax} fill="#bbf7d0" fillOpacity={0.25} stroke="none" />
        ) : null}
        <Tooltip
          labelFormatter={(v) => format(new Date(v), "PPp")}
          formatter={(v) => [Number(v).toFixed(2) + (unit ? ` ${unit}` : ""), label]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill={COLORS[dataKey] || "#0e7490"}
          fillOpacity={0.08}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={COLORS[dataKey] || "#0e7490"}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function pickValue(point, key) {
  if (point[key] !== undefined) return Number(point[key]);
  if (point.readings && point.readings[key] !== undefined) return Number(point.readings[key]);
  return null;
}
