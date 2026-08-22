import { StyleSheet, Text, View } from "react-native";
import { font, radii, spacing, statusColor } from "../lib/theme.js";

export default function Badge({ children, status, dot = true, style }) {
  const { fg, bg } = statusColor(status || children);
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {typeof children === "string" ? children.replace(/_/g, " ") : children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    gap: 6,
    alignSelf: "flex-start"
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  text: {
    fontSize: font.sizes.xs,
    fontWeight: "600",
    letterSpacing: 0.2
  }
});
