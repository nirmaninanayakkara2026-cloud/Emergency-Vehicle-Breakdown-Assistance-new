import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../../theme";

const TONES = {
  info: { bg: colors.blueLight, color: colors.blue, icon: "information-circle" },
  success: { bg: colors.greenLight, color: colors.green, icon: "checkmark-circle" },
  warning: { bg: colors.amberLight, color: "#9A650C", icon: "warning" },
  danger: { bg: colors.dangerLight, color: colors.danger, icon: "alert-circle" }
};
export default function InfoBanner({ title, message, tone = "info" }) {
  const style = TONES[tone] || TONES.info;
  return <View style={[styles.banner, { backgroundColor: style.bg }]}><Ionicons name={style.icon} size={22} color={style.color} /><View style={styles.copy}>{title ? <Text style={[styles.title, { color: style.color }]}>{title}</Text> : null}<Text style={styles.message}>{message}</Text></View></View>;
}
const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm, borderRadius: radii.md, padding: spacing.md },
  copy: { flex: 1, gap: spacing.xxs },
  title: { ...typography.bodyStrong },
  message: { ...typography.body, color: colors.textPrimary }
});
