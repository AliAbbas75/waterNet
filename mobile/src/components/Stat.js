import { StyleSheet, Text, View } from "react-native";
import { colors, font, radii, spacing, statusColor } from "../lib/theme.js";

export default function Stat({ label, value, accent = "neutral", trend, style }) {
  const tone = accentTone(accent);
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: tone.fg }]}>{value}</Text>
      {trend ? <Text style={styles.trend}>{trend}</Text> : null}
    </View>
  );
}

function accentTone(accent) {
  switch (accent) {
    case "safe":
      return statusColor("SAFE");
    case "warn":
      return statusColor("WARNING");
    case "unsafe":
      return statusColor("UNSAFE");
    case "brand":
      return { fg: colors.brand700, bg: colors.brand50 };
    default:
      return { fg: colors.text, bg: colors.mutedBg };
  }
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minWidth: 0
  },
  label: {
    fontSize: font.sizes.xs,
    color: colors.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  value: {
    marginTop: 4,
    fontSize: font.sizes.xxl,
    fontWeight: "700"
  },
  trend: {
    marginTop: 2,
    fontSize: font.sizes.xs,
    color: colors.textMuted
  }
});
