import { StyleSheet, Text, View } from "react-native";
import { colors, font, radii, spacing } from "../lib/theme.js";

export default function EmptyState({ title, description, icon, action, style }) {
  return (
    <View style={[styles.wrap, style]}>
      {icon ? <Text style={{ fontSize: 32, marginBottom: spacing.sm }}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    padding: spacing.xxl,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)"
  },
  title: {
    fontSize: font.sizes.md,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center"
  },
  desc: {
    marginTop: 4,
    fontSize: font.sizes.sm,
    color: colors.textMuted,
    textAlign: "center"
  }
});
