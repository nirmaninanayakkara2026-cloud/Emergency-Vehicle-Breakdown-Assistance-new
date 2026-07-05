import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../utils/constants";

export default function AppSelect({ label, options, value, onChange }) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.options}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.option, selected && styles.selectedOption]}
            >
              <Text style={[styles.optionText, selected && styles.selectedText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8
  },
  label: {
    color: COLORS.text,
    fontWeight: "700"
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface
  },
  selectedOption: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  optionText: {
    color: COLORS.text,
    textTransform: "capitalize"
  },
  selectedText: {
    color: COLORS.surface,
    fontWeight: "700"
  }
});
