import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, font, radii, spacing } from "../lib/theme.js";

const variants = {
  primary: { bg: colors.brand600, fg: "#ffffff", pressedBg: colors.brand700, disabledBg: colors.brand200 },
  secondary: { bg: "#ffffff", fg: colors.text, pressedBg: "#f1f5f9", border: colors.border },
  danger: { bg: colors.unsafe, fg: "#ffffff", pressedBg: "#b91c1c" },
  success: { bg: colors.safe, fg: "#ffffff", pressedBg: "#15803d" },
  ghost: { bg: "transparent", fg: colors.text, pressedBg: colors.mutedBg }
};

const sizes = {
  sm: { h: 36, px: 12, fz: font.sizes.sm },
  md: { h: 44, px: 16, fz: font.sizes.md },
  lg: { h: 52, px: 20, fz: font.sizes.lg }
};

export default function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  fullWidth = false
}) {
  const v = variants[variant];
  const s = sizes[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.h,
          paddingHorizontal: s.px,
          backgroundColor: isDisabled && v.disabledBg
            ? v.disabledBg
            : pressed
            ? v.pressedBg
            : v.bg,
          borderColor: v.border,
          borderWidth: v.border ? 1 : 0,
          opacity: isDisabled && !v.disabledBg ? 0.5 : 1,
          width: fullWidth ? "100%" : undefined
        },
        style
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={v.fg} />
        ) : (
          leftIcon
        )}
        {typeof children === "string" ? (
          <Text style={{ color: v.fg, fontSize: s.fz, fontWeight: "600" }}>{children}</Text>
        ) : (
          children
        )}
        {!loading && rightIcon}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  }
});
