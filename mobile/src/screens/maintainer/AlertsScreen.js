import { useMemo, useState } from "react";
import { Alert as RNAlert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import Badge from "../../components/Badge.js";
import Button from "../../components/Button.js";
import EmptyState from "../../components/EmptyState.js";
import Spinner from "../../components/Spinner.js";
import { useAckAlert, useAlerts } from "../../hooks/useAlerts.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";
import { relTime } from "../../lib/format.js";

const FILTERS = [
  { key: "OPEN", label: "Open" },
  { key: "ACK", label: "Acknowledged" },
  { key: "RESOLVED", label: "Resolved" }
];

export default function MaintainerAlertsScreen() {
  const [status, setStatus] = useState("OPEN");
  const filters = useMemo(() => ({ status }), [status]);
  const alerts = useAlerts(filters);
  const ack = useAckAlert();

  function onAck(id) {
    ack.mutate(id, {
      onError: (err) => RNAlert.alert("Could not acknowledge", err?.message || "")
    });
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatus(f.key)}
            style={[
              styles.pill,
              status === f.key && {
                backgroundColor: colors.brand600,
                borderColor: colors.brand600
              }
            ]}
          >
            <Text style={[styles.pillText, status === f.key && { color: "#fff" }]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      {alerts.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Spinner label="Loading alerts…" />
        </View>
      ) : (
        <FlatList
          data={alerts.data || []}
          keyExtractor={(a) => a._id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl refreshing={alerts.isFetching && !alerts.isLoading} onRefresh={alerts.refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="✓"
              title="No alerts in this view"
              description="All clear right now."
            />
          }
          renderItem={({ item: a }) => (
            <View style={styles.card}>
              <View style={styles.iconCircle(a.severity)}>
                <Ionicons name="warning" size={18} color={iconColor(a.severity)} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.cardHeader}>
                  <Badge status={a.severity}>{a.severity}</Badge>
                  <Badge status={a.status}>{a.status}</Badge>
                  <Text style={styles.time}>{relTime(a.createdAt)}</Text>
                </View>
                <Text style={styles.message} numberOfLines={2}>
                  {a.message}
                </Text>
                <Text style={styles.location} numberOfLines={1}>
                  {[a.plantId?.name, a.deviceId?.deviceId, a.inventoryItemId?.name]
                    .filter(Boolean)
                    .join("  •  ") || "—"}
                </Text>
                {a.status === "OPEN" ? (
                  <View style={{ marginTop: spacing.sm, alignSelf: "flex-start" }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => onAck(a._id)}
                      loading={ack.isPending && ack.variables === a._id}
                      leftIcon={<Ionicons name="checkmark" size={14} color={colors.text} />}
                    >
                      Acknowledge
                    </Button>
                  </View>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function iconColor(severity) {
  if (severity === "CRITICAL") return colors.unsafe;
  if (severity === "WARN") return colors.warn;
  return colors.info;
}

function iconBg(severity) {
  if (severity === "CRITICAL") return colors.unsafeBg;
  if (severity === "WARN") return colors.warnBg;
  return colors.infoBg;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: 0
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  pillText: { fontSize: font.sizes.sm, fontWeight: "600", color: colors.textMuted },
  card: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border
  },
  iconCircle: (severity) => ({
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: iconBg(severity),
    alignItems: "center",
    justifyContent: "center"
  }),
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap"
  },
  time: { fontSize: font.sizes.xs, color: colors.textMuted },
  message: { color: colors.text, fontWeight: "600", marginTop: 6 },
  location: { color: colors.textMuted, fontSize: font.sizes.xs, marginTop: 2 }
});
