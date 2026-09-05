const aiDiagnosisService = require("./aiDiagnosisService");
const faultLabels = require("../../ai/config/fault_labels.json");
const faultServiceMapping = require("../../ai/config/fault_service_mapping.json");

const STRUCTURED_PROBLEM_FAULTS = Object.freeze({
  flat_tyre: "wheel_tire_fault",
  brake_problem: "brake_system_fault",
  steering_problem: "steering_system_fault",
  transmission_problem: "transmission_fault",
  fuel_problem: "fuel_system_fault",
  electrical_problem: "electrical_system_fault",
  engine_overheating: "cooling_system_fault"
});

const AI_FIRST_PROBLEMS = Object.freeze([
  "vehicle_not_starting",
  "engine_problem",
  "strange_noise",
  "other"
]);

function getStructuredProblemRoute(breakdownType) {
  const predictedFault = STRUCTURED_PROBLEM_FAULTS[breakdownType];
  if (!predictedFault) return null;
  return {
    predictedFault,
    faultLabel: faultLabels[predictedFault],
    requiredService: faultServiceMapping[predictedFault]
  };
}

function createStructuredPrediction(breakdownType) {
  const route = getStructuredProblemRoute(breakdownType);
  if (!route) return null;
  return {
    ...route,
    confidence: null,
    confidenceLevel: "high",
    predictionMargin: null,
    isAmbiguous: false,
    needsMoreInformation: false,
    topPredictions: [],
    predictionSource: "structured_problem"
  };
}

async function diagnoseWithStructuredProblemPolicy(
  breakdownType,
  diagnosticInputText,
  options = {}
) {
  // AI 1 remains available as secondary validation, but a high-specificity
  // driver selection is authoritative and cannot be replaced by another class.
  const modelPrediction = await aiDiagnosisService.diagnoseBreakdown(
    diagnosticInputText,
    options
  );
  return createStructuredPrediction(breakdownType) || modelPrediction;
}

module.exports = {
  AI_FIRST_PROBLEMS,
  STRUCTURED_PROBLEM_FAULTS,
  createStructuredPrediction,
  diagnoseWithStructuredProblemPolicy,
  getStructuredProblemRoute
};
