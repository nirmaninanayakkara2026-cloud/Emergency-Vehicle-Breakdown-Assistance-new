import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

export default function AppSelect({ label, options, value, onChange, disabled = false }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.options}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.selectedOption, disabled && styles.disabled]}
            >
              <Text style={[styles.optionText, selected && styles.selectedText]}>{option.label}</Text>
              {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.teal} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  label: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: "600"
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  option: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  selectedOption: {
    backgroundColor: colors.tealLight,
    borderColor: colors.teal
  },
  optionText: {
    ...typography.body,
    color: colors.textPrimary
  },
  selectedText: {
    color: colors.primaryDark,
    fontWeight: "600"
  },
  disabled: { opacity: 0.55 }
});
