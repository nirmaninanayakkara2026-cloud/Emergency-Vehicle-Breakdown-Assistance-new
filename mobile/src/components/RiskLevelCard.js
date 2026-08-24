import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import StatusBadge from "./ui/StatusBadge";
import { colors, radii, spacing, typography } from "../theme";
import { getRiskDetails } from "../utils/troubleshootingRisk";

const palette = {
  low: { background: colors.greenLight, border: "#BFE9D0", accent: colors.green, icon: "checkmark-circle" },
  caution: { background: colors.amberLight, border: "#F5D69D", accent: colors.amber, icon: "warning" },
  high: { background: colors.dangerLight, border: "#F5CACA", accent: colors.danger, icon: "shield" }
};
export default function RiskLevelCard({ riskLevel }) {
  const details = getRiskDetails(riskLevel); const tone = palette[riskLevel] || palette.high;
  return <View style={[styles.card, { backgroundColor: tone.background, borderColor: tone.border }]}><View style={[styles.icon, { backgroundColor: colors.surface }]}><Ionicons name={tone.icon} size={27} color={tone.accent} /></View><View style={styles.copy}><StatusBadge risk={riskLevel} /><Text style={styles.title}>{details.title}</Text><Text style={styles.explanation}>{details.explanation}</Text></View></View>;
}
const styles = StyleSheet.create({ card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "center" }, icon: { width: 50, height: 50, borderRadius: radii.md, alignItems: "center", justifyContent: "center" }, copy: { flex: 1, gap: spacing.xxs }, title: { ...typography.cardTitle, color: colors.textPrimary }, explanation: { ...typography.body, color: colors.textSecondary } });
