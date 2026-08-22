import { StyleSheet, Text, View } from "react-native";
import { colors, font, radii, spacing } from "../lib/theme.js";

export default function Card({ children, style, padded = true }) {
  return <View style={[styles.card, padded && { padding: spacing.lg }, style]}>{children}</View>;
}

export function CardHeader({ title, subtitle, action, style }) {
  return (
    <View style={[styles.header, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.sm
  },
  title: {
    fontSize: font.sizes.lg,
    fontWeight: "600",
    color: colors.text
  },
  subtitle: {
    fontSize: font.sizes.sm,
    color: colors.textMuted,
    marginTop: 2
  }
});
