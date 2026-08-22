import { useState } from "react";
import { Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import Avatar from "./Avatar.js";
import Button from "./Button.js";
import { useAuth } from "../contexts/AuthContext.js";
import { colors, font, radii, spacing } from "../lib/theme.js";

// Shown in the header of all primary screens. Tap → tiny sheet with role + sign-out.
export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  function confirmLogout() {
    setOpen(false);
    if (Platform.OS === "web") {
      const ok = window.confirm("Sign out? You will need to sign in again.");
      if (ok) logout();
      return;
    }
    Alert.alert("Sign out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout }
    ]);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.7 }]}
      >
        <Avatar name={user.display_name || user.email} size={32} />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={{ alignItems: "center", marginBottom: spacing.md }}>
              <Avatar name={user.display_name || user.email} size={56} />
              <Text style={styles.name}>{user.display_name || user.email}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark" size={12} color={colors.brand700} />
                <Text style={styles.roleText}>{user.role}</Text>
              </View>
            </View>
            <Button
              variant="danger"
              onPress={confirmLogout}
              fullWidth
              leftIcon={<Ionicons name="log-out" size={18} color="#fff" />}
            >
              Sign out
            </Button>
            <Pressable onPress={() => setOpen(false)} style={{ alignItems: "center", marginTop: spacing.md }}>
              <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { marginRight: spacing.md },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl
  },
  name: {
    marginTop: spacing.md,
    fontSize: font.sizes.lg,
    fontWeight: "600",
    color: colors.text
  },
  email: { fontSize: font.sizes.sm, color: colors.textMuted, marginTop: 2 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.brand50,
    borderRadius: radii.pill
  },
  roleText: {
    color: colors.brand700,
    fontSize: font.sizes.xs,
    fontWeight: "700",
    letterSpacing: 0.5
  }
});
