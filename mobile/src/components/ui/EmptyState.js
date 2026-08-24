import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "./AppButton";
import { colors, spacing, typography } from "../../theme";
export default function EmptyState({ title = "Nothing here yet", message, icon = "file-tray-outline", actionLabel, onAction, secondaryLabel, onSecondary }) {
  return <View style={styles.state}><View style={styles.icon}><Ionicons name={icon} size={30} color={colors.teal} /></View><Text style={styles.title}>{title}</Text>{message ? <Text style={styles.message}>{message}</Text> : null}{actionLabel ? <AppButton title={actionLabel} onPress={onAction} style={styles.button} /> : null}{secondaryLabel ? <AppButton title={secondaryLabel} variant="secondary" onPress={onSecondary} style={styles.button} /> : null}</View>;
}
const styles = StyleSheet.create({ state: { alignItems: "center", gap: spacing.sm, padding: spacing.xl }, icon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" }, title: { ...typography.sectionTitle, color: colors.textPrimary, textAlign: "center" }, message: { ...typography.body, color: colors.textSecondary, textAlign: "center" }, button: { alignSelf: "stretch", marginTop: spacing.xs } });
