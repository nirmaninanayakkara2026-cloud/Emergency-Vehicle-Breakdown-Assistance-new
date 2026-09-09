import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppButton from "../../components/AppButton";
import AppCard from "../../components/AppCard";
import PredictionSummaryCard from "../../components/PredictionSummaryCard";
import InfoBanner from "../../components/ui/InfoBanner";
import LoadingState from "../../components/ui/LoadingState";
import ScreenHeader from "../../components/ui/ScreenHeader";
import ScreenContainer from "../../components/ScreenContainer";
import SymptomProgress from "../../components/symptom/SymptomProgress";
import {
  getClarificationQuestions,
  submitClarificationAnswers,
} from "../../services/requestService";
import { startSelfAssistant } from "../../services/selfAssistantService";
import {
  appendSelfAssistantClarification,
  buildSelfAssistantMechanicPrefill,
  resolveSelfAssistantRecommendation,
  routeSelfAssistantResponse,
  selfAssistantClarificationQuestions,
} from "../../utils/selfAssistantFlow";
import { COLORS } from "../../utils/constants";
// The user can complete only one clarification round.
const MAX_ATTEMPTS = 1;

// Preserve the original request data when the user edits symptoms.
function buildRequestDraft(request, existingDraft) {
  if (existingDraft) return existingDraft;
  return {
    vehicleType: request?.vehicleType,
    vehicleModel: request?.vehicleModel,
    breakdownType: request?.breakdownType,
    urgencyLevel: request?.urgencyLevel,
    problemDescription: request?.problemDescription,
    location: request?.location,
  };
}

export default function AIClarificationScreen({ navigation, route }) {
  const selfAssistantMode =
    route.params?.mode === "self_assistant" ||
    route.params?.selfAssistantMode === true;
  const [selfAssistantPayload, setSelfAssistantPayload] = useState(
    route.params?.selfAssistantPayload || null,
  );
  const requestId = route.params?.requestId;
  const request = route.params?.request;
  const requestDraft = buildRequestDraft(request, route.params?.requestDraft);
  const [prediction, setPrediction] = useState(
    route.params?.aiPrediction || request?.aiPrediction || null,
  );
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [attempts, setAttempts] = useState(
    Number(
      selfAssistantMode
        ? route.params?.selfAssistantClarificationAttempts || 0
        : request?.clarificationAttempts || 0,
    ),
  );
  const [phase, setPhase] = useState("loading");
  const [error, setError] = useState("");

  // Load clarification questions for either the normal request or self-assistant flow.
  const loadQuestions = useCallback(async () => {
    // Load clarification questions for the self-assistant flow.
    if (selfAssistantMode) {
      if (!selfAssistantPayload) {
        setError("Updated symptom details are missing.");
        setPhase("error");
        return;
      }
      if (attempts >= MAX_ATTEMPTS) {
        setPhase("maximum");
        return;
      }
      setQuestions(
        selfAssistantClarificationQuestions(selfAssistantPayload).slice(0, 2),
      );
      setAnswers({});
      setQuestionIndex(0);
      setError("");
      setPhase("questions");
      return;
    }
    if (!requestId) {
      setError("Request details are missing.");
      setPhase("error");
      return;
    }
    if (attempts >= MAX_ATTEMPTS) {
      setPhase("maximum");
      return;
    }

    setError("");
    setPhase("loading");
    try {
      // Load clarification questions from the backend for the normal request flow.
      const response = await getClarificationQuestions(requestId);
      if (response.maximumAttemptsReached) {
        setAttempts(MAX_ATTEMPTS);
        setPhase("maximum");
        return;
      }
      // Handle the case where clarification is not needed or questions are unavailable.
      if (response.clarificationNeeded === false) {
        setPhase("result");
        return;
      }
      // Handle the case where clarification questions are unavailable.
      if (
        response.clarificationAvailable === false ||
        !response.questions?.length
      ) {
        setPhase("unavailable");
        return;
      }
      setQuestions(response.questions.slice(0, 2));
      setAnswers({});
      setQuestionIndex(0);
      setPhase("questions");
    } catch (loadError) {
      setError("We couldn't load additional questions right now.");
      setPhase("error");
    }
  }, [attempts, requestId, selfAssistantMode, selfAssistantPayload]);

  useEffect(() => {
    loadQuestions();
  }, []);

  // Navigate to provider recommendations using the current AI prediction.
  function continueToRecommendations(generalMechanicOnly = false) {
    navigation.replace("Recommendation", {
      requestId,
      request,
      aiPrediction: prediction,
      generalMechanicOnly,
    });
  }

  // Return the user to symptom capture for additional information.
  function editSymptoms() {
    if (selfAssistantMode) {
      navigation.navigate("GuidedSymptomCapture", {
        sourceRoute: "SelfBreakdownAssistant",
        vehicleType: selfAssistantPayload?.vehicleType,
        breakdownType: selfAssistantPayload?.breakdownType,
        initialData: selfAssistantPayload?.guidedSymptoms,
      });
      return;
    }
    navigation.navigate("RequestMechanic", { prefill: requestDraft });
  }

  // Start a standard mechanic request when self-troubleshooting cannot continue.
  function requestSelfAssistantMechanic() {
    navigation.navigate("RequestMechanic", {
      prefill: buildSelfAssistantMechanicPrefill(selfAssistantPayload || {}, {
        aiPrediction: prediction,
        recommendedService: prediction?.requiredService,
      }),
    });
  }

  // Save the selected answer and clear any previous validation message.
  function selectAnswer(answer) {
    const question = questions[questionIndex];
    setAnswers((current) => ({ ...current, [question.id]: answer }));
    setError("");
  }

  // Move to the previous clarification question when available.
  function goBack() {
    if (questionIndex > 0) setQuestionIndex((current) => current - 1);
  }

  // Validate answers and submit the completed clarification flow.
  async function goNext() {
    const question = questions[questionIndex];
    if (!answers[question.id]) {
      setError("Choose the option that fits best. You can select Not sure.");
      return;
    }
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    setError("");
    setPhase("submitting");
    // Submit the completed clarification answers for either the normal request or self-assistant flow.
    try {
      if (selfAssistantMode) {
        const updatedPayload = appendSelfAssistantClarification(
          selfAssistantPayload,
          questions,
          answers,
        );
        // Submit the updated payload to the self-assistant service for a new recommendation.
        const response = await startSelfAssistant(updatedPayload);
        const recommendation = resolveSelfAssistantRecommendation(
          response,
          updatedPayload,
        );
        // Update the payload with the new recommendation and AI prediction history.
        const completedPayload = {
          ...updatedPayload,
          predictedFault: recommendation.predictedFault,
          faultLabel: recommendation.faultLabel,
          requiredService: recommendation.requiredService,
          fallbackUsed: recommendation.fallbackUsed,
          aiPredictionHistory: [
            ...(updatedPayload.aiPredictionHistory || []),
            ...(response.aiPrediction ? [recommendation.aiPrediction] : []),
          ],
        };
        // Increment the clarification attempt count and update the state with the new recommendation.
        const nextAttempts = attempts + 1;
        setSelfAssistantPayload(completedPayload);
        setPrediction(recommendation.aiPrediction);
        setAttempts(nextAttempts);
        // If the self-assistant service indicates that more information is required, transition to the maximum attempt state. Otherwise, route to the appropriate response screen with the updated payload and recommendation.
        if (response.status === "more_information_required") {
          setPhase("maximum");
        } else {
          // Route to the appropriate response screen with the updated payload and recommendation.
          routeSelfAssistantResponse(navigation, response, completedPayload, {
            replace: true,
            resetFlow: true,
            clarificationAttempts: nextAttempts,
          });
        }
        return;
      }
      // Submit the completed clarification answers to the backend for the normal request flow.
      const response = await submitClarificationAnswers(
        requestId,
        questions.map((item) => ({
          questionId: item.id,
          answer: answers[item.id],
        })),
      );
      setPrediction(response.prediction);
      setAttempts(Number(response.clarificationAttempts || attempts + 1));
      setPhase("result");
    } catch (submitError) {
      // Show a recoverable error when the updated recommendation cannot be submitted.
      setError("We couldn't update your recommendation right now.");
      setPhase("error");
    }
  }

  // Shared actions for result and error states.
  function renderContinueOptions(
    currentLabel = "Continue with Current Recommendation",
  ) {
    return (
      <View style={styles.actions}>
        <AppButton
          title={currentLabel}
          onPress={() => continueToRecommendations(false)}
        />
        <AppButton
          title="Edit Symptoms"
          variant="secondary"
          onPress={editSymptoms}
        />
      </View>
    );
  }

  return (
    <ScreenContainer>
      {/* Clarification page header and user guidance. */}
      <ScreenHeader
        eyebrow="Smart assistant"
        title="We need a little more information"
        subtitle="Your symptoms could match more than one type of problem. Two quick answers may improve the recommendation."
      />
      <InfoBanner
        tone="info"
        message="Choose the answer that feels closest. It is always okay to select Not Sure."
      />

      {/* Initial question-loading state. */}
      {phase === "loading" ? (
        <AppCard>
          <LoadingState message="Preparing a few quick questions..." />
        </AppCard>
      ) : null}

      {/* Submission-loading state after the final answer. */}
      {phase === "submitting" ? (
        <AppCard>
          <LoadingState message="Reviewing your updated symptoms..." />
        </AppCard>
      ) : null}

      {/* Interactive clarification questions and answer navigation. */}
      {phase === "questions" && questions.length ? (
        <>
          <SymptomProgress
            current={questionIndex + 1}
            total={questions.length}
            label={`Question ${questionIndex + 1} of ${questions.length}`}
          />
          <AppCard>
            <Text style={styles.question}>
              {questions[questionIndex].question}
            </Text>
            <View style={styles.options}>
              {questions[questionIndex].options.map((option) => {
                const selected =
                  answers[questions[questionIndex].id] === option;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    key={option}
                    onPress={() => selectAnswer(option)}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.selectedOption,
                      pressed && styles.pressedOption,
                    ]}
                  >
                    <View
                      style={[styles.radio, selected && styles.selectedRadio]}
                    >
                      {selected ? (
                        <Text style={styles.radioCheck}>✓</Text>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.selectedOptionText,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
          {error ? <InfoBanner tone="warning" message={error} /> : null}
          <View style={styles.navigationRow}>
            <View style={styles.flex}>
              <AppButton
                title="Back"
                variant="secondary"
                disabled={questionIndex === 0}
                onPress={goBack}
              />
            </View>
            <View style={styles.flex}>
              <AppButton
                title={
                  questionIndex === questions.length - 1
                    ? "Update Recommendation"
                    : "Next"
                }
                onPress={goNext}
              />
            </View>
          </View>
        </>
      ) : null}

      {/* Updated recommendation for the normal request flow. */}
      {phase === "result" && !selfAssistantMode ? (
        <>
          <Text style={styles.sectionTitle}>Updated Result</Text>
          <PredictionSummaryCard prediction={prediction} title="Best Match" />
          {!prediction?.needsMoreInformation ? (
            <AppButton
              title="Continue to Recommended Mechanics"
              onPress={() => continueToRecommendations(false)}
            />
          ) : (
            <>
              <InfoBanner
                tone="warning"
                title="Low-confidence result"
                message="We still cannot identify the problem with high confidence. This is the best available match and recommended service based on your symptoms."
              />
              <AppButton
                title="Continue with Best Match"
                onPress={() => continueToRecommendations(false)}
              />
              <AppButton
                title="Edit Symptoms"
                variant="secondary"
                onPress={editSymptoms}
              />
            </>
          )}
        </>
      ) : null}

      {/* Maximum-attempt result and escalation options. */}
      {phase === "maximum" ? (
        <>
          <PredictionSummaryCard
            prediction={prediction}
            title="Best Available Recommendation"
          />
          {selfAssistantMode ? (
            <AppCard>
              <Text style={styles.cardTitle}>
                We still don't have enough information to safely start
                self-troubleshooting.
              </Text>
            </AppCard>
          ) : (
            <InfoBanner
              tone="warning"
              title="Low-confidence result"
              message="We still cannot identify the problem with high confidence. This is the best available match and recommended service based on your symptoms."
            />
          )}
          {selfAssistantMode ? (
            <>
              <AppButton
                title="Add More Symptoms"
                variant="secondary"
                onPress={editSymptoms}
              />
              <AppButton
                title="Request Mechanic Instead"
                onPress={requestSelfAssistantMechanic}
              />
            </>
          ) : (
            <>
              <AppButton
                title="Continue with Best Match"
                onPress={() => continueToRecommendations(false)}
              />
              <AppButton
                title="Edit Symptoms"
                variant="secondary"
                onPress={editSymptoms}
              />
            </>
          )}
        </>
      ) : null}

      {/* Fallback when clarification questions are unavailable. */}
      {phase === "unavailable" && !selfAssistantMode ? (
        <>
          <PredictionSummaryCard prediction={prediction} />
          <AppCard>
            <Text style={styles.cardTitle}>
              We could not generate additional questions right now.
            </Text>
            <Text style={styles.supportingText}>
              You can continue with the current recommendation or add more
              symptoms manually.
            </Text>
          </AppCard>
          <AppButton
            title="Continue with Current Recommendation"
            onPress={() => continueToRecommendations(false)}
          />
          <AppButton
            title="Add More Symptoms Manually"
            variant="secondary"
            onPress={editSymptoms}
          />
        </>
      ) : null}

      {/* Error state with retry and recovery actions. */}
      {phase === "error" ? (
        <>
          <PredictionSummaryCard prediction={prediction} />
          <AppCard>
            <Text style={styles.error}>
              {error || "We couldn't load additional questions right now."}
            </Text>
            <AppButton title="Try Again" onPress={loadQuestions} />
          </AppCard>
          {selfAssistantMode ? (
            <>
              <AppButton
                title="Edit Symptoms"
                variant="secondary"
                onPress={editSymptoms}
              />
              <AppButton
                title="Request Mechanic"
                variant="secondary"
                onPress={requestSelfAssistantMechanic}
              />
            </>
          ) : (
            renderContinueOptions()
          )}
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: 7,
  },
  title: {
    color: COLORS.primaryDark,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 31,
  },
  subtitle: {
    color: COLORS.muted,
    lineHeight: 21,
  },
  centerText: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 21,
  },
  sectionTitle: {
    color: COLORS.primaryDark,
    fontSize: 22,
    fontWeight: "900",
  },
  question: {
    color: COLORS.primaryDark,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
  },
  options: {
    gap: 10,
  },
  option: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
  },
  selectedOption: {
    borderColor: COLORS.primary,
    backgroundColor: "#edf7f7",
  },
  pressedOption: {
    opacity: 0.78,
  },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.muted,
  },
  selectedRadio: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCheck: { color: COLORS.surface, fontSize: 12, fontWeight: "900" },
  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  selectedOptionText: {
    color: COLORS.primaryDark,
  },
  navigationRow: {
    flexDirection: "row",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  actions: {
    gap: 10,
  },
  cardTitle: {
    color: COLORS.primaryDark,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 25,
  },
  supportingText: {
    color: COLORS.muted,
    lineHeight: 21,
  },
  error: {
    color: COLORS.danger,
    fontWeight: "700",
    lineHeight: 21,
  },
});
