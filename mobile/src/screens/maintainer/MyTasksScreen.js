import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import Badge from "../../components/Badge.js";
import Button from "../../components/Button.js";
import Card from "../../components/Card.js";
import EmptyState from "../../components/EmptyState.js";
import Spinner from "../../components/Spinner.js";
import Stat from "../../components/Stat.js";
import { useAuth } from "../../contexts/AuthContext.js";
import { useMyTasks, useStartTask } from "../../hooks/useMaintenance.js";
import { useAlerts } from "../../hooks/useAlerts.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";
import { relTime } from "../../lib/format.js";
import { countByPhase, taskStatusMeta } from "../../lib/taskStatus.js";

const FILTERS = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" }
];

export default function MyTasksScreen() {
  const { user } = useAuth();
  const tasks = useMyTasks();
  const alerts = useAlerts({ status: "OPEN" });
  const startTask = useStartTask();
  const navigation = useNavigation();
  const [filter, setFilter] = useState("ALL");

  // Grouped by phase, not by raw status: BLOCKED and CANCELLED tasks were
  // assigned to people and then shown to nobody.
  const groups = useMemo(() => {
    const out = { PENDING: [], IN_PROGRESS: [], COMPLETED: [], CANCELLED: [] };
    (tasks.data || []).forEach((t) => {
      const phase = taskStatusMeta(t.status).phase;
      if (out[phase]) out[phase].push(t);
    });
    return out;
  }, [tasks.data]);

  const counts = useMemo(() => countByPhase(tasks.data), [tasks.data]);
  const heldUp = useMemo(
    () => (tasks.data || []).filter((t) => t.status === "BLOCKED").length,
    [tasks.data]
  );

  const filtered = filter === "ALL" ? tasks.data || [] : groups[filter] || [];
  const urgent = (alerts.data || []).filter((a) => a.severity === "CRITICAL").length;

  function renderHeader() {
    return (
      <View>
        <Text style={styles.greeting}>
          Welcome back, {user?.display_name?.split(" ")[0] || "technician"}.
        </Text>
        <Text style={styles.greetingSub}>
          Your assigned maintenance work and the most urgent alerts on the network.
        </Text>

        <View style={styles.statsRow}>
          <Stat label="Pending" value={counts.PENDING} accent="brand" />
          <Stat
            label={heldUp ? `In progress (${heldUp} held up)` : "In progress"}
            value={counts.IN_PROGRESS}
            accent="warn"
          />
        </View>
        <View style={[styles.statsRow, { marginTop: spacing.sm }]}>
          <Stat label="Completed" value={counts.COMPLETED} accent="safe" />
          <Stat label="Urgent alerts" value={urgent} accent={urgent > 0 ? "unsafe" : "neutral"} />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.filterPill,
                filter === f.key && {
                  backgroundColor: colors.brand600,
                  borderColor: colors.brand600
                }
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f.key && { color: "#fff" }
                ]}
              >
                {f.label}
                {f.key !== "ALL" ? ` (${groups[f.key]?.length || 0})` : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  function renderTask({ item: t }) {
    return (
      <Card style={styles.taskCard} padded={false}>
        <Pressable
          onPress={() => navigation.navigate("TaskDetail", { id: t._id })}
          style={({ pressed }) => [
            { padding: spacing.lg },
            pressed && { opacity: 0.7 }
          ]}
        >
          <View style={styles.taskHeader}>
            <Badge status={taskStatusMeta(t.status).tone}>{taskStatusMeta(t.status).label}</Badge>
            <Text style={styles.taskTime}>
              {t.startedAt && !t.resolvedAt
                ? `Started ${relTime(t.startedAt)}`
                : `Assigned ${relTime(t.assignedAt)}`}
            </Text>
          </View>
          <Text style={styles.taskTitle} numberOfLines={2}>
            {t.title}
          </Text>
          <Text style={styles.taskDesc} numberOfLines={2}>
            {t.description}
          </Text>
          {t.status === "BLOCKED" && t.blockedReason ? (
            <View style={styles.blockedBox}>
              <Ionicons name="pause-circle" size={13} color={colors.warn} />
              <Text style={styles.blockedText} numberOfLines={2}>
                Waiting on: {t.blockedReason}
              </Text>
            </View>
          ) : null}
          <View style={styles.taskMeta}>
            <Ionicons name="business" size={12} color={colors.textMuted} />
            <Text style={styles.taskMetaText} numberOfLines={1}>
              {t.plantId?.name || "No plant linked"}
              {t.deviceId?.deviceId ? `  •  ${t.deviceId.deviceId}` : ""}
            </Text>
          </View>
          {t.status === "ASSIGNED" ? (
            <View style={{ marginTop: spacing.md }}>
              <Button
                size="sm"
                leftIcon={<Ionicons name="play" size={14} color="#fff" />}
                loading={startTask.isPending && startTask.variables === t._id}
                onPress={() => startTask.mutate(t._id)}
              >
                Start task
              </Button>
            </View>
          ) : null}
        </Pressable>
      </Card>
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      {tasks.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Spinner label="Loading your tasks…" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t._id}
          renderItem={renderTask}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon="✓"
              title="Nothing to do here"
              description={
                filter === "ALL"
                  ? "You have no tasks yet. Check back later."
                  : `No tasks in '${FILTERS.find((f) => f.key === filter)?.label}' state.`
              }
            />
          }
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={tasks.isFetching && !tasks.isLoading}
              onRefresh={() => {
                tasks.refetch();
                alerts.refetch();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.sm },
  greeting: { fontSize: font.sizes.lg, fontWeight: "700", color: colors.text },
  greetingSub: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  filterText: { fontSize: font.sizes.sm, fontWeight: "600", color: colors.textMuted },
  blockedBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.warnBg
  },
  blockedText: {
    flex: 1,
    fontSize: font.sizes.xs,
    color: colors.warn
  },
  taskCard: { padding: 0 },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  taskTime: { fontSize: font.sizes.xs, color: colors.textMuted },
  taskTitle: {
    fontSize: font.sizes.md,
    fontWeight: "600",
    color: colors.text,
    marginTop: spacing.sm
  },
  taskDesc: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 2 },
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.sm },
  taskMetaText: { fontSize: font.sizes.xs, color: colors.textMuted, flex: 1 }
});
