import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "./AppButton";
import AppCard from "./AppCard";
import SymptomProgress from "./symptom/SymptomProgress";
import { colors, radii, spacing, typography } from "../theme";
export default function TroubleshootingStepCard({ step, stepNumber, totalSteps, completed, onCompleted }) {
  return <AppCard><SymptomProgress current={stepNumber} total={totalSteps} label={`Step ${stepNumber} of ${totalSteps}`} /><View style={styles.icon}><Ionicons name="search-outline" size={27} color={colors.teal} /></View><Text style={styles.title}>{step.title}</Text><Text style={styles.instruction}>{step.instruction}</Text><AppButton title={completed ? "Completed" : "Mark Completed"} icon={completed ? "checkmark-circle-outline" : "arrow-forward"} variant={completed ? "success" : "secondary"} onPress={onCompleted} /></AppCard>;
}
const styles = StyleSheet.create({ icon: { width: 50, height: 50, borderRadius: radii.md, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" }, title: { ...typography.sectionTitle, color: colors.textPrimary }, instruction: { ...typography.body, color: colors.textSecondary } });
