import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../../theme";
import { formatRequestStatus, formatRiskLevel } from "../../utils/displayLabels";

const TONES = {
  success: [colors.greenLight, colors.green],
  warning: [colors.amberLight, "#9A650C"],
  danger: [colors.dangerLight, colors.danger],
  info: [colors.blueLight, colors.blue],
  neutral: [colors.softSurface, colors.textSecondary]
};

export default function StatusBadge({ label, status, risk, tone = "neutral", icon }) {
  const displayed = label || (risk ? formatRiskLevel(risk) : formatRequestStatus(status));
  const inferredTone = risk === "high" ? "danger" : risk === "caution" ? "warning" : risk === "low" ? "success" : tone;
  const [backgroundColor, color] = TONES[inferredTone] || TONES.neutral;
  return <View style={[styles.badge, { backgroundColor }]}><Text style={[styles.text, { color }]}>{icon ? `${icon} ` : ""}{displayed}</Text></View>;
}
const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  text: { ...typography.caption, fontWeight: "700" }
});
