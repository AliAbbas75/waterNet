import { useMemo, useState } from "react";
import {
  Alert as RNAlert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";

import Avatar from "../../components/Avatar.js";
import Badge from "../../components/Badge.js";
import Button from "../../components/Button.js";
import Card, { CardHeader } from "../../components/Card.js";
import EmptyState from "../../components/EmptyState.js";
import { Field, Input, Select } from "../../components/Input.js";
import Spinner from "../../components/Spinner.js";
import { useInventory } from "../../hooks/useInventory.js";
import {
  useAddTaskLog,
  useResolveTask,
  useStartTask,
  useTask,
  useTaskLogs
} from "../../hooks/useMaintenance.js";
import { fmtDate, relTime } from "../../lib/format.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";

export default function TaskDetailScreen() {
  const { id } = useRoute().params || {};
  const task = useTask(id);
  const logs = useTaskLogs(id);
  const start = useStartTask();
  const addLog = useAddTaskLog();
  const [logNote, setLogNote] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);

  const sortedLogs = useMemo(
    () => (logs.data || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [logs.data]
  );

  if (task.isLoading) {
    return <Spinner label="Loading task…" fullscreen />;
  }
  if (task.error || !task.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <EmptyState title="Task not found" />
      </View>
    );
  }

  const t = task.data;

  async function submitLog() {
    if (!logNote.trim()) return;
    try {
      await addLog.mutateAsync({ id, note: logNote.trim() });
      setLogNote("");
    } catch (err) {
      RNAlert.alert("Failed to add note", err.message || "Try again.");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card>
        <View style={styles.headerRow}>
          <Badge status={t.status}>{t.status.replace("_", " ")}</Badge>
          <Text style={styles.smallTime}>Assigned {relTime(t.assignedAt)}</Text>
        </View>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.description}>{t.description}</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {t.status === "ASSIGNED" ? (
            <Button
              leftIcon={<Ionicons name="play" size={16} color="#fff" />}
              loading={start.isPending}
              onPress={() => start.mutate(t._id)}
            >
              Start task
            </Button>
          ) : null}
          {t.status === "IN_PROGRESS" ? (
            <Button
              variant="success"
              leftIcon={<Ionicons name="checkmark-done" size={16} color="#fff" />}
              onPress={() => setResolveOpen(true)}
            >
              Mark resolved
            </Button>
          ) : null}
          {t.status === "RESOLVED" ? (
            <View style={styles.resolvedBanner}>
              <Ionicons name="checkmark-circle" size={18} color={colors.safe} />
              <Text style={{ color: colors.safe, fontWeight: "600" }}>
                Resolved {fmtDate(t.resolvedAt, "PP HH:mm")}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card>
        <CardHeader title="Where" />
        <InfoRow icon="business" label="Plant" value={t.plantId?.name || "—"} />
        <InfoRow icon="hardware-chip" label="Device" value={t.deviceId?.deviceId || "—"} />
        <InfoRow
          icon="person"
          label="Assigned by"
          value={t.assignedByUserId?.display_name || "—"}
        />
      </Card>

      <Card>
        <CardHeader title="Activity" subtitle={`${sortedLogs.length} log entries`} />
        {logs.isLoading ? (
          <Spinner />
        ) : !sortedLogs.length ? (
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>No log entries yet.</Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            {sortedLogs.map((log) => (
              <View key={log._id} style={styles.logRow}>
                <View style={styles.logRail}>
                  <View style={styles.logDot} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.logMeta}>
                    <Avatar name={log.authorUserId?.display_name} size={20} />
                    <Text style={styles.logMetaText} numberOfLines={1}>
                      {log.authorUserId?.display_name || "Unknown"} • {fmtDate(log.createdAt, "PP HH:mm")}
                    </Text>
                  </View>
                  {log.structuredFields?.type === "SOFT_HANDOFF" ? (
                    <View style={{ marginTop: 4 }}>
                      <Badge status="WARNING">Soft handoff</Badge>
                    </View>
                  ) : null}
                  <Text style={styles.logNote}>{log.note}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Field label="Add a note">
            <Input
              value={logNote}
              onChangeText={setLogNote}
              placeholder="Progress update, observations, parts used…"
              multiline
            />
          </Field>
          <Button
            onPress={submitLog}
            disabled={!logNote.trim()}
            loading={addLog.isPending}
            leftIcon={<Ionicons name="send" size={14} color="#fff" />}
          >
            Add note
          </Button>
        </View>
      </Card>

      {t.resolutionSummary ? (
        <Card>
          <CardHeader title="Resolution" />
          <Text style={{ color: colors.text, fontSize: font.sizes.md }}>{t.resolutionSummary}</Text>
        </Card>
      ) : null}

      {t.materials?.length ? (
        <Card>
          <CardHeader title="Materials used" />
          {t.materials.map((m, i) => (
            <View key={i} style={styles.materialRow}>
              <Text style={{ color: colors.text }}>{m.name}</Text>
              <Text style={{ color: colors.textMuted }}>× {m.quantity}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <ResolveModal
        taskId={t._id}
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
      />
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>{label}</Text>
      <Text style={{ color: colors.text, fontSize: font.sizes.sm, flex: 1, textAlign: "right" }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ResolveModal({ taskId, open, onClose }) {
  const resolve = useResolveTask();
  const inventory = useInventory();
  const [summary, setSummary] = useState("");
  const [materials, setMaterials] = useState([]);
  const [pickerItemId, setPickerItemId] = useState("");
  const [pickerQty, setPickerQty] = useState("1");
  const [errorMsg, setErrorMsg] = useState("");

  const items = inventory.data || [];

  function addMaterial() {
    const item = items.find((i) => i._id === pickerItemId);
    const qty = Number(pickerQty) || 0;
    if (!item || qty < 1) return;
    setMaterials((arr) => [
      ...arr.filter((x) => x.itemId !== item._id),
      { itemId: item._id, name: item.name, quantity: qty }
    ]);
    setPickerItemId("");
    setPickerQty("1");
  }

  async function submit() {
    setErrorMsg("");
    try {
      await resolve.mutateAsync({ id: taskId, resolutionSummary: summary, materials });
      onClose();
      setSummary("");
      setMaterials([]);
    } catch (e) {
      setErrorMsg(e?.message || "Failed to resolve");
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={open} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={{ color: colors.brand700, fontSize: font.sizes.md }}>Cancel</Text>
          </Pressable>
          <Text style={{ fontSize: font.sizes.lg, fontWeight: "600", color: colors.text }}>
            Resolve task
          </Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <Card>
            <Field label="Resolution summary">
              <Input
                value={summary}
                onChangeText={setSummary}
                placeholder="What was done? Cause, fix, observations…"
                multiline
              />
            </Field>
          </Card>

          <Card>
            <CardHeader title="Materials used (optional)" subtitle="Stock is decremented atomically when you resolve." />
            {inventory.isLoading ? (
              <Spinner />
            ) : inventory.error ? (
              <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
                Couldn't load inventory ({inventory.error.message}). You can still resolve without
                logging materials.
              </Text>
            ) : (
              <>
                <View style={{ gap: spacing.sm }}>
                  <Field label="Item">
                    <Select
                      value={pickerItemId}
                      onChange={(v) => setPickerItemId(v)}
                      placeholder="Select an item…"
                      items={items
                        .filter((i) => i.quantity > 0)
                        .map((i) => ({
                          label: `${i.name}  —  ${i.quantity} ${i.unit} on hand`,
                          value: i._id
                        }))}
                    />
                  </Field>
                  <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-end" }}>
                    <Field label="Qty" style={{ width: 90 }}>
                      <Input
                        value={pickerQty}
                        onChangeText={setPickerQty}
                        keyboardType="number-pad"
                      />
                    </Field>
                    <Button
                      variant="secondary"
                      onPress={addMaterial}
                      disabled={!pickerItemId}
                      leftIcon={<Ionicons name="add" size={16} color={colors.text} />}
                    >
                      Add
                    </Button>
                  </View>
                </View>
                {materials.length ? (
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    {materials.map((m) => (
                      <View key={m.itemId} style={styles.materialChip}>
                        <Text style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                          {m.name} × {m.quantity}
                        </Text>
                        <Pressable onPress={() => setMaterials((arr) => arr.filter((x) => x.itemId !== m.itemId))}>
                          <Ionicons name="trash" size={16} color={colors.unsafe} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </Card>

          {errorMsg ? (
            <View style={styles.modalError}>
              <Text style={{ color: colors.unsafe, fontSize: font.sizes.sm }}>{errorMsg}</Text>
            </View>
          ) : null}

          <Button
            variant="success"
            onPress={submit}
            loading={resolve.isPending}
            leftIcon={<Ionicons name="checkmark-done" size={16} color="#fff" />}
            fullWidth
          >
            Mark resolved
          </Button>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  title: { fontSize: font.sizes.xl, fontWeight: "700", color: colors.text },
  description: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 4, lineHeight: 20 },
  smallTime: { fontSize: font.sizes.xs, color: colors.textMuted },
  resolvedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: colors.safeBg
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 6
  },
  logRow: { flexDirection: "row", gap: spacing.sm },
  logRail: { width: 16, alignItems: "center", paddingTop: 4 },
  logDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand500,
    borderWidth: 2,
    borderColor: colors.card
  },
  logMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  logMetaText: { fontSize: font.sizes.xs, color: colors.textMuted, flex: 1 },
  logNote: { color: colors.text, fontSize: font.sizes.sm, marginTop: 4, lineHeight: 20 },
  materialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card
  },
  materialChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card
  },
  modalError: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.unsafeBg
  }
});
