import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppCard from "./AppCard";
import StatusBadge from "./ui/StatusBadge";
import { colors, radii, spacing, typography } from "../theme";
import { formatFaultLabel, formatServiceType } from "../utils/displayLabels";

export function formatServiceLabel(value) {
  return value ? formatServiceType(value) : "Service recommendation unavailable";
}

function formatConfidenceLevel(value) {
  if (!value) return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export default function PredictionSummaryCard({ prediction, title = "Possible Problem" }) {
  if (!prediction) return null;
  const fromModel = prediction.predictionSource === "ai_model";
  const hasPossibleProblem = Boolean(
    prediction.predictedFault ||
    (prediction.faultLabel && prediction.faultLabel !== "Fault classification unavailable")
  );
  const confidence = prediction.confidenceLevel;
  const tone = confidence === "high" ? "success" : confidence === "low" ? "warning" : "info";
  return (
    <AppCard style={styles.card}>
      <View style={styles.heading}><View style={styles.icon}><Ionicons name="sparkles" size={23} color={colors.blue} /></View><Text style={styles.title}>{title}</Text></View>
      {hasPossibleProblem ? <><Text style={styles.label}>Possible Problem</Text><Text style={styles.value}>{formatFaultLabel(prediction.predictedFault, prediction.faultLabel)}</Text></> : null}
      <Text style={styles.label}>Recommended Service</Text>
      <Text style={styles.value}>{formatServiceLabel(prediction.requiredService)}</Text>
      {fromModel ? <><Text style={styles.label}>Confidence</Text><StatusBadge label={`${formatConfidenceLevel(confidence)} confidence`} tone={tone} /></> : null}
      {fromModel && prediction.isAmbiguous ? <Text style={styles.notice}>Some symptoms may match more than one type of vehicle problem.</Text> : null}
      {prediction.fallbackUsed ? <Text style={styles.notice}>General mechanic fallback used.</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.blueLight, borderColor: "#D8E8FF" },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { ...typography.sectionTitle, flex: 1, color: colors.primaryDark },
  label: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  value: { ...typography.cardTitle, color: colors.textPrimary },
  notice: { ...typography.bodyStrong, color: "#9A650C" }
});
