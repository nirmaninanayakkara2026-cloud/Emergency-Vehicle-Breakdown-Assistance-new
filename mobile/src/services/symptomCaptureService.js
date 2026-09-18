import {
  OBSERVED_SYMPTOM_GROUPS,
  SYMPTOM_BREAKDOWN_TYPES,
  symptomQuestionFlows
} from "../data/symptomQuestionFlows";
import { VEHICLE_TYPES } from "../utils/constants";
import { getAssistanceProblems, getAssistanceQuestions } from "../data/assistanceOptions";

const emptyObservedSymptoms = {
  see: [],
  hear: [],
  smell: [],
  feel: []
};

const valueAliases = {
  engine_tries_to_start: "engine_turns"
};

function findLabel(options, value) {
  const normalizedValue = valueAliases[value] || value;
  return options.find((option) => option.value === normalizedValue)?.label || value;
}

function formatAnswer(question, answer) {
  if (Array.isArray(answer)) {
    return answer.map((value) => findLabel(question.options, value)).join(", ");
  }
  return findLabel(question.options, answer);
}

export function getQuestionsForProblem(breakdownType, driverType) {
  if (driverType) return getAssistanceQuestions(breakdownType);
  const flowAliases = {
    fuel_problem: "fuel_issue",
    strange_noise: "strange_sound"
  };
  return symptomQuestionFlows[flowAliases[breakdownType] || breakdownType] || symptomQuestionFlows.other;
}

export function getCurrentQuestion(flow, index) {
  if (!Array.isArray(flow) || index < 0 || index >= flow.length) return null;
  return flow[index];
}

export function validateAnswer(question, answer) {
  if (!question) return false;
  if (question.optional && (answer === undefined || answer === "" || (Array.isArray(answer) && !answer.length))) {
    return true;
  }
  if (question.type === "multi_choice") 
    return Array.isArray(answer) && answer.length > 0;
  return typeof answer === "string" && answer.length > 0;
}

export function buildStructuredSymptomPayload(data) {
  return {
    ...(data.driverType ? { driverType: data.driverType } : {}),
    vehicleType: data.vehicleType,
    breakdownType: data.breakdownType,
    symptoms: { ...(data.symptoms || {}) },
    observedSymptoms: {
      ...emptyObservedSymptoms,
      ...(data.observedSymptoms || {})
    },
    description: (data.description || "").trim()
  };
}

export function buildSymptomSummary(data) {
  const payload = buildStructuredSymptomPayload(data);
  const questions = getQuestionsForProblem(payload.breakdownType, payload.driverType);
  const answers = questions
    .filter((question) => {
      const answer = payload.symptoms[question.id];
      const hasAnswer = Array.isArray(answer) ? answer.length > 0 : typeof answer === "string" && answer.length > 0;
      return hasAnswer && validateAnswer(question, answer);
    })
    .map((question) => ({
      key: question.id,
      label: question.summaryLabel || question.question,
      value: formatAnswer(question, payload.symptoms[question.id])
    }));

  const observations = OBSERVED_SYMPTOM_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    value: (payload.observedSymptoms[group.key] || [])
      .map((value) => findLabel(group.options, value))
      .join(", ")
  })).filter((item) => item.value);

  return {
    vehicle: findLabel(VEHICLE_TYPES, payload.vehicleType),
    mainProblem: findLabel(payload.driverType ? getAssistanceProblems(payload.driverType) : SYMPTOM_BREAKDOWN_TYPES, payload.breakdownType),
    answers,
    observations,
    description: payload.description
  };
}

export function buildSymptomDescription(data) {
  const summary = buildSymptomSummary(data);
  const answerText = summary.answers.map((item) => `${item.label}: ${item.value}`);
  const observationText = summary.observations.length
    ? [`Other observations: ${summary.observations.map((item) => `${item.label} - ${item.value}`).join("; ")}`]
    : [];

  return [
    `Guided symptoms - ${summary.mainProblem}`,
    ...answerText,
    ...observationText,
    summary.description ? `Additional description: ${summary.description}` : ""
  ].filter(Boolean).join("\n");
}

export function mapSymptomTypeToRequestType(breakdownType) {
  const backendTypes = [
    "vehicle_not_starting",
    "flat_tyre",
    "battery_issue",
    "engine_problem",
    "engine_overheating",
    "brake_problem",
    "electrical_problem",
    "fuel_problem",
    "fuel_issue",
    "steering_problem",
    "transmission_problem",
    "strange_noise",
    "accident",
    "other"
  ];
  return backendTypes.includes(breakdownType) ? breakdownType : "other";
}

export function mapRequestTypeToSymptomType(breakdownType) {
  const symptomTypes = {
    battery_issue: "vehicle_not_starting",
    fuel_issue: "fuel_problem",
    strange_sound: "strange_noise"
  };
  return symptomTypes[breakdownType] || breakdownType;
}
