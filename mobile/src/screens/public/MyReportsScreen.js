import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Badge from "../../components/Badge.js";
import Card from "../../components/Card.js";
import EmptyState from "../../components/EmptyState.js";
import Spinner from "../../components/Spinner.js";
import { useMyReports } from "../../hooks/usePublic.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";
import { fmtDate, relTime } from "../../lib/format.js";

const CATEGORY_LABEL = {
  QUALITY: "Quality",
  AVAILABILITY: "Availability",
  DEVICE: "Device",
  OTHER: "Other"
};

export default function MyReportsScreen() {
  const reports = useMyReports();

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <FlatList
        data={reports.data || []}
        keyExtractor={(r) => r._id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={styles.title}>My reports</Text>
            <Text style={styles.subtitle}>Issues you've submitted to the operations team.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={reports.isFetching && !reports.isLoading}
            onRefresh={reports.refetch}
          />
        }
        ListEmptyComponent={
          reports.isLoading ? (
            <View style={{ alignItems: "center", paddingVertical: spacing.xxxl }}>
              <Spinner label="Loading…" />
            </View>
          ) : (
            <EmptyState
              icon="📝"
              title="No reports yet"
              description="When you submit an issue, it'll appear here so you can track its progress."
            />
          )
        }
        renderItem={({ item: r }) => (
          <Card>
            <View style={styles.metaRow}>
              <Badge status="INFO">{CATEGORY_LABEL[r.category] || r.category}</Badge>
              <Badge status={r.status}>{r.status.replace("_", " ")}</Badge>
              <Text style={styles.time}>{relTime(r.createdAt)}</Text>
            </View>
            <Text style={styles.description}>{r.description}</Text>
            {r.plantId?.name ? (
              <Text style={styles.plant}>Plant: {r.plantId.name}</Text>
            ) : null}
            {r.resolutionNote ? (
              <View style={styles.resolution}>
                <Text style={styles.resolutionLabel}>Response from operations</Text>
                <Text style={styles.resolutionBody}>{r.resolutionNote}</Text>
                {r.reviewedAt ? (
                  <Text style={styles.resolutionTime}>
                    Reviewed {fmtDate(r.reviewedAt, "PP HH:mm")}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.sizes.xl, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 4 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: spacing.sm
  },
  time: { fontSize: font.sizes.xs, color: colors.textMuted },
  description: { color: colors.text, fontSize: font.sizes.sm, lineHeight: 20 },
  plant: { color: colors.textMuted, fontSize: font.sizes.xs, marginTop: 6 },
  resolution: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  resolutionLabel: {
    color: colors.textMuted,
    fontSize: font.sizes.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6
  },
  resolutionBody: { color: colors.text, fontSize: font.sizes.sm, lineHeight: 20 },
  resolutionTime: { color: colors.textSubtle, fontSize: font.sizes.xs, marginTop: 6 }
});
