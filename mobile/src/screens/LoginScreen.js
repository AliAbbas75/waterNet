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
import { Field, Input } from "../components/Input.js";
import { useAuth } from "../contexts/AuthContext.js";
import { BACKEND_URL } from "../lib/config.js";
import { colors, font, radii, spacing } from "../lib/theme.js";

/**
 * Sign in, or create an account, in one screen.
 *
 * Both routes converge on the same one-time code, so they are one screen with
 * two openings rather than two screens: the only difference is whether the
 * account exists before the code is sent.
 *
 * Registration creates a PUBLIC account. Maintainers, managers and admins are
 * provisioned by an administrator and cannot be self-assigned here — signing up
 * grants the citizen view and nothing more.
 */
export default function LoginScreen() {
  const { register, sendOtp, blockchainLogin } = useAuth();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  // Set when the email typed into sign-in has no account. Kept separate from
  // the error text so the screen can offer the way forward rather than only
  // reporting the dead end.
  const [unknownEmail, setUnknownEmail] = useState(false);

  const signingUp = mode === "signup";

  function switchMode(next) {
    setMode(next);
    setSent(false);
    setCode("");
    setErrorMsg("");
    setSuccessMsg("");
    setUnknownEmail(false);
  }

  async function onSendOtp() {
    if (!email) return;
    setErrorMsg("");
    setSuccessMsg("");
    setUnknownEmail(false);
    setSending(true);
    try {
      await sendOtp(email);
      setSent(true);
      setSuccessMsg("Code sent. Check your inbox.");
    } catch (e) {
      // 404 here means the email has never been registered, which is a normal
      // thing for a new person to do — not a failure to report and stop at.
      if (e?.status === 404) {
        setUnknownEmail(true);
        setErrorMsg("");
      } else {
        setErrorMsg(e?.message || "Could not send the code");
      }
    } finally {
      setSending(false);
    }
  }

  async function onRegister() {
    if (!email) return;
    setErrorMsg("");
    setSuccessMsg("");
    setUnknownEmail(false);
    setSending(true);
    try {
      await register(email, displayName.trim() || undefined);
      setSent(true);
      setSuccessMsg("Account created. Enter the code we sent you.");
    } catch (e) {
      // Already registered is not an error worth blocking on — it means they
      // meant to sign in, so put them there with the email they already typed.
      // The code goes out first: onSendOtp clears the banners on the way in, so
      // setting the message before it would wipe the one thing worth reading.
      if (e?.status === 409) {
        setMode("signin");
        await onSendOtp();
        setSuccessMsg("That email already has an account — we sent it a code.");
        return;
      }
      setErrorMsg(e?.message || "Could not create the account");
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
            <Text style={styles.cardTitle}>
              {signingUp ? "Create an account" : "Sign in"}
            </Text>
            <Text style={styles.cardHint}>
              {signingUp
                ? "Check the water near you and report a problem. No password — we send a code."
                : "Enter your email to receive a one-time code."}
            </Text>

            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <Field label="Email" required>
                <Input
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setUnknownEmail(false);
                  }}
                  editable={!sent}
                />
              </Field>

              {signingUp && !sent ? (
                <Field label="Your name">
                  <Input
                    placeholder="Optional"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </Field>
              ) : null}

              {!sent ? (
                <Button
                  onPress={signingUp ? onRegister : onSendOtp}
                  loading={sending}
                  disabled={!email}
                  variant={signingUp ? "primary" : "secondary"}
                  fullWidth
                  leftIcon={
                    <Ionicons
                      name={signingUp ? "person-add" : "mail"}
                      size={18}
                      color={signingUp ? "#fff" : colors.text}
                    />
                  }
                >
                  {signingUp ? "Create account" : "Send code"}
                </Button>
              ) : (
                <Field label="One-time code" required>
                  <Input
                    keyboardType="number-pad"
                    placeholder="123456"
                    value={code}
                    onChangeText={setCode}
                  />
                </Field>
              )}
            </View>

            {/* The dead end this used to be: an email with no account reported
                "User not found" and left you there with no button to press. */}
            {unknownEmail ? (
              <View style={[styles.noticeBox, { marginTop: spacing.md }]}>
                <Text style={styles.noticeTitle}>No account for that email yet</Text>
                <Text style={styles.noticeBody}>
                  Create one now — it takes a code and nothing else.
                </Text>
                <Button
                  onPress={() => {
                    setMode("signup");
                    setUnknownEmail(false);
                  }}
                  variant="secondary"
                  fullWidth
                  style={{ marginTop: spacing.sm }}
                  leftIcon={<Ionicons name="person-add" size={16} color={colors.text} />}
                >
                  Create an account
                </Button>
              </View>
            ) : null}

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

            {sent ? (
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
            ) : null}

            {sent ? (
              <Pressable
                onPress={() => {
                  setSent(false);
                  setCode("");
                  setSuccessMsg("");
                  setErrorMsg("");
                }}
                style={{ marginTop: spacing.md }}
              >
                <Text style={styles.linkText}>Use a different email</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => switchMode(signingUp ? "signin" : "signup")}
                style={{ marginTop: spacing.lg }}
              >
                <Text style={styles.switchText}>
                  {signingUp ? "Already have an account? " : "New here? "}
                  <Text style={styles.switchLink}>
                    {signingUp ? "Sign in" : "Create an account"}
                  </Text>
                </Text>
              </Pressable>
            )}

            {!sent ? (
              <Text style={[styles.helperText, { marginTop: spacing.md }]}>
                Backend: {BACKEND_URL}
              </Text>
            ) : null}
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
  cardHint: { marginTop: 4, fontSize: font.sizes.sm, color: colors.textMuted, lineHeight: 19 },
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
  noticeBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.warnBg,
    borderWidth: 1,
    borderColor: "#fde68a"
  },
  noticeTitle: { color: colors.warn, fontSize: font.sizes.sm, fontWeight: "600" },
  noticeBody: { color: colors.warn, fontSize: font.sizes.sm, marginTop: 2 },
  switchText: { textAlign: "center", color: colors.textMuted, fontSize: font.sizes.sm },
  switchLink: { color: colors.brand700, fontWeight: "600" },
  linkText: { textAlign: "center", color: colors.brand700, fontSize: font.sizes.sm },
  helperText: { color: colors.textMuted, fontSize: font.sizes.xs, textAlign: "center" }
});
