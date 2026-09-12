import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import {
  confirmTroubleshootingAction,
  submitTroubleshootingStep,
  triggerStopCondition,
  sendTroubleshootingMessage,
} from "../../services/selfAssistantService";
import { colors, radii, spacing, typography } from "../../theme";
import { formatFaultLabel } from "../../utils/displayLabels";
import { conversationState } from "../../utils/selfAssistantFlow";

const UNSAFE_CONDITIONS = [
  { label: "Smoke", value: "smoke" },
  { label: "Fire", value: "fire" },
  { label: "Fuel smell or leak", value: "fuel smell or leak" },
  { label: "Burning smell", value: "burning smell" },
  { label: "Serious fluid leak", value: "serious fluid leak" },
  { label: "Vehicle unstable", value: "vehicle instability" },
  { label: "Other unsafe condition", value: "unexpected dangerous condition" },
];

function restoredMessages(session, aiPrediction, currentStep) {
  if (session?.messages?.length) {
    return session.messages.map(({ role, content }) => ({ role, text: content }));
  }
  // Rebuild the conversation when an existing troubleshooting session is resumed.
  const messages = aiPrediction?.faultLabel
    ? [
        {
          role: "assistant",
          text: `Your symptoms may indicate ${formatFaultLabel(aiPrediction.predictedFault, aiPrediction.faultLabel)}.`,
        },
      ]
    : [];
  for (const completed of session?.completedSteps || []) {
    if (completed.instruction)
      messages.push({ role: "assistant", text: completed.instruction });
    messages.push({ role: "user", text: "Done – I Checked" });
    messages.push({ role: "assistant", text: "Great. What did you observe?" });
    messages.push({
      role: "user",
      text: completed.resultLabel || completed.selectedResult,
    });
    messages.push({
      role: "assistant",
      text: "Okay. Let's continue with the next check.",
    });
  }
  if (currentStep?.instruction)
    messages.push({ role: "assistant", text: currentStep.instruction });
  return messages;
}

function getAnswerOptions(session) {
  if (session.pendingInterpretation === "danger_confirmation") {
    return [
      { value: "danger_yes", label: "Yes, there is an unsafe condition" },
      { value: "danger_no", label: "No, I am not reporting danger" },
    ];
  }
  if (session.status === "awaiting_resolution_confirmation") {
    return [
      { value: "resolved", label: "Yes, resolved with no danger signs" },
      { value: "unresolved", label: "No, the problem remains" },
      { value: "not_sure", label: "Not Sure" },
    ];
  }
  const options = session.currentStep?.possible_results || [];
  return options.some((option) => option.value === "not_sure")
    ? options
    : [...options, { value: "not_sure", label: "Not Sure" }];
}

export default function TroubleshootingConversationScreen({
  navigation,
  route,
}) {
  // Keep the backend session in one place; derive the step and phase from it.
  const { sessionId, aiPrediction, prefill } = route.params || {};
  const initialSession = route.params?.session || {};
  const initialStep = route.params?.currentStep || initialSession.currentStep;
  const [activeSession, setActiveSession] = useState(() => ({
    ...initialSession,
    currentStep: initialStep,
    currentPhase: route.params?.currentPhase || initialSession.currentPhase || "instruction",
  }));
  const currentStep = activeSession.currentStep;
  const currentPhase = activeSession.currentPhase;
  const [messages, setMessages] = useState(() =>
    restoredMessages(initialSession, aiPrediction, initialStep),
  );
  const [unsafeOpen, setUnsafeOpen] = useState(false);
  const [cannotContinue, setCannotContinue] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const submittingRef = useRef(false);

  const answerOptions = getAnswerOptions(activeSession);
  const checkNumber = (activeSession?.completedSteps?.length || 0) + 1;
  const checkingResolution = activeSession.status === "awaiting_resolution_confirmation";
  const confirmingInterpretation = Boolean(
    activeSession.pendingInterpretation &&
    activeSession.pendingInterpretation !== "danger_confirmation",
  );
  const showInstruction =
    currentStep && currentPhase === "instruction" && !cannotContinue;
  const showAnswers =
    ((currentStep && currentPhase === "result") || checkingResolution) && !cannotContinue;
  const question = activeSession.lastMessage || currentStep?.result_question ||
    currentStep?.question || "Great. What did you observe?";
  let phaseLabel = "Action";
  if (checkingResolution) phaseLabel = "Resolution";
  else if (currentPhase === "result") phaseLabel = "Observation";

  // Route completed or stopped sessions to the result screen.
  function showResult(response) {
    navigation.replace("SelfAssistantResult", {
      sessionId,
      session: response.session || activeSession,
      aiPrediction,
      prefill,
      status: response.status,
      message: response.message,
      recommendedService: response.recommendedService,
      riskLevel: route.params?.riskLevel || activeSession?.riskLevel,
    });
  }

  // Every successful request updates the screen through this function.
  function applyResponse(response, fallbackMessages = []) {
    if (["resolved", "professional_help_required"].includes(response.status)) {
      showResult(response);
      return;
    }
    const session = response.session || activeSession;
    setActiveSession({
      ...session,
      currentStep: response.currentStep || response.nextStep || session.currentStep || null,
      currentPhase: response.currentPhase || session.currentPhase || "result",
    });
    if (session.messages?.length) {
      setMessages(restoredMessages(session));
    } else {
      const reply = response.message ? [{ role: "assistant", text: response.message }] : [];
      setMessages((items) => [...items, ...fallbackMessages, ...reply]);
    }
  }

  // Share loading, errors and double-tap protection across chat requests.
  async function runRequest(request, fallbackMessages = []) {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await request();
      if (response.status === "troubleshooting_unavailable") {
        setError("The service is temporarily unavailable. Your current check is saved; please try again.");
        return null;
      }
      applyResponse(response, fallbackMessages);
      return response;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  async function sendMessage(selectedResult) {
    const message = draftMessage.trim();
    if (!selectedResult && !message) return;
    const response = await runRequest(() => sendTroubleshootingMessage(sessionId, {
      ...(selectedResult ? { selectedResult } : { message }),
      stepId: activeSession.currentStepId || null,
      expectedState: conversationState(activeSession),
    }));
    if (response?.success) setDraftMessage("");
  }

  function confirmAction() {
    if (!currentStep) return;
    return runRequest(
      () => confirmTroubleshootingAction(sessionId, currentStep.step_id),
      [
        { role: "user", text: "Done – I Checked" },
        {
          role: "assistant",
          text:
            currentStep.result_question ||
            currentStep.question ||
            "Great. What did you observe?",
        },
      ],
    );
  }

  // Submit the driver's observation and load the next approved step.
  function chooseAnswer(option) {
    if (checkingResolution || activeSession.pendingInterpretation) {
      return sendMessage(option.value);
    }
    if (!currentStep || currentPhase !== "result") return;
    return runRequest(
      () => submitTroubleshootingStep(sessionId, currentStep.step_id, option.value),
      [{ role: "user", text: option.label }],
    );
  }

  // Stop the flow when the driver reports an unsafe condition.
  function stopForCondition(condition) {
    return runRequest(() => triggerStopCondition(sessionId, condition));
  }

  // Escalate directly to a mechanic while preserving the request draft.
  async function stopAndRequestMechanic() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      await triggerStopCondition(
        sessionId,
        "User requested professional assistance",
      );
    } catch (_error) {
      // Mechanic escalation remains available if session persistence is temporarily unavailable.
    } finally {
      submittingRef.current = false;
    }
    navigation.navigate("RequestMechanic", { prefill });
  }

  return (
    <ScreenContainer>
      {/* Conversation header and current check phase. */}
      <ScreenHeader
        eyebrow="Guided safety check"
        title="Checking your vehicle"
        subtitle="Follow only the approved steps shown here. You can stop at any time."
      />
      <View style={styles.checkHeader}>
        <Text style={styles.checkLabel}>Check {checkNumber}</Text>
        <Text style={styles.phaseLabel}>
          {loading ? "Reviewing" : phaseLabel}
        </Text>
      </View>

      {/* Restored assistant and driver conversation messages. */}
      {messages.map((message, index) => (
        <View
          key={`${message.role}-${index}`}
          style={[styles.messageRow, message.role === "user" && styles.userRow]}
        >
          {message.role === "assistant" ? (
            <View style={styles.avatar}>
              <Ionicons name="shield-checkmark" size={18} color={colors.teal} />
            </View>
          ) : null}
          <View
            style={[
              styles.bubble,
              message.role === "user"
                ? styles.userBubble
                : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.message,
                message.role === "user" && styles.userMessage,
              ]}
            >
              {message.text}
            </Text>
          </View>
        </View>
      ))}

      {/* Approved instruction and completion controls. */}
      {showInstruction ? (
        <AppCard style={styles.actionCard}>
          <Text style={styles.overline}>First, do this:</Text>
          <Text style={styles.instruction}>{currentStep.instruction}</Text>
          <AppButton
            title="Done – I Checked"
            icon="checkmark-circle-outline"
            loading={loading}
            onPress={confirmAction}
          />
          <AppButton
            title="I Can't Do This"
            variant="secondary"
            disabled={loading}
            onPress={() => setCannotContinue(true)}
          />
          <AppButton
            title="Stop & Request Mechanic"
            variant="danger"
            disabled={loading}
            onPress={stopAndRequestMechanic}
          />
        </AppCard>
      ) : null}

      {/* Recovery path when the driver cannot complete the instruction. */}
      {cannotContinue ? (
        <AppCard style={styles.cannotCard}>
          <Text style={styles.question}>
            That's okay. Do not continue if you are unsure.
          </Text>
          <AppButton
            title="Request Mechanic"
            onPress={stopAndRequestMechanic}
          />
          <AppButton
            title="Go Back"
            variant="secondary"
            onPress={() => setCannotContinue(false)}
          />
        </AppCard>
      ) : null}

      {/* Observation question and safe answer options. */}
      {showAnswers ? (
        <AppCard>
          <Text style={styles.question}>
            {question}
          </Text>
          {confirmingInterpretation ? (
            <>
              <AppButton title="Yes, that is what I meant" disabled={loading} onPress={() => sendMessage("confirm_interpretation")} />
              <AppButton title="No, let me clarify" variant="secondary" disabled={loading} onPress={() => sendMessage("reject_interpretation")} />
            </>
          ) : null}
          <Text style={styles.help}>Choose only what you safely observed.</Text>
          {answerOptions.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              disabled={loading}
              onPress={() => chooseAnswer(option)}
              style={({ pressed }) => [
                styles.answer,
                option.value === "not_sure" && styles.neutralAnswer,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.answerText}>
                {option.value === "not_sure" ? "Not Sure" : option.label}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.teal} />
            </Pressable>
          ))}
        </AppCard>
      ) : null}

      <AppCard>
        <AppInput
          label="Tell me what you noticed"
          placeholder="Describe your observation or ask for a clearer explanation"
          value={draftMessage}
          onChangeText={setDraftMessage}
          maxLength={1000}
          editable={!loading}
          multiline
        />
        <AppButton title="Send Message" onPress={() => sendMessage()} disabled={loading || !draftMessage.trim()} loading={loading} />
      </AppCard>

      {/* Processing and submission error feedback. */}
      {loading ? (
        <InfoBanner
          tone="info"
          message="Reviewing your observation and loading the next approved check..."
        />
      ) : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}

      {/* Unsafe-condition reporting and final mechanic escalation. */}
      {unsafeOpen ? (
        <AppCard style={styles.unsafeCard}>
          <Text style={styles.unsafeTitle}>
            What unsafe condition did you notice?
          </Text>
          {UNSAFE_CONDITIONS.map((item) => (
            <AppButton
              key={item.value}
              title={item.label}
              variant="danger"
              disabled={loading}
              onPress={() => stopForCondition(item.value)}
            />
          ))}
          <AppButton
            title="Go Back"
            variant="secondary"
            onPress={() => setUnsafeOpen(false)}
          />
        </AppCard>
      ) : (
        <AppButton
          title="I Noticed Something Unsafe"
          icon="warning-outline"
          variant="secondary"
          disabled={loading}
          onPress={() => setUnsafeOpen(true)}
        />
      )}
      {currentPhase !== "instruction" ? (
        <AppButton
          title="Stop & Request Mechanic"
          icon="construct-outline"
          variant="danger"
          disabled={loading}
          onPress={stopAndRequestMechanic}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  checkHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  checkLabel: { ...typography.sectionTitle, color: colors.primaryDark },
  phaseLabel: {
    ...typography.caption,
    color: colors.teal,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: spacing.xs },
  userRow: { justifyContent: "flex-end" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.tealLight,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { maxWidth: "82%", borderRadius: radii.lg, padding: spacing.md },
  assistantBubble: {
    backgroundColor: colors.blueLight,
    borderBottomLeftRadius: 4,
  },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  message: { ...typography.body, color: colors.textPrimary },
  userMessage: { color: colors.surface },
  actionCard: { borderColor: colors.teal, backgroundColor: colors.tealLight },
  overline: {
    ...typography.caption,
    color: colors.teal,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  instruction: {
    ...typography.cardTitle,
    color: colors.primaryDark,
    lineHeight: 26,
  },
  question: { ...typography.cardTitle, color: colors.primaryDark },
  help: { ...typography.caption, color: colors.textSecondary },
  answer: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  neutralAnswer: { backgroundColor: colors.softSurface },
  answerText: { ...typography.bodyStrong, flex: 1, color: colors.textPrimary },
  pressed: { backgroundColor: colors.tealLight },
  cannotCard: { borderColor: colors.amber, backgroundColor: colors.amberLight },
  unsafeCard: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  unsafeTitle: { ...typography.cardTitle, color: colors.danger },
});
