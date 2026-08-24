import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme";

export default function AppButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  compact = false,
  icon,
  accessibilityLabel,
  style
}) {
  const palette = {
    primary: { background: colors.primary, border: colors.primary, text: colors.surface },
    secondary: { background: colors.surface, border: colors.primary, text: colors.primary },
    danger: { background: colors.danger, border: colors.danger, text: colors.surface },
    success: { background: colors.green, border: colors.green, text: colors.surface },
    ghost: { background: "transparent", border: "transparent", text: colors.primary }
  }[variant] || { background: colors.primary, border: colors.primary, text: colors.surface };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: palette.background, borderColor: palette.border },
        (pressed || disabled) && styles.dimmed,
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={compact ? 17 : 19} color={palette.text} /> : null}
          <Text style={[styles.text, { color: palette.text }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  compact: { minHeight: 44, paddingHorizontal: spacing.sm },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
  text: typography.button,
  dimmed: { opacity: 0.58 }
});
