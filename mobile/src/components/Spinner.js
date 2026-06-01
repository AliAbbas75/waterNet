import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../lib/theme.js";

export default function Spinner({ label, fullscreen = false }) {
  const body = (
    <View style={styles.row}>
      <ActivityIndicator color={colors.brand600} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
  if (fullscreen) return <View style={styles.fullscreen}>{body}</View>;
  return body;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  label: {
    fontSize: font.sizes.sm,
    color: colors.textMuted
  },
  fullscreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg
  }
});
