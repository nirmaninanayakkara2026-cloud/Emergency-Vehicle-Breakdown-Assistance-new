import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppSelect from "../../components/AppSelect";
import ScreenContainer from "../../components/ScreenContainer";
import SymptomSummaryCard from "../../components/symptom/SymptomSummaryCard";
import MainProblemGrid from "../../components/symptom/MainProblemGrid";
import EmptyState from "../../components/ui/EmptyState";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import SectionHeader from "../../components/ui/SectionHeader";
import { DRIVER_OPTIONS, getAssistanceProblems } from "../../data/assistanceOptions";
import {
  buildSymptomDescription,
  buildSymptomSummary,
} from "../../services/symptomCaptureService";
import {
  getTroubleshootingHistory,
} from "../../services/selfAssistantService";
import { COLORS, VEHICLE_TYPES } from "../../utils/constants";
import { formatSymptomValue } from "../../utils/symptomDisplay";
import { colors, radii, spacing, typography } from "../../theme";
import {
  buildSelfAssistantMechanicPrefill,
  buildSelfAssistantPayload,
} from "../../utils/selfAssistantFlow";

export default function SelfBreakdownAssistantScreen({ navigation, route }) {
  // Store symptom input, guided capture state, history, and request state.
  const [vehicleType, setVehicleType] = useState("car");
  const [driverType, setDriverType] = useState(null);
  const [breakdownType, setBreakdownType] = useState("vehicle_not_starting");
  const [problemDescription, setProblemDescription] = useState("");
  const [guidedSymptoms, setGuidedSymptoms] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const guidedSummary = guidedSymptoms
    ? buildSymptomSummary(guidedSymptoms)
    : null;

  // Load the driver's recent self-assistance sessions.
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

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Restore guided symptoms returned from the capture screen.
  useEffect(() => {
    const captured = route.params?.guidedSymptoms;
    if (!captured) return;
    setGuidedSymptoms(captured);
    setDriverType(captured.driverType || "non_technical");
    setVehicleType(captured.vehicleType);
    setBreakdownType(captured.breakdownType);
    setProblemDescription(captured.description || "");
  }, [route.params?.guidedSymptoms]);

  // Clear guided answers when the selected vehicle changes.
  function changeVehicleType(nextVehicleType) {
    if (guidedSymptoms && guidedSymptoms.vehicleType !== nextVehicleType)
      setGuidedSymptoms(null);
    const availableProblems = getAssistanceProblems(driverType, nextVehicleType);
    if (!availableProblems.some((item) => item.value === breakdownType))
      setBreakdownType(availableProblems[0]?.value || "other");
    setVehicleType(nextVehicleType);
  }

  // Clear guided answers when the selected problem changes.
  function changeBreakdownType(nextBreakdownType) {
    if (guidedSymptoms && guidedSymptoms.breakdownType !== nextBreakdownType)
      setGuidedSymptoms(null);
    setBreakdownType(nextBreakdownType);
  }

  // Open guided symptom capture with compatible draft data.
  function openGuidedSymptoms() {
    const currentGuidedSymptoms =
      guidedSymptoms?.vehicleType === vehicleType &&
      guidedSymptoms?.breakdownType === breakdownType
        ? guidedSymptoms
        : null;
    navigation.navigate("GuidedSymptomCapture", {
      sourceRoute: "SelfBreakdownAssistant",
      driverType,
      vehicleType,
      breakdownType,
      initialData: currentGuidedSymptoms || {
        driverType,
        vehicleType,
        breakdownType,
        symptoms: {},
        observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
        description: problemDescription,
      },
    });
  }

  // Build the payload shared by self-assistance and mechanic fallback flows.
  function currentPayload() {
    const symptomData = guidedSymptoms || {
      driverType,
      vehicleType,
      breakdownType,
      symptoms: {},
      observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
      description: problemDescription,
    };
    return buildSelfAssistantPayload(symptomData, {
      vehicleType,
      breakdownType,
      problemDescription,
      diagnosticInputText: guidedSymptoms
        ? buildSymptomDescription(guidedSymptoms)
        : problemDescription.trim(),
    });
  }

  // Reopen an unfinished self-assistance session from history.
  function resumeSession(item) {
    const payload = {
      vehicleType: item.vehicleType,
      breakdownType: item.breakdownType,
      symptomCapture: item.symptomCapture,
      driverType: item.driverType,
      diagnosticInputText: item.diagnosticInputText,
      problemDescription: item.diagnosticInputText,
    };
    const aiPrediction = {
      predictedFault: item.predictedFault?.fault,
      faultLabel: item.predictedFault?.label,
      confidence: item.predictedFault?.confidence,
      confidenceLevel: item.predictedFault?.confidenceLevel,
      requiredService: item.recommendedService,
    };
    const prefill = buildSelfAssistantMechanicPrefill(payload, {
      session: item,
      aiPrediction,
    });
    if (item.status === "awaiting_safety_confirmation") {
      navigation.navigate("SelfAssistantSafety", {
        sessionId: item._id,
        session: item,
        safetyWarning: item.safetyWarning,
        beforeYouBegin: item.beforeYouBegin,
        prefill,
        aiPrediction,
      });
    } else if (["in_progress", "awaiting_resolution_confirmation"].includes(item.status)) {
      navigation.navigate("TroubleshootingConversation", {
        sessionId: item._id,
        session: item,
        currentStep: item.currentStep,
        currentPhase: item.currentPhase,
        riskLevel: item.riskLevel,
        prefill,
        aiPrediction,
      });
    }
  }

  return (
    <ScreenContainer>
      {/* Self-assistant header and safety introduction. */}
      <ScreenHeader
        eyebrow="Safe guided checks"
        title="AI Assistance"
        subtitle="Answer a few questions to find suitable guidance."
      />
      <View style={styles.heroIcon}>
        <Ionicons name="shield-checkmark" size={38} color={colors.teal} />
      </View>
      <InfoBanner
        tone="info"
        title="Safety comes first"
        message="If an issue may be unsafe, we'll recommend professional assistance instead."
      />
      {/* Symptom input, guided capture, and assistant start actions. */}
      <AppCard>
        <SectionHeader
          title="How would you like to identify the problem?"
          subtitle="Choose the option that feels right for you."
        />
        {DRIVER_OPTIONS.map((option) => (
          <AppButton key={option.value} title={option.label}
            variant={driverType === option.value ? "primary" : "secondary"}
            onPress={() => {
              setDriverType(option.value);
              setBreakdownType(option.value === "technical" ? "electrical_problem" : "vehicle_not_starting");
              setGuidedSymptoms(null);
              setProblemDescription("");
            }} />
        ))}
      </AppCard>
      {driverType ? <AppCard>
        <AppSelect
          label="Vehicle type"
          options={VEHICLE_TYPES}
          value={vehicleType}
          onChange={changeVehicleType}
        />
        <Text style={styles.fieldLabel}>{driverType === "technical" ? "Select Problem Category" : "What are you noticing with your vehicle?"}</Text>
        <MainProblemGrid
          options={getAssistanceProblems(driverType, vehicleType)}
          value={breakdownType}
          onChange={changeBreakdownType}
        />
        <AppButton
          title={
            guidedSymptoms
              ? "Edit Guided Symptoms"
              : "Continue to Questions"
          }
          variant="secondary"
          onPress={openGuidedSymptoms}
        />
        <AppButton
          title="Request Mechanic Instead"
          icon="construct-outline"
          variant="secondary"
          onPress={() =>
            navigation.navigate("RequestMechanic", {
              prefill: buildSelfAssistantMechanicPrefill(currentPayload()),
            })
          }
        />
      </AppCard> : null}
      {/* Summary of captured guided symptoms. */}
      {guidedSummary ? (
        <SymptomSummaryCard summary={guidedSummary} compact />
      ) : null}
      {/* Recent self-assistance sessions and resume actions. */}
      <AppCard>
        <SectionHeader
          title="Recent Checks"
          subtitle="Your latest self-assistance sessions."
        />
        {historyLoading ? <ActivityIndicator color={COLORS.primary} /> : null}
        {!historyLoading && history.length === 0 ? (
          <EmptyState
            title="No recent checks"
            message="Completed safety checks will appear here."
            icon="time-outline"
          />
        ) : null}
        {history.map((item) => (
          <Pressable
            key={item._id}
            accessibilityRole="button"
            disabled={
              ![
                "awaiting_safety_confirmation",
                "in_progress",
                "awaiting_resolution_confirmation",
              ].includes(item.status)
            }
            onPress={() => resumeSession(item)}
            style={styles.historyRow}
          >
            <Text style={styles.historyText}>
              {new Date(item.createdAt).toLocaleDateString()} ·{" "}
              {item.vehicleType} ·{" "}
              {item.predictedFault?.label ||
                formatSymptomValue(item.breakdownType)}{" "}
              · {formatSymptomValue(item.status)}
            </Text>
            {[
              "awaiting_safety_confirmation",
              "in_progress",
              "awaiting_resolution_confirmation",
            ].includes(item.status) ? (
              <Text style={styles.resumeText}>Resume</Text>
            ) : null}
          </Pressable>
        ))}
      </AppCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { ...typography.bodyStrong, color: colors.primaryDark },
  subtitle: { color: COLORS.muted, lineHeight: 21 },
  heroIcon: {
    width: 82,
    height: 82,
    borderRadius: radii.lg,
    alignSelf: "center",
    backgroundColor: colors.tealLight,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCard: {
    gap: spacing.sm,
    backgroundColor: colors.amberLight,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  infoTitle: { color: COLORS.primaryDark, fontWeight: "800", lineHeight: 21 },
  error: { color: COLORS.danger, fontWeight: "700", lineHeight: 20 },
  historyRow: {
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyText: {
    color: COLORS.text,
    lineHeight: 21,
    textTransform: "capitalize",
  },
  resumeText: { ...typography.caption, color: colors.teal, fontWeight: "800" },
});
