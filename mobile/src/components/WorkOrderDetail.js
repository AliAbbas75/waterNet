import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Card, { CardHeader } from "./Card.js";
import Badge from "./Badge.js";
import { colors, font, radii, spacing } from "../lib/theme.js";

/**
 * The evidence the alert carried onto the work order — readings at the moment
 * of the breach, when a device was last heard from, how many times it flapped.
 *
 * Captured at raise time rather than looked up now: "silent for 41 minutes" is
 * a fact about when the alert fired, and a live lookup an hour later answers a
 * different question.
 */
export function Diagnostics({ task }) {
  if (!task?.diagnostics?.length) return null;

  return (
    <Card>
      <CardHeader title="What the system saw" subtitle="Recorded when the alert was raised" />
      <View style={styles.rows}>
        {task.diagnostics.map((d, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowDivided]}>
            <Text style={styles.rowLabel}>{d.label}</Text>
            <Text style={styles.rowValue}>{d.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/**
 * The procedure for this kind of fault, and the only way to close the ticket.
 *
 * The server refuses to resolve a task while any step is outstanding, so this
 * screen not showing them meant a maintainer could be handed a safety-critical
 * work order on a phone and have no way to finish it.
 *
 * `onToggle` being absent is what makes it read-only — someone ticking off a
 * site visit they did not make is exactly the record worth not producing.
 */
export function Checklist({ task, onToggle, pendingIndex = null, canEdit = false }) {
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
      />

      <View style={{ gap: 6 }}>
        {task.checklist.map((item, index) => {
          const busy = pendingIndex === index;
          const body = (
            <View style={[styles.item, item.done && styles.itemDone]}>
              <View style={[styles.box, item.done && styles.boxDone]}>
                {busy ? (
                  <ActivityIndicator size="small" color={item.done ? "#fff" : colors.textMuted} />
                ) : item.done ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : null}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.itemLabel, item.done && styles.itemLabelDone]}>
                  {item.label}
                </Text>

                {/* A step that changes the world says so before it is ticked. */}
                {item.effect === "CLOSE_PLANT" ? (
                  <View style={styles.effectRow}>
                    <Ionicons name="warning" size={11} color={colors.unsafe} />
                    <Text style={styles.effectText}>
                      Ticking this closes the plant to the public
                    </Text>
                  </View>
                ) : null}

                {item.done && item.completedByUserId ? (
                  <Text style={styles.itemBy}>
                    {item.completedByUserId.display_name || "Completed"}
                  </Text>
                ) : null}
              </View>
            </View>
          );

          if (!canEdit) return <View key={index}>{body}</View>;
          return (
            <Pressable
              key={index}
              onPress={() => onToggle(index, !item.done)}
              disabled={busy}
              android_ripple={{ color: colors.border }}
              style={({ pressed }) => [pressed && { opacity: 0.7 }, busy && { opacity: 0.5 }]}
            >
              {body}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tally}>
        <Badge status={complete ? "SAFE" : "WARN"}>
          {done}/{total}
        </Badge>
        {!canEdit ? (
          <Text style={styles.readOnly}>Only the assigned maintainer can tick these off.</Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rows: { marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 7
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { fontSize: font.sizes.xs, color: colors.textMuted, flexShrink: 0 },
  rowValue: {
    fontSize: font.sizes.sm,
    color: colors.text,
    textAlign: "right",
    flexShrink: 1,
    fontVariant: ["tabular-nums"]
  },

  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg
  },
  itemDone: { backgroundColor: colors.safeBg },
  box: {
    marginTop: 1,
    height: 20,
    width: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center"
  },
  boxDone: { backgroundColor: colors.safe, borderColor: colors.safe },
  itemLabel: { fontSize: font.sizes.sm, color: colors.text, lineHeight: 19 },
  itemLabelDone: { color: colors.textMuted, textDecorationLine: "line-through" },
  effectRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  effectText: { fontSize: font.sizes.xs, color: colors.unsafe, fontWeight: "600", flex: 1 },
  itemBy: { fontSize: font.sizes.xs, color: colors.textSubtle, marginTop: 2 },

  tally: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  readOnly: { fontSize: font.sizes.xs, color: colors.textSubtle, flex: 1 }
});
