import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme";

export default function SymptomChip({ label, selected, onPress, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selectedChip,
        pressed && styles.pressed,
        style
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
      {selected ? <Ionicons name="checkmark-circle" size={20} color={colors.teal} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface
  },
  selectedChip: {
    borderColor: colors.teal,
    backgroundColor: colors.tealLight
  },
  label: {
    ...typography.bodyStrong,
    flexShrink: 1,
    color: colors.textPrimary
  },
  selectedLabel: {
    color: colors.primaryDark
  },
  pressed: {
    opacity: 0.75
  }
});
