import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { COLORS } from "../utils/constants";

export default function AppButton({ title, onPress, variant = "primary", loading = false, disabled = false, compact = false }) {
  const isSecondary = variant === "secondary";
  const isDanger = variant === "danger";
  const isSuccess = variant === "success";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        isSecondary && styles.secondary,
        isDanger && styles.danger,
        isSuccess && styles.success,
        !isSecondary && !isDanger && !isSuccess && styles.primary,
        (pressed || disabled) && styles.dimmed
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isSecondary ? COLORS.primary : COLORS.surface} />
      ) : (
        <Text style={[styles.text, isSecondary ? styles.secondaryText : styles.primaryText]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 50,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  compact: {
    minHeight: 42,
    paddingHorizontal: 12
  },
  primary: {
    backgroundColor: COLORS.primary
  },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary
  },
  danger: {
    backgroundColor: COLORS.danger
  },
  success: {
    backgroundColor: COLORS.success
  },
  text: {
    fontSize: 16,
    fontWeight: "700"
  },
  primaryText: {
    color: COLORS.surface
  },
  secondaryText: {
    color: COLORS.primary
  },
  dimmed: {
    opacity: 0.7
  }
});
