import { Picker } from "@react-native-picker/picker";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, font, radii, spacing } from "../lib/theme.js";

export function Field({ label, hint, error, required, children, style }) {
  return (
    <View style={style}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? <Text style={{ color: colors.unsafe }}> *</Text> : null}
          {hint ? <Text style={styles.hint}>  {hint}</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Input(props) {
  return (
    <TextInput
      placeholderTextColor={colors.textSubtle}
      {...props}
      style={[styles.input, props.multiline && { height: undefined, minHeight: 80, paddingTop: 10 }, props.style]}
    />
  );
}

export function Select({ value, onChange, items, placeholder, enabled = true }) {
  return (
    <View style={styles.select}>
      <Picker
        selectedValue={value}
        onValueChange={onChange}
        enabled={enabled}
        style={{ color: colors.text }}
        dropdownIconColor={colors.textMuted}
      >
        {placeholder ? <Picker.Item label={placeholder} value="" /> : null}
        {items.map((it) => (
          <Picker.Item key={String(it.value)} label={it.label} value={it.value} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: font.sizes.xs,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  hint: {
    color: colors.textSubtle,
    fontWeight: "400",
    textTransform: "none",
    letterSpacing: 0
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    color: colors.text,
    fontSize: font.sizes.md
  },
  select: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    overflow: "hidden"
  },
  error: {
    marginTop: 4,
    color: colors.unsafe,
    fontSize: font.sizes.xs
  }
});
