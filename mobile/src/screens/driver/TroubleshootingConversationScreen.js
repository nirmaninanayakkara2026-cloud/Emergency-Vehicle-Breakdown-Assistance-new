import React, { useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import AppInput from "../../components/AppInput";
import ScreenContainer from "../../components/ScreenContainer";
import InfoBanner from "../../components/ui/InfoBanner";
import ScreenHeader from "../../components/ui/ScreenHeader";
import {
  askForStepHelp, submitGuidanceAction, triggerStopCondition,
  confirmTroubleshootingAction, submitTroubleshootingStep, setSessionResult,
} from "../../services/selfAssistantService";
import { colors, typography } from "../../theme";

// Keep the existing route name so saved navigation and older sessions still open.
export default function TroubleshootingConversationScreen({ navigation, route }) {
  const { sessionId, prefill, aiPrediction } = route.params || {};
  const [session, setSession] = useState(route.params?.session || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [help, setHelp] = useState("");
  const busy = useRef(false);
  const step = session.currentStep || null;
  const options = step?.possible_results || [];
  const currentStepIndex = session.guidanceSteps?.findIndex((item) => item.step_id === step?.step_id) ?? -1;

  function showResponse(response) {
    if (response.session) setSession(response.session);
    if (response.status === "awaiting_safety_confirmation") {
      navigation.replace("SelfAssistantSafety", {
        sessionId, session: response.session, aiPrediction, prefill,
        riskLevel: response.riskLevel, safetyWarning: response.safetyWarning,
        beforeYouBegin: response.beforeYouBegin,
      });
      return;
    }
    if (["resolved", "professional_help_required", "troubleshooting_unavailable"].includes(response.status)) {
      navigation.replace("SelfAssistantResult", {
        sessionId, session: response.session, aiPrediction,
        prefill: { ...prefill, requiredService: response.session?.recommendedService || prefill?.requiredService },
        status: response.status, message: response.message,
        recommendedService: response.session?.recommendedService,
      });
    }
  }

  async function runAction(action, selectedResult) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    setHelp("");
    try {
      let response;
      if (session.driverType) {
        response = await submitGuidanceAction(sessionId, action, session.currentStepId, selectedResult);
      } else if (action === "solved" || session.status === "awaiting_resolution_confirmation") {
        // Compatibility for sessions saved before guided assistance was introduced.
        response = await setSessionResult(sessionId, action === "solved");
      } else if (action === "not_sure") {
        setHelp(step?.simple_question || "Choose what you have already observed, or request a mechanic.");
        return;
      } else if (action === "observation") {
        if (session.currentPhase !== "result") await confirmTroubleshootingAction(sessionId, step.step_id);
        response = await submitTroubleshootingStep(sessionId, step.step_id, selectedResult);
      } else {
        setHelp("Choose an observation below to continue with an approved step.");
        return;
      }
      showResponse(response);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function explainStep() {
    if (busy.current || !question.trim()) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await askForStepHelp(sessionId, question.trim());
      showResponse(response);
      setHelp(response.help || "");
    } catch (helpError) {
      setError(helpError.message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function requestMechanic() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      await triggerStopCondition(sessionId, "User requested professional assistance");
      navigation.navigate("RequestMechanic", { prefill });
    } catch (stopError) {
      setError(stopError.message);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="Possible Problem"
        subtitle={session.identifiedProblem || aiPrediction?.faultLabel || session.predictedFault?.label || "Vehicle problem"} />
      <InfoBanner tone={session.riskLevel === "CAUTION" ? "warning" : "info"}
        title={`Risk: ${session.riskLevel === "CAUTION" ? "Caution" : "Low"}`}
        message={session.safetyWarning || "Continue only from a safe parked position. Stop if anything feels unsafe."} />
      {step ? <AppCard>
        <Text style={styles.title}>What you can do</Text>
        <Text style={styles.body}>Step {currentStepIndex >= 0 ? currentStepIndex + 1 : 1}{session.guidanceSteps?.length ? ` of ${session.guidanceSteps.length}` : ""}</Text>
        <Text style={styles.instruction}>{step.instruction}</Text>
        {options.length ? <>
          <Text style={styles.body}>After this check, what did you observe?</Text>
          {options.map((option) => <AppButton key={option.value} title={option.label}
            variant="secondary" disabled={loading}
            onPress={() => runAction(option.value === "not_sure" ? "not_sure" : "observation", option.value)} />)}
          {!options.some((option) => option.value === "not_sure") ? <AppButton title="Not sure" variant="ghost"
            disabled={loading} onPress={() => runAction("not_sure")} /> : null}
        </> : null}
      </AppCard> : null}
      {session.lastMessage ? <InfoBanner tone="info" message={session.lastMessage} /> : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}
      <Text style={styles.body}>Only mark solved if you have already noticed that the original problem is gone and there are no danger signs.</Text>
      <AppButton title="Problem Solved" variant="success" disabled={loading || (!session.driverType && session.status !== "awaiting_resolution_confirmation")}
        onPress={() => runAction("solved")} />
      <AppButton title="Still Not Fixed" variant="secondary" disabled={loading}
        onPress={() => runAction("still_not_fixed")} />
      {step && session.driverType ? <AppButton title="Ask AI for More Help" variant="secondary"
        disabled={loading} onPress={() => setHelpOpen((open) => !open)} /> : null}
      {helpOpen && step ? <AppCard>
        <Text style={styles.title}>Help understanding this step</Text>
        <AppInput label="What would you like explained?" value={question}
          onChangeText={setQuestion} maxLength={500} multiline />
        <AppButton title="Explain This Step" disabled={loading || !question.trim()}
          loading={loading} onPress={explainStep} />
      </AppCard> : null}
      {help ? <InfoBanner tone="info" message={help} /> : null}
      <AppButton title="Request Mechanic" disabled={loading} onPress={requestMechanic} />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.cardTitle, color: colors.primaryDark },
  body: { ...typography.body, color: colors.textPrimary },
  instruction: { ...typography.bodyStrong, color: colors.textPrimary },
});
