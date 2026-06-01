import { StyleSheet, Text, View } from "react-native";
import { colors } from "../lib/theme.js";
import { initials } from "../lib/format.js";

export default function Avatar({ name, size = 32 }) {
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2 }
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.max(10, size * 0.4) }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center"
  },
  text: {
    color: colors.brand800,
    fontWeight: "600"
  }
});
