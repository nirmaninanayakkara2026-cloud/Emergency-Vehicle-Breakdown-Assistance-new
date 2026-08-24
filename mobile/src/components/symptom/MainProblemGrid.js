import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, typography } from "../../theme";

const problemIcons = {
  vehicle_not_starting: "car-outline",
  engine_problem: "cog-outline",
  engine_overheating: "thermometer-outline",
  flat_tyre: "disc-outline",
  brake_problem: "warning-outline",
  electrical_problem: "flash-outline",
  fuel_problem: "water-outline",
  steering_problem: "navigate-circle-outline",
  transmission_problem: "git-compare-outline",
  strange_noise: "volume-high-outline",
  other: "help-circle-outline"
};

export default function MainProblemGrid({ options, value, onChange }) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.card,
              selected && styles.cardSelected,
              pressed && styles.cardPressed
            ]}
          >
            <Ionicons
              name={problemIcons[option.value] || problemIcons.other}
              size={28}
              color={selected ? colors.teal : colors.textSecondary}
            />
            <Text
              numberOfLines={2}
              ellipsizeMode="tail"
              style={[styles.label, selected && styles.labelSelected]}
            >
              {option.label}
            </Text>
            {selected ? (
              <Ionicons
                name="checkmark-circle"
                size={19}
                color={colors.teal}
                style={styles.check}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between"
  },
  card: {
    width: "48%",
    height: 108,
    minHeight: 108,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.tealLight
  },
  cardPressed: {
    opacity: 0.82
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    lineHeight: 19,
    textAlign: "center"
  },
  labelSelected: {
    color: colors.primaryDark
  },
  check: {
    position: "absolute",
    top: 9,
    right: 9
  }
});
