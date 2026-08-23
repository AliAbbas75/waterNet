import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Card, { CardHeader } from "./Card.js";
import Badge from "./Badge.js";
import { colors, font, radii, spacing } from "../lib/theme.js";

/**
 * The day before the alert, as it stood when the alert fired.
 *
 * A maintainer on site needs the shape of the data, not one number. A probe
 * that spiked once and recovered and a probe that has read the same value since
 * yesterday produce the same breach and need completely different visits — only
 * the series tells them apart, and out here there is no second screen to go and
 * check it on.
 */
export default function MetricsWindow({ task }) {
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
      />

      {!w.readingCount ? (
        <View style={styles.emptyBox}>
          <Ionicons name="cloud-offline" size={16} color={colors.warn} />
          <Text style={styles.emptyText}>
            Nothing reported in the {w.windowHours} hours before this alert. For an offline
            device that is the finding, not a gap in the record.
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          {w.parameters.map((p) => (
            <Parameter key={p.key} param={p} series={w.series} />
          ))}
        </View>
      )}
    </Card>
  );
}

function Parameter({ param, series }) {
  return (
    <View style={styles.param}>
      <View style={styles.paramHead}>
        <Text style={styles.paramLabel}>
          {param.label}
          {param.unit ? <Text style={styles.unit}> {param.unit}</Text> : null}
        </Text>
        <View style={styles.badges}>
          {param.flat ? <Badge status="WARN">stuck</Badge> : null}
          {param.breached ? <Badge status="UNSAFE">out of range</Badge> : null}
        </View>
      </View>

      <Sparkline series={series} dataKey={param.key} breached={param.breached} />

      <View style={styles.stats}>
        {[
          ["min", param.min],
          ["avg", param.avg],
          ["max", param.max],
          ["latest", param.latest]
        ].map(([label, value]) => (
          <View key={label} style={styles.stat}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>{value ?? "—"}</Text>
          </View>
        ))}
      </View>

      {param.safeMin !== null && param.safeMax !== null ? (
        <Text style={styles.safeRange}>
          safe {param.safeMin} – {param.safeMax}
          {param.flat ? " · one value all day, treat these with suspicion" : ""}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Hourly averages as bars, drawn with plain Views.
 *
 * No charting library on purpose — this is one small sparkline on a screen a
 * maintainer opens in the field, and pulling in a chart engine to draw twenty
 * rectangles costs bundle size and start-up time for nothing.
 */
function Sparkline({ series, dataKey, breached }) {
  const values = series.map((b) => b[dataKey]).filter((v) => v !== null && v !== undefined);
  if (values.length < 2) {
    return <Text style={styles.tooFew}>Not enough hours to plot</Text>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return (
    <View style={styles.spark}>
      {series.map((b, i) => {
        const v = b[dataKey];
        if (v === null || v === undefined) {
          return <View key={i} style={[styles.bar, styles.barMissing]} />;
        }
        // Floored so a flat series reads as a line rather than disappearing.
        const pct = Math.max(8, ((v - min) / span) * 100);
        return (
          <View
            key={i}
            style={[
              styles.bar,
              { height: `${pct}%`, backgroundColor: breached ? colors.unsafe : colors.brand500 }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.warnBg
  },
  emptyText: { flex: 1, color: colors.warn, fontSize: font.sizes.sm, lineHeight: 18 },

  param: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md
  },
  paramHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  paramLabel: { fontSize: font.sizes.md, fontWeight: "600", color: colors.text },
  unit: { fontSize: font.sizes.xs, color: colors.textSubtle, fontWeight: "400" },
  badges: { flexDirection: "row", gap: 6 },

  spark: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 40,
    gap: 2,
    marginTop: spacing.sm
  },
  bar: { flex: 1, borderRadius: 2 },
  barMissing: { height: 2, backgroundColor: colors.border },
  tooFew: { marginTop: spacing.sm, fontSize: font.sizes.xs, color: colors.textSubtle },

  stats: { flexDirection: "row", marginTop: spacing.sm },
  stat: { flex: 1, alignItems: "center" },
  statLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.textSubtle
  },
  statValue: { fontSize: font.sizes.sm, color: colors.text, marginTop: 2 },

  safeRange: { marginTop: 6, fontSize: font.sizes.xs, color: colors.textSubtle }
});
