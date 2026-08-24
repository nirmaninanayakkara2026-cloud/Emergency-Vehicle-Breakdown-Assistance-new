import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import SymptomSummaryCard from "../../components/symptom/SymptomSummaryCard";
import MainProblemGrid from "../../components/symptom/MainProblemGrid";
import EmptyState from "../../components/ui/EmptyState";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import { SYMPTOM_BREAKDOWN_TYPES } from "../../data/symptomQuestionFlows";
import {
  buildSymptomDescription,
  buildSymptomSummary
} from "../../services/symptomCaptureService";
import { getTroubleshootingHistory, startSelfAssistant } from "../../services/selfAssistantService";
import { COLORS, VEHICLE_TYPES } from "../../utils/constants";
import { formatSymptomValue } from "../../utils/symptomDisplay";
import { colors, radii, spacing, typography } from "../../theme";
import { buildSelfAssistantMechanicPrefill, buildSelfAssistantPayload, routeSelfAssistantResponse } from "../../utils/selfAssistantFlow";

export default function SelfBreakdownAssistantScreen({ navigation, route }) {
  const [vehicleType, setVehicleType] = useState("car");
  const [breakdownType, setBreakdownType] = useState("vehicle_not_starting");
  const [problemDescription, setProblemDescription] = useState("");
  const [guidedSymptoms, setGuidedSymptoms] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const guidedSummary = guidedSymptoms ? buildSymptomSummary(guidedSymptoms) : null;

  const loadHistory = useCallback(async () => {
    try {
      const response = await getTroubleshootingHistory();
      setHistory((response.sessions || []).slice(0, 5));
    } catch (_error) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const captured = route.params?.guidedSymptoms;
    if (!captured) return;
    setGuidedSymptoms(captured);
    setVehicleType(captured.vehicleType);
    setBreakdownType(captured.breakdownType);
    setProblemDescription(captured.description || "");
  }, [route.params?.guidedSymptoms]);

  function openGuidedSymptoms() {
    navigation.navigate("GuidedSymptomCapture", {
      sourceRoute: "SelfBreakdownAssistant",
      vehicleType,
      breakdownType,
      initialData: guidedSymptoms || {
        vehicleType,
        breakdownType,
        symptoms: {},
        observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
        description: problemDescription
      }
    });
  }

  function currentPayload() {
    const symptomData = guidedSymptoms || {
      vehicleType,
      breakdownType,
      symptoms: {},
      observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
      description: problemDescription
    };
    return buildSelfAssistantPayload(symptomData, {
      vehicleType,
      breakdownType,
      problemDescription,
      diagnosticInputText: guidedSymptoms ? buildSymptomDescription(guidedSymptoms) : problemDescription.trim()
    });
  }

  async function handleStart() {
    setError("");
    setLoading(true);
    try {
      const payload = currentPayload();
      const response = await startSelfAssistant(payload);
      routeSelfAssistantResponse(navigation, response, payload);
    } catch (startError) {
      setError(startError.message);
    } finally {
      setLoading(false);
    }
  }

  function resumeSession(item) {
    const payload = {
      vehicleType: item.vehicleType,
      breakdownType: item.breakdownType,
      symptomCapture: item.symptomCapture,
      diagnosticInputText: item.diagnosticInputText,
      problemDescription: item.diagnosticInputText
    };
    const aiPrediction = {
      predictedFault: item.predictedFault?.fault,
      faultLabel: item.predictedFault?.label,
      confidence: item.predictedFault?.confidence,
      confidenceLevel: item.predictedFault?.confidenceLevel,
      requiredService: item.recommendedService
    };
    const prefill = buildSelfAssistantMechanicPrefill(payload, { session: item, aiPrediction });
    if (item.status === "awaiting_safety_confirmation") {
      navigation.navigate("SelfAssistantSafety", { sessionId: item._id, session: item, safetyWarning: item.safetyWarning, beforeYouBegin: item.beforeYouBegin, prefill, aiPrediction });
    } else if (item.status === "in_progress") {
      navigation.navigate("TroubleshootingConversation", { sessionId: item._id, session: item, currentStep: item.currentStep, currentPhase: item.currentPhase, riskLevel: item.riskLevel, prefill, aiPrediction });
    } else if (item.status === "awaiting_resolution_confirmation") {
      navigation.navigate("SelfAssistantResult", { sessionId: item._id, session: item, status: "resolved", message: "That completes the basic troubleshooting steps.", recommendedService: item.recommendedService, riskLevel: item.riskLevel, prefill, aiPrediction });
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader eyebrow="Safe guided checks" title="Self Breakdown Assistant" subtitle="Try safe guided checks for suitable vehicle problems." />
      <View style={styles.heroIcon}><Ionicons name="shield-checkmark" size={38} color={colors.teal} /></View>
      <InfoBanner tone="info" title="Safety comes first" message="If an issue may be unsafe, we'll recommend professional assistance instead." />
      <AppCard>
        <SectionHeader title="Tell us what happened" subtitle="We'll check whether a guided self-check is suitable." />
        <AppSelect label="Vehicle type" options={VEHICLE_TYPES} value={vehicleType} onChange={setVehicleType} />
        <Text style={styles.fieldLabel}>Main problem</Text>
        <MainProblemGrid options={SYMPTOM_BREAKDOWN_TYPES} value={breakdownType} onChange={setBreakdownType} />
        <AppInput label="What did you notice?" value={problemDescription} onChangeText={setProblemDescription} multiline />
        <AppButton title={guidedSymptoms ? "Edit Guided Symptoms" : "Smart Guided Symptom Capture"} variant="secondary" onPress={openGuidedSymptoms} />
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        <AppButton title="Start Safety Check" icon="shield-checkmark-outline" onPress={handleStart} loading={loading} />
        <AppButton title="Request Mechanic Instead" icon="construct-outline" variant="secondary" onPress={() => navigation.navigate("RequestMechanic", { prefill: buildSelfAssistantMechanicPrefill(currentPayload()) })} />
      </AppCard>
      {guidedSummary ? <SymptomSummaryCard summary={guidedSummary} compact /> : null}
      <AppCard>
        <SectionHeader title="Recent Checks" subtitle="Your latest self-assistance sessions." />
        {historyLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
        {!historyLoading && history.length === 0 ? <EmptyState title="No recent checks" message="Completed safety checks will appear here." icon="time-outline" /> : null}
        {history.map((item) => (
          <Pressable key={item._id} accessibilityRole="button" disabled={!["awaiting_safety_confirmation", "in_progress", "awaiting_resolution_confirmation"].includes(item.status)} onPress={() => resumeSession(item)} style={styles.historyRow}>
            <Text style={styles.historyText}>
            {new Date(item.createdAt).toLocaleDateString()} · {item.vehicleType} · {item.predictedFault?.label || formatSymptomValue(item.breakdownType)} · {formatSymptomValue(item.status)}
            </Text>
            {["awaiting_safety_confirmation", "in_progress", "awaiting_resolution_confirmation"].includes(item.status) ? <Text style={styles.resumeText}>Resume</Text> : null}
          </Pressable>
        ))}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...typography.bodyStrong, color: colors.primaryDark },
  subtitle: { color: COLORS.muted, lineHeight: 21 },
  heroIcon: { width: 82, height: 82, borderRadius: radii.lg, alignSelf: "center", backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" },
  infoCard: { gap: spacing.sm, backgroundColor: colors.amberLight, borderRadius: radii.md, padding: spacing.md },
  infoTitle: { color: COLORS.primaryDark, fontWeight: "800", lineHeight: 21 },
  error: { color: COLORS.danger, fontWeight: "700", lineHeight: 20 },
  historyRow: { gap: spacing.xxs, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  historyText: { color: COLORS.text, lineHeight: 21, textTransform: "capitalize" },
  resumeText: { ...typography.caption, color: colors.teal, fontWeight: "800" }
});
