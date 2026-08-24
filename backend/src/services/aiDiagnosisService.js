const axios = require("axios");

const DEFAULT_AI_SERVICE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 5000;

function getTimeoutMs() {
  const configured = Number(process.env.AI_SERVICE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

function createRuleFallbackPrediction(requiredService = "general_mechanic") {
  return {
    predictedFault: null,
    faultLabel: "Fault classification unavailable",
    requiredService,
    confidence: null,
    confidenceLevel: "unavailable",
    predictionMargin: null,
    isAmbiguous: true,
    needsMoreInformation: true,
    topPredictions: [],
    predictionSource: "rule_fallback"
  };
}

function isValidPrediction(prediction) {
  return Boolean(
    prediction &&
      typeof prediction.predicted_fault === "string" &&
      prediction.predicted_fault &&
      typeof prediction.fault_label === "string" &&
      prediction.fault_label &&
      typeof prediction.required_service === "string" &&
      prediction.required_service &&
      Number.isFinite(prediction.confidence) &&
      Number.isFinite(prediction.prediction_margin) &&
      typeof prediction.confidence_level === "string" &&
      typeof prediction.is_ambiguous === "boolean" &&
      typeof prediction.needs_more_information === "boolean" &&
      Array.isArray(prediction.top_predictions)
  );
}

function normalizePrediction(prediction) {
  if (!isValidPrediction(prediction)) {
    throw new Error("AI service returned an invalid prediction response");
  }

  return {
    predictedFault: prediction.predicted_fault,
    faultLabel: prediction.fault_label,
    requiredService: prediction.required_service,
    confidence: prediction.confidence,
    confidenceLevel: prediction.confidence_level,
    predictionMargin: prediction.prediction_margin,
    isAmbiguous: prediction.is_ambiguous,
    needsMoreInformation: prediction.needs_more_information,
    topPredictions: prediction.top_predictions.slice(0, 3).map((item) => ({
      fault: String(item.fault),
      probability: Number(item.probability)
    })),
    predictionSource: "ai_model"
  };
}

async function diagnoseBreakdown(
  diagnosticInputText,
  { fallbackRequiredService = "general_mechanic", httpClient = axios } = {}
) {
  const fallback = createRuleFallbackPrediction(fallbackRequiredService);
  if (!diagnosticInputText || !String(diagnosticInputText).trim()) return fallback;

  const serviceUrl = String(
    process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL
  ).replace(/\/$/, "");

  try {
    const response = await httpClient.post(
      `${serviceUrl}/predict-fault`,
      { symptom_text: String(diagnosticInputText).trim().slice(0, 3000) },
      { timeout: getTimeoutMs() }
    );
    if (!response || !response.data || response.data.success !== true) return fallback;
    return normalizePrediction(response.data.prediction);
  } catch (_error) {
    return fallback;
  }
}

module.exports = {
  createRuleFallbackPrediction,
  diagnoseBreakdown,
  isValidPrediction,
  normalizePrediction
};
