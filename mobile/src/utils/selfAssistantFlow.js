import { buildSymptomDescription, mapSymptomTypeToRequestType } from "../services/symptomCaptureService";

export function getSelfAssistantSessionId(session) {
  return session?._id || session?.id;
}

export function resolveSelfAssistantRecommendation(response = {}, payload = {}) {
  const sourcePrediction = response.aiPrediction || {};
  const predictedFault = sourcePrediction.predictedFault ||
    sourcePrediction.predicted_fault || response.predictedFault || payload.predictedFault;
  const faultLabel = sourcePrediction.faultLabel ||
    sourcePrediction.fault_label || response.faultLabel || payload.faultLabel;
  const resolvedService = sourcePrediction.requiredService ||
    sourcePrediction.required_service || response.requiredService ||
    response.requiredServiceType || response.recommendedService ||
    response.session?.recommendedService || payload.requiredService ||
    payload.requiredServiceType;
  const requiredService = resolvedService || "general_mechanic";
  const fallbackUsed = resolvedService
    ? Boolean(sourcePrediction.fallbackUsed || response.fallbackUsed)
    : true;

  return {
    predictedFault,
    faultLabel,
    requiredService,
    fallbackUsed,
    aiPrediction: {
      ...sourcePrediction,
      predictedFault,
      faultLabel,
      requiredService,
      fallbackUsed
    }
  };
}

export function buildSelfAssistantPayload(symptoms, overrides = {}) {
  const guidedSymptoms = symptoms || {};
  const problemDescription = overrides.problemDescription ?? guidedSymptoms.description ?? "";
  const diagnosticInputText = overrides.diagnosticInputText || buildSymptomDescription(guidedSymptoms);
  return {
    vehicleType: overrides.vehicleType || guidedSymptoms.vehicleType || "car",
    breakdownType: overrides.breakdownType || guidedSymptoms.breakdownType || "other",
    diagnosticInputText,
    problemDescription,
    symptomCapture: {
      symptoms: { ...(guidedSymptoms.symptoms || {}) },
      observedSymptoms: {
        see: [...(guidedSymptoms.observedSymptoms?.see || [])],
        hear: [...(guidedSymptoms.observedSymptoms?.hear || [])],
        smell: [...(guidedSymptoms.observedSymptoms?.smell || [])],
        feel: [...(guidedSymptoms.observedSymptoms?.feel || [])]
      },
      additionalDescription: guidedSymptoms.description || problemDescription,
      guidedCaptureUsed: true
    },
    guidedSymptoms,
    clarificationAnswers: [...(overrides.clarificationAnswers || [])],
    aiPredictionHistory: [...(overrides.aiPredictionHistory || [])]
  };
}

export function buildSelfAssistantMechanicPrefill(payload, response = {}) {
  const session = response.session;
  const recommendation = resolveSelfAssistantRecommendation(response, payload);
  const prediction = recommendation.aiPrediction;
  return {
    vehicleType: payload.vehicleType,
    breakdownType: mapSymptomTypeToRequestType(payload.breakdownType),
    problemDescription: [
      payload.diagnosticInputText || payload.problemDescription,
      prediction?.faultLabel ? `Possible issue: ${prediction.faultLabel}` : "",
      recommendation.requiredService ? `Suggested service: ${recommendation.requiredService}` : ""
    ].filter(Boolean).join("\n"),
    guidedSymptoms: payload.guidedSymptoms,
    symptomCapture: payload.symptomCapture,
    diagnosticInputText: payload.diagnosticInputText,
    predictedFault: recommendation.predictedFault || session?.predictedFault?.fault,
    requiredService: recommendation.requiredService,
    requiredServiceType: recommendation.requiredService,
    fallbackUsed: recommendation.fallbackUsed,
    troubleshootingSessionId: getSelfAssistantSessionId(session),
    selfTroubleshootingAttempted: Boolean(session)
  };
}

export function routeSelfAssistantResponse(navigation, response, payload, options = {}) {
  const method = options.replace ? "replace" : "navigate";
  function goTo(name, params) {
    if (options.resetFlow && typeof navigation.reset === "function") {
      navigation.reset({
        index: 1,
        routes: [{ name: "DriverHome" }, { name, params }]
      });
      return;
    }
    navigation[method](name, params);
  }
  const common = {
    session: response.session,
    sessionId: getSelfAssistantSessionId(response.session),
    aiPrediction: response.aiPrediction,
    currentStep: response.currentStep,
    riskLevel: response.riskLevel,
    recommendedService: response.recommendedService || response.session?.recommendedService,
    prefill: buildSelfAssistantMechanicPrefill(payload, response)
  };

  if (response.status === "more_information_required") {
    const selfAssistantPayload = {
      ...payload,
      aiPredictionHistory: [
        ...(payload.aiPredictionHistory || []),
        ...(response.aiPrediction ? [response.aiPrediction] : [])
      ]
    };
    goTo("AIClarification", {
      mode: "self_assistant",
      selfAssistantMode: true,
      selfAssistantPayload,
      symptomCapture: payload.symptomCapture,
      vehicleType: payload.vehicleType,
      breakdownType: payload.breakdownType,
      diagnosticInputText: payload.diagnosticInputText,
      aiPrediction: response.aiPrediction,
      selfAssistantClarificationAttempts: options.clarificationAttempts || 0
    });
    return "clarifying";
  }
  if (response.status === "ready_to_start") {
    goTo("TroubleshootingConversation", common);
    return "troubleshooting";
  }
  if (response.status === "awaiting_safety_confirmation") {
    goTo("SelfAssistantSafety", {
      ...common,
      safetyWarning: response.safetyWarning,
      beforeYouBegin: response.beforeYouBegin
    });
    return "safety_confirmation";
  }
  goTo("SelfAssistantResult", {
    ...common,
    status: response.status || "troubleshooting_unavailable",
    message: response.message
  });
  return response.status === "professional_help_required" ? "professional_help" : "unavailable";
}

export function selfAssistantClarificationQuestions(payload) {
  const startingProblem = payload?.breakdownType === "vehicle_not_starting";
  return startingProblem ? [
    { id: "starting_consistency", question: "Does the same thing happen every time you try to start?", options: ["Every time", "Only sometimes", "It changed recently", "Not sure"] },
    { id: "power_behavior", question: "What happens to the dashboard lights while the engine tries to start?", options: ["They stay normal", "They become dim", "They switch off", "Not sure"] }
  ] : [
    { id: "problem_timing", question: "Did this problem begin suddenly or build up over time?", options: ["Suddenly", "Gradually", "It comes and goes", "Not sure"] },
    { id: "most_noticeable", question: "Which sign is most noticeable right now?", options: ["A sound", "A warning light", "A smell or leak", "A change in how it feels", "Not sure"] }
  ];
}

export function appendSelfAssistantClarification(payload, questions, answers) {
  const savedAnswers = questions.map((question) => ({
    questionId: question.id,
    question: question.question,
    answer: answers[question.id]
  }));
  const answerText = savedAnswers.map((item) => `${item.question}: ${item.answer}`).join("\n");
  return {
    ...payload,
    diagnosticInputText: [payload.diagnosticInputText, `Additional clarification:\n${answerText}`].filter(Boolean).join("\n"),
    clarificationAnswers: [...(payload.clarificationAnswers || []), ...savedAnswers]
  };
}
