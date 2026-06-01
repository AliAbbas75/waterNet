import { StyleSheet, Text, View } from "react-native";
import { colors, font, spacing } from "../lib/theme.js";

export default function ScreenHeader({ title, description, action }) {
  return (
    <View style={styles.wrap}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  title: {
    fontSize: font.sizes.xl,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5
  },
  desc: {
    marginTop: 4,
    fontSize: font.sizes.sm,
    color: colors.textMuted
  }
});
