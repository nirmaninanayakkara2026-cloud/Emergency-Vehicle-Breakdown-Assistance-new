import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import { confirmSafety, triggerStopCondition } from "../../services/selfAssistantService";
import { colors, radii, spacing, typography } from "../../theme";

export default function SelfAssistantSafetyScreen({ navigation, route }) {
  const { sessionId, safetyWarning, beforeYouBegin = [], prefill, aiPrediction } = route.params || {};
  const [confirmed, setConfirmed] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function continueSafely() { setLoading(true); setError(""); try { const response = await confirmSafety(sessionId); if (response.status === "in_progress") navigation.replace("TroubleshootingConversation", { sessionId, session: response.session, currentStep: response.currentStep, prefill, aiPrediction }); else navigation.replace("SelfAssistantResult", { ...route.params, status: response.status, message: response.message }); } catch (confirmationError) { setError(confirmationError.message); } finally { setLoading(false); } }
  async function requestMechanic() { try { await triggerStopCondition(sessionId, "User requested professional assistance"); } catch (_error) {} navigation.navigate("RequestMechanic", { prefill }); }
  const checklist = beforeYouBegin.length ? beforeYouBegin : ["Park safely away from traffic", "Apply the parking brake", "Stop if anything feels unsafe"];
  return <ScreenContainer>
    <ScreenHeader eyebrow="Safety check" title="Continue With Care" subtitle="Read each point before starting this guided check." right={<StatusBadge risk="caution" />} />
    <AppCard style={styles.warningCard}><View style={styles.warningIcon}><Ionicons name="warning" size={31} color={colors.amber} /></View><Text style={styles.warning}>{safetyWarning || "Continue only when the vehicle is safely parked and you feel comfortable."}</Text><Text style={styles.heading}>Before you begin</Text>{checklist.map((item) => <View key={item} style={styles.item}><Ionicons name="checkmark-circle" size={21} color={colors.green} /><Text style={styles.body}>{item}</Text></View>)}</AppCard>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }} onPress={() => setConfirmed((value) => !value)} style={[styles.checkboxRow, confirmed && styles.confirmed]}><View style={[styles.checkbox, confirmed && styles.checked]}>{confirmed ? <Ionicons name="checkmark" size={18} color={colors.surface} /> : null}</View><Text style={styles.checkboxLabel}>I have read and understood the safety warning.</Text></Pressable>
    {error ? <InfoBanner tone="danger" message={error} /> : null}
    <AppButton title="Continue Safely" icon="arrow-forward" disabled={!confirmed} loading={loading} onPress={continueSafely} />
    <AppButton title="Request Mechanic Instead" icon="construct-outline" variant="secondary" onPress={requestMechanic} />
  </ScreenContainer>;
}
const styles = StyleSheet.create({ warningCard: { borderColor: "#F5D69D", backgroundColor: colors.amberLight }, warningIcon: { width: 58, height: 58, borderRadius: radii.lg, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, warning: { ...typography.bodyStrong, color: colors.textPrimary }, heading: { ...typography.cardTitle, color: colors.primaryDark, marginTop: spacing.xs }, item: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }, body: { ...typography.body, flex: 1, color: colors.textPrimary }, checkboxRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface }, confirmed: { borderColor: colors.teal, backgroundColor: colors.tealLight }, checkbox: { width: 26, height: 26, borderWidth: 2, borderColor: colors.teal, borderRadius: 7, alignItems: "center", justifyContent: "center" }, checked: { backgroundColor: colors.teal }, checkboxLabel: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary } });
