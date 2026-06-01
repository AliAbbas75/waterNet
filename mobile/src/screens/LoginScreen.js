import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../components/Button.js";
import Card from "../components/Card.js";
import Spinner from "../components/Spinner.js";
import { Field, Input } from "../components/Input.js";
import { useAuth } from "../contexts/AuthContext.js";
import { BACKEND_URL } from "../lib/config.js";
import { colors, font, radii, spacing } from "../lib/theme.js";

export default function LoginScreen() {
  const { sendOtp, blockchainLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  async function onSendOtp() {
    if (!email) return;
    setErrorMsg("");
    setSuccessMsg("");
    setSending(true);
    try {
      await sendOtp(email);
      setSent(true);
      setSuccessMsg("OTP sent. Check your inbox.");
    } catch (e) {
      setErrorMsg(e?.message || "Failed to send OTP");
    } finally {
      setSending(false);
    }
  }

  async function onSignIn() {
    if (!email || !code) return;
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);
    try {
      await blockchainLogin({ email, code });
    } catch (e) {
      setErrorMsg(e?.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="water" size={28} color="#fff" />
            </View>
            <Text style={styles.brandTitle}>WaterNet</Text>
            <Text style={styles.brandSubtitle}>
              IoT water quality monitoring{"\n"}for maintainers and citizens
            </Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Sign in</Text>
            <Text style={styles.cardHint}>
              Enter your email to receive a one-time code.
            </Text>

            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Field label="Email" required>
                <Input
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                />
              </Field>
              <Button
                onPress={onSendOtp}
                loading={sending}
                disabled={!email}
                variant="secondary"
                fullWidth
                leftIcon={<Ionicons name="mail" size={18} color={colors.text} />}
              >
                Send OTP
              </Button>
              {sent ? (
                <Field label="One-time code" required>
                  <Input
                    keyboardType="number-pad"
                    placeholder="123456"
                    value={code}
                    onChangeText={setCode}
                  />
                </Field>
              ) : null}
            </View>

            {successMsg ? (
              <View style={[styles.successBox, { marginTop: spacing.md }]}>
                <Text style={styles.successBody}>{successMsg}</Text>
              </View>
            ) : null}

            {errorMsg ? (
              <View style={[styles.errorBox, { marginTop: spacing.md }]}>
                <Text style={styles.errorBody}>{errorMsg}</Text>
              </View>
            ) : null}

            {!sent ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={styles.helperText}>
                  Backend: {BACKEND_URL}
                </Text>
              </View>
            ) : null}

            <Button
              onPress={onSignIn}
              loading={submitting}
              disabled={!email || !code}
              fullWidth
              style={{ marginTop: spacing.lg }}
              leftIcon={<Ionicons name="log-in" size={18} color="#fff" />}
            >
              Sign in
            </Button>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.brand900 },
  scroll: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  brand: { alignItems: "center", marginTop: spacing.xl, marginBottom: spacing.md },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.brand600,
    alignItems: "center",
    justifyContent: "center"
  },
  brandTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: spacing.md,
    letterSpacing: -0.5
  },
  brandSubtitle: {
    color: colors.brand100,
    fontSize: font.sizes.sm,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20
  },
  card: { padding: spacing.lg },
  cardTitle: { fontSize: font.sizes.lg, fontWeight: "600", color: colors.text },
  cardHint: { marginTop: 4, fontSize: font.sizes.sm, color: colors.textMuted },
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.unsafeBg,
    borderWidth: 1,
    borderColor: "#fecaca"
  },
  errorBody: { color: colors.unsafe, fontSize: font.sizes.sm },
  successBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.safeBg,
    borderWidth: 1,
    borderColor: "#bbf7d0"
  },
  successBody: { color: colors.safe, fontSize: font.sizes.sm },
  helperText: { color: colors.textMuted, fontSize: font.sizes.xs }
});
