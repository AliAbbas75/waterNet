import { useEffect, useState } from "react";
import {
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button.js";
import Card from "../../components/Card.js";
import { Field, Input, Select } from "../../components/Input.js";
import Spinner from "../../components/Spinner.js";
import { usePlants, useSubmitReport } from "../../hooks/usePublic.js";
import { colors, font, radii, spacing } from "../../lib/theme.js";

const CATEGORIES = [
  { value: "QUALITY", label: "Water quality (taste, smell, colour)" },
  { value: "AVAILABILITY", label: "Availability (no water, low pressure)" },
  { value: "DEVICE", label: "Device / display problem" },
  { value: "OTHER", label: "Other" }
];

export default function ReportFormScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const submit = useSubmitReport();
  const plants = usePlants();
  const [form, setForm] = useState({
    plantId: route.params?.plantId || "",
    category: "QUALITY",
    description: "",
    locationText: "",
    contact: ""
  });
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // If the user navigated here with a plantId param, prefill it.
  useEffect(() => {
    if (route.params?.plantId && form.plantId !== route.params.plantId) {
      setForm((f) => ({ ...f, plantId: route.params.plantId }));
    }
  }, [route.params?.plantId]);

  async function onSubmit() {
    setErrorMsg("");
    if (!form.description.trim()) {
      setErrorMsg("Please describe the issue.");
      return;
    }
    try {
      await submit.mutateAsync({
        plantId: form.plantId || undefined,
        category: form.category,
        description: form.description.trim(),
        locationText: form.locationText.trim() || undefined,
        contact: form.contact.trim() || undefined
      });
      setDone(true);
    } catch (err) {
      setErrorMsg(err.message || "Failed to submit");
    }
  }

  if (done) {
    return (
      <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
        <View style={{ padding: spacing.lg }}>
          <Card>
            <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={28} color={colors.safe} />
              </View>
              <Text style={styles.successTitle}>Thanks — your report is in</Text>
              <Text style={styles.successBody}>
                The operations team will review it. You can check status under "My reports".
              </Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
                <Button variant="secondary" onPress={() => navigation.navigate("MyReports")}>
                  My reports
                </Button>
                <Button
                  onPress={() => {
                    setForm({
                      plantId: "",
                      category: "QUALITY",
                      description: "",
                      locationText: "",
                      contact: ""
                    });
                    setDone(false);
                    setErrorMsg("");
                  }}
                >
                  New report
                </Button>
              </View>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right", "bottom"]} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.title}>Report an issue</Text>
            <Text style={styles.subtitle}>
              Tell us about water quality, availability, or device problems. Reports go to the
              operations team.
            </Text>
          </View>

          <Card>
            <View style={{ gap: spacing.md }}>
              <Field label="Issue category" required>
                <Select
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  items={CATEGORIES}
                />
              </Field>

              <Field label="Plant" hint="(optional)">
                {plants.isLoading ? (
                  <Spinner />
                ) : (
                  <Select
                    value={form.plantId}
                    onChange={(v) => setForm({ ...form, plantId: v })}
                    placeholder="Not specified"
                    items={(plants.data || []).map((p) => ({
                      label: p.plant.name,
                      value: p.plant._id
                    }))}
                  />
                )}
              </Field>

              <Field label="Location description" hint="(if no plant picked)">
                <Input
                  value={form.locationText}
                  onChangeText={(v) => setForm({ ...form, locationText: v })}
                  placeholder="e.g. corner of street 12, F-7/3"
                />
              </Field>

              <Field label="What's happening?" required>
                <Input
                  value={form.description}
                  onChangeText={(v) => setForm({ ...form, description: v })}
                  placeholder="Describe what you noticed — when it started, how often, etc."
                  multiline
                />
              </Field>

              <Field label="Your contact" hint="(optional)">
                <Input
                  value={form.contact}
                  onChangeText={(v) => setForm({ ...form, contact: v })}
                  placeholder="Phone or email — for follow-up"
                />
              </Field>

              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={{ color: colors.unsafe, fontSize: font.sizes.sm }}>{errorMsg}</Text>
                </View>
              ) : null}

              <Button
                onPress={onSubmit}
                loading={submit.isPending}
                fullWidth
                leftIcon={<Ionicons name="send" size={16} color="#fff" />}
              >
                Submit report
              </Button>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: font.sizes.xl, fontWeight: "700", color: colors.text },
  subtitle: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 4 },
  successCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.safeBg,
    alignItems: "center",
    justifyContent: "center"
  },
  successTitle: {
    fontSize: font.sizes.lg,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.md
  },
  successBody: {
    fontSize: font.sizes.sm,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: spacing.lg
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.unsafeBg,
    borderWidth: 1,
    borderColor: "#fecaca"
  }
});
