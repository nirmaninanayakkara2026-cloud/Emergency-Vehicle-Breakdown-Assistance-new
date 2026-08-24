import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import {
  confirmTroubleshootingAction,
  submitTroubleshootingStep,
  triggerStopCondition
} from "../../services/selfAssistantService";
import { colors, radii, spacing, typography } from "../../theme";
import { formatFaultLabel } from "../../utils/displayLabels";

const UNSAFE_CONDITIONS = [
  { label: "Smoke", value: "smoke" },
  { label: "Fire", value: "fire" },
  { label: "Fuel smell or leak", value: "fuel smell or leak" },
  { label: "Burning smell", value: "burning smell" },
  { label: "Serious fluid leak", value: "serious fluid leak" },
  { label: "Vehicle unstable", value: "vehicle instability" },
  { label: "Other unsafe condition", value: "unexpected dangerous condition" }
];

function restoredMessages(session, aiPrediction, currentStep) {
  const messages = aiPrediction?.faultLabel ? [{
    role: "assistant",
    text: `Your symptoms may indicate ${formatFaultLabel(aiPrediction.predictedFault, aiPrediction.faultLabel)}.`
  }] : [];
  for (const completed of session?.completedSteps || []) {
    if (completed.instruction) messages.push({ role: "assistant", text: completed.instruction });
    messages.push({ role: "user", text: "Done – I Checked" });
    messages.push({ role: "assistant", text: "Great. What did you observe?" });
    messages.push({ role: "user", text: completed.resultLabel || completed.selectedResult });
    messages.push({ role: "assistant", text: "Okay. Let's continue with the next check." });
  }
  if (currentStep?.instruction) messages.push({ role: "assistant", text: currentStep.instruction });
  return messages;
}

export default function TroubleshootingConversationScreen({ navigation, route }) {
  const { sessionId, aiPrediction, prefill } = route.params || {};
  const initialSession = route.params?.session || {};
  const initialStep = route.params?.currentStep || initialSession.currentStep;
  const [activeSession, setActiveSession] = useState(initialSession);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [currentPhase, setCurrentPhase] = useState(
    route.params?.currentPhase || initialSession.currentPhase || "instruction"
  );
  const [messages, setMessages] = useState(() =>
    restoredMessages(initialSession, aiPrediction, initialStep)
  );
  const [unsafeOpen, setUnsafeOpen] = useState(false);
  const [cannotContinue, setCannotContinue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const answerOptions = useMemo(() => {
    const approved = currentStep?.possible_results || [];
    return approved.some((item) => item.value === "not_sure")
      ? approved
      : [...approved, { value: "not_sure", label: "Not Sure" }];
  }, [currentStep]);

  const checkNumber = (activeSession?.completedSteps?.length || 0) + 1;

  function showResult(response) {
    navigation.replace("SelfAssistantResult", {
      sessionId,
      session: response.session || activeSession,
      aiPrediction,
      prefill,
      status: response.status,
      message: response.status === "resolved"
        ? "That completes the basic troubleshooting steps."
        : response.message,
      recommendedService: response.recommendedService,
      riskLevel: route.params?.riskLevel || activeSession?.riskLevel
    });
  }

  async function confirmAction() {
    if (!currentStep || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await confirmTroubleshootingAction(sessionId, currentStep.step_id);
      setActiveSession(response.session || activeSession);
      setMessages((items) => [
        ...items,
        { role: "user", text: "Done – I Checked" },
        { role: "assistant", text: currentStep.result_question || currentStep.question || "Great. What did you observe?" }
      ]);
      setCurrentPhase("result");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function chooseAnswer(option) {
    if (!currentStep || currentPhase !== "result" || submittingRef.current) return;
    submittingRef.current = true;
    setCurrentPhase("processing");
    setLoading(true);
    setError("");
    setMessages((items) => [...items, { role: "user", text: option.label }]);
    try {
      const response = await submitTroubleshootingStep(
        sessionId,
        currentStep.step_id,
        option.value
      );
      if (response.status === "in_progress" && response.nextStep) {
        setActiveSession(response.session || activeSession);
        setCurrentStep(response.nextStep);
        setMessages((items) => [
          ...items,
          { role: "assistant", text: "Okay. Let's continue with the next check." },
          { role: "assistant", text: response.nextStep.instruction }
        ]);
        setCurrentPhase("instruction");
      } else {
        setCurrentPhase("completed");
        showResult(response);
      }
    } catch (stepError) {
      setError(stepError.message);
      setCurrentPhase("result");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function stopForCondition(condition) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      showResult(await triggerStopCondition(sessionId, condition));
    } catch (stopError) {
      setError(stopError.message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function stopAndRequestMechanic() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await triggerStopCondition(sessionId, "User requested professional assistance");
    } catch (_error) {
      // Mechanic escalation remains available if session persistence is temporarily unavailable.
    } finally {
      submittingRef.current = false;
    }
    navigation.navigate("RequestMechanic", { prefill });
  }

  return (
    <ScreenContainer>
      <ScreenHeader
        eyebrow="Guided safety check"
        title="Checking your vehicle"
        subtitle="Follow only the approved steps shown here. You can stop at any time."
      />
      <View style={styles.checkHeader}>
        <Text style={styles.checkLabel}>Check {checkNumber}</Text>
        <Text style={styles.phaseLabel}>
          {currentPhase === "result" ? "Observation" : currentPhase === "processing" ? "Reviewing" : "Action"}
        </Text>
      </View>

      {messages.map((message, index) => (
        <View key={`${message.role}-${index}`} style={[styles.messageRow, message.role === "user" && styles.userRow]}>
          {message.role === "assistant" ? <View style={styles.avatar}><Ionicons name="shield-checkmark" size={18} color={colors.teal} /></View> : null}
          <View style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}>
            <Text style={[styles.message, message.role === "user" && styles.userMessage]}>{message.text}</Text>
          </View>
        </View>
      ))}

      {currentStep && currentPhase === "instruction" && !cannotContinue ? (
        <AppCard style={styles.actionCard}>
          <Text style={styles.overline}>First, do this:</Text>
          <Text style={styles.instruction}>{currentStep.instruction}</Text>
          <AppButton title="Done – I Checked" icon="checkmark-circle-outline" loading={loading} onPress={confirmAction} />
          <AppButton title="I Can't Do This" variant="secondary" disabled={loading} onPress={() => setCannotContinue(true)} />
          <AppButton title="Stop & Request Mechanic" variant="danger" disabled={loading} onPress={stopAndRequestMechanic} />
        </AppCard>
      ) : null}

      {cannotContinue ? (
        <AppCard style={styles.cannotCard}>
          <Text style={styles.question}>That's okay. Do not continue if you are unsure.</Text>
          <AppButton title="Request Mechanic" onPress={stopAndRequestMechanic} />
          <AppButton title="Go Back" variant="secondary" onPress={() => setCannotContinue(false)} />
        </AppCard>
      ) : null}

      {currentStep && currentPhase === "result" && !cannotContinue ? (
        <AppCard>
          <Text style={styles.question}>{currentStep.result_question || currentStep.question || "Great. What did you observe?"}</Text>
          <Text style={styles.help}>Choose only what you safely observed.</Text>
          {answerOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              disabled={loading}
              onPress={() => chooseAnswer(option)}
              style={({ pressed }) => [styles.answer, option.value === "not_sure" && styles.neutralAnswer, pressed && styles.pressed]}
            >
              <Text style={styles.answerText}>{option.value === "not_sure" ? "Not Sure" : option.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.teal} />
            </Pressable>
          ))}
        </AppCard>
      ) : null}

      {currentPhase === "processing" ? <InfoBanner tone="info" message="Reviewing your observation and loading the next approved check..." /> : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}

      {unsafeOpen ? (
        <AppCard style={styles.unsafeCard}>
          <Text style={styles.unsafeTitle}>What unsafe condition did you notice?</Text>
          {UNSAFE_CONDITIONS.map((item) => <AppButton key={item.value} title={item.label} variant="danger" disabled={loading} onPress={() => stopForCondition(item.value)} />)}
          <AppButton title="Go Back" variant="secondary" onPress={() => setUnsafeOpen(false)} />
        </AppCard>
      ) : (
        <AppButton title="I Noticed Something Unsafe" icon="warning-outline" variant="secondary" disabled={loading} onPress={() => setUnsafeOpen(true)} />
      )}
      {currentPhase !== "instruction" ? <AppButton title="Stop & Request Mechanic" icon="construct-outline" variant="danger" disabled={loading} onPress={stopAndRequestMechanic} /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  checkHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkLabel: { ...typography.sectionTitle, color: colors.primaryDark },
  phaseLabel: { ...typography.caption, color: colors.teal, fontWeight: "800", textTransform: "uppercase" },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  userRow: { justifyContent: "flex-end" },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealLight, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "82%", borderRadius: radii.lg, padding: spacing.md },
  assistantBubble: { backgroundColor: colors.blueLight, borderBottomLeftRadius: 4 },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  message: { ...typography.body, color: colors.textPrimary },
  userMessage: { color: colors.surface },
  actionCard: { borderColor: colors.teal, backgroundColor: colors.tealLight },
  overline: { ...typography.caption, color: colors.teal, fontWeight: "800", textTransform: "uppercase" },
  instruction: { ...typography.cardTitle, color: colors.primaryDark, lineHeight: 26 },
  question: { ...typography.cardTitle, color: colors.primaryDark },
  help: { ...typography.caption, color: colors.textSecondary },
  answer: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  neutralAnswer: { backgroundColor: colors.softSurface },
  answerText: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary },
  pressed: { backgroundColor: colors.tealLight },
  cannotCard: { borderColor: colors.amber, backgroundColor: colors.amberLight },
  unsafeCard: { borderColor: colors.danger, backgroundColor: colors.dangerLight },
  unsafeTitle: { ...typography.cardTitle, color: colors.danger }
});
