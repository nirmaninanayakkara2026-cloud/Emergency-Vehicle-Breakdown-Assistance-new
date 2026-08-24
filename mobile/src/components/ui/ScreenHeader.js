import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";
export default function ScreenHeader({ eyebrow, title, subtitle, right }) {
  return <View style={styles.row}><View style={styles.copy}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>{right || null}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md }, copy: { flex: 1, gap: spacing.xs }, eyebrow: { ...typography.caption, color: colors.teal, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7 }, title: { ...typography.pageTitle, color: colors.primaryDark }, subtitle: { ...typography.body, color: colors.textSecondary } });
