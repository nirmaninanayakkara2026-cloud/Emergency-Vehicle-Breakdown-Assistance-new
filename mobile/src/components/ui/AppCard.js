import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, shadows, spacing } from "../../theme";

export default function AppCard({ children, style, accessibilityLabel }) {
  return <View accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadows.card
  }
});
