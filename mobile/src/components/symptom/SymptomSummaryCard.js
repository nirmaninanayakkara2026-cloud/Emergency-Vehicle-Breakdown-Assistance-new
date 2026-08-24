import React from "react";
import { StyleSheet, Text, View } from "react-native";
import AppCard from "../AppCard";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme";

function SummaryRow({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || "Not provided"}</Text>
    </View>
  );
}

export default function SymptomSummaryCard({ summary, compact = false }) {
  return (
    <AppCard>
      {!compact ? <View style={styles.heading}><View style={styles.icon}><Ionicons name="checkmark-circle" size={26} color={colors.teal} /></View><Text style={styles.title}>What We Understood</Text></View> : null}
      <SummaryRow label="Vehicle" value={summary.vehicle} />
      <SummaryRow label="Main Problem" value={summary.mainProblem} />
      {summary.answers.map((item) => (
        <SummaryRow key={item.key} label={item.label} value={item.value} />
      ))}
      {summary.observations.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What else was noticed</Text>
          {summary.observations.map((item) => (
            <SummaryRow key={item.key} label={item.label} value={item.value} />
          ))}
        </View>
      ) : null}
      <SummaryRow label="Additional description" value={summary.description} />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.sectionTitle,
    color: colors.primaryDark
  },
  heading: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  icon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" },
  section: {
    gap: spacing.xs,
    paddingTop: 4
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontWeight: "800"
  },
  row: {
    gap: spacing.xxs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700"
  },
  value: {
    ...typography.body,
    color: colors.textPrimary
  }
});
