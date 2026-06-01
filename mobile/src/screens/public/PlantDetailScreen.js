import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";

import Badge from "../../components/Badge.js";
import Button from "../../components/Button.js";
import Card, { CardHeader } from "../../components/Card.js";
import EmptyState from "../../components/EmptyState.js";
import Spinner from "../../components/Spinner.js";
import { usePublicPlantStatus } from "../../hooks/usePublic.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";
import { fmtNum, relTime } from "../../lib/format.js";

const PARAMS = [
  { key: "pH", label: "pH", unit: "" },
  { key: "turbidity", label: "Turbidity", unit: "NTU" },
  { key: "temperature", label: "Temperature", unit: "°C" },
  { key: "TDS", label: "TDS", unit: "ppm" }
];

export default function PlantDetailScreen() {
  const { id } = useRoute().params || {};
  const status = usePublicPlantStatus(id);
  const navigation = useNavigation();

  if (status.isLoading) return <Spinner label="Loading plant…" fullscreen />;
  if (status.error || !status.data?.plant) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <EmptyState title="Plant not found" />
      </View>
    );
  }

  const { plant, overall, available, devices, readings } = status.data;
  const latest = aggregateLatest(readings);
  const lastTs = latestTimestamp(readings);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View>
        <Text style={styles.title}>{plant.name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location" size={14} color={colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={2}>
            {plant.address}
          </Text>
        </View>
        {plant.operatingHours ? (
          <View style={styles.metaRow}>
            <Ionicons name="time" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{plant.operatingHours}</Text>
          </View>
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" }}>
          <Badge status={overall === "NO_DATA" ? "INFO" : overall}>
            {overall === "NO_DATA" ? "NO DATA" : overall}
          </Badge>
          <Badge status={available ? "SAFE" : "UNSAFE"}>
            {available ? "Water flowing" : "Currently offline"}
          </Badge>
        </View>
      </View>

      <Card>
        <CardHeader
          title="Current readings"
          subtitle={lastTs ? `Last update ${relTime(lastTs)}` : "Awaiting telemetry"}
        />
        {Object.keys(latest).length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>No live readings yet.</Text>
        ) : (
          <View style={styles.grid}>
            {PARAMS.map((p) => (
              <View key={p.key} style={styles.tile}>
                <Text style={styles.tileLabel}>{p.label}</Text>
                <Text style={styles.tileValue}>
                  {latest[p.key] != null ? fmtNum(latest[p.key], 2) : "—"}
                  {latest[p.key] != null && p.unit ? (
                    <Text style={styles.tileUnit}>  {p.unit}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card>
        <CardHeader title="Devices" subtitle={`${devices?.length || 0} installed`} />
        {!devices?.length ? (
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>No devices reporting yet.</Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {devices.map((d) => (
              <View key={d._id} style={styles.deviceRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.deviceId}>{d.deviceId}</Text>
                  <Text style={styles.deviceMeta}>
                    {d.lastSeenAt ? `Seen ${relTime(d.lastSeenAt)}` : "Never seen"}
                  </Text>
                </View>
                <Badge status={d.availability === "AVAILABLE" ? "SAFE" : "UNSAFE"}>
                  {d.availability === "AVAILABLE" ? "Online" : "Offline"}
                </Badge>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ backgroundColor: colors.brand50, borderColor: colors.brand100 }}>
        <Text style={{ color: colors.brand900, fontWeight: "600", fontSize: font.sizes.md }}>
          Notice an issue?
        </Text>
        <Text style={{ color: colors.brand800, fontSize: font.sizes.sm, marginTop: 4, marginBottom: spacing.md }}>
          Strange taste, no water, broken display? Let the operations team know.
        </Text>
        <Button
          leftIcon={<Ionicons name="chatbubble-ellipses" size={16} color="#fff" />}
          onPress={() =>
            navigation.navigate("PublicHome", {
              screen: "Report",
              params: { plantId: plant._id, plantName: plant.name }
            })
          }
        >
          Report an issue
        </Button>
      </Card>
    </ScrollView>
  );
}

function aggregateLatest(readings) {
  if (!readings) return {};
  const sums = {};
  const counts = {};
  Object.values(readings).forEach((r) => {
    if (!r?.readings) return;
    for (const k of ["pH", "turbidity", "temperature", "TDS"]) {
      if (typeof r.readings[k] === "number") {
        sums[k] = (sums[k] || 0) + r.readings[k];
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  });
  const out = {};
  for (const k of Object.keys(sums)) out[k] = sums[k] / counts[k];
  return out;
}

function latestTimestamp(readings) {
  if (!readings) return null;
  let max = null;
  Object.values(readings).forEach((r) => {
    if (r?.timestamp) {
      const t = new Date(r.timestamp).getTime();
      if (!max || t > max) max = t;
    }
  });
  return max ? new Date(max).toISOString() : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.sizes.xl, fontWeight: "700", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaText: { fontSize: font.sizes.sm, color: colors.textMuted, flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    flexBasis: "48%",
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  tileLabel: {
    fontSize: font.sizes.xs,
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  tileValue: { fontSize: font.sizes.xl, fontWeight: "700", color: colors.text, marginTop: 4 },
  tileUnit: { fontSize: font.sizes.sm, fontWeight: "400", color: colors.textMuted },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border
  },
  deviceId: { color: colors.text, fontWeight: "600" },
  deviceMeta: { color: colors.textMuted, fontSize: font.sizes.xs, marginTop: 2 }
});
