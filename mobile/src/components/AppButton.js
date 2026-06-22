import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { defaultColors } from "../utils/colors";

export default function AppButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  colors = defaultColors,
  variant = "primary",
}) {
  const backgroundColor = variant === "danger"
    ? colors.danger
    : variant === "secondary" ? colors.card : colors.primary;
  const textColor = variant === "secondary" ? colors.primary : "#FFFFFF";

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor, borderColor: colors.primary, opacity: pressed || disabled ? 0.65 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: "center", borderRadius: 10, borderWidth: 1, marginTop: 12, padding: 14 },
  text: { fontSize: 16, fontWeight: "700" },
});
