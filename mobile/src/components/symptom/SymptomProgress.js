import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";

export default function SymptomProgress({ current, total, label }) {
  const progress = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.textRow}>
        <Text style={styles.label}>{label || `Question ${current} of ${total}`}</Text>
        <Text style={styles.count}>{current}/{total}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs
  },
  textRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  label: {
    flex: 1,
    ...typography.bodyStrong,
    color: colors.primaryDark
  },
  count: {
    color: colors.textSecondary,
    fontWeight: "700"
  },
  track: {
    height: 6,
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.border
  },
  fill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.teal
  }
});
