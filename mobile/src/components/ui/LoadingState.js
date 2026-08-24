import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";
export default function LoadingState({ message = "Loading information..." }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={message} style={styles.state}><ActivityIndicator size="large" color={colors.teal} /><Text style={styles.text}>{message}</Text></View>;
}
const styles = StyleSheet.create({ state: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl }, text: { ...typography.bodyStrong, color: colors.textSecondary, textAlign: "center" } });
