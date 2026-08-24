const axios = require("axios");

const DEFAULT_AI_SERVICE_URL = "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 5000;

function getServiceUrl() {
  return String(process.env.AI_SERVICE_URL || DEFAULT_AI_SERVICE_URL).replace(/\/$/, "");
}

function getTimeoutMs() {
  const configured = Number(process.env.AI_SERVICE_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_TIMEOUT_MS;
}

function unavailable() {
  return {
    success: false,
    status: "troubleshooting_unavailable",
    message: "Self-troubleshooting is temporarily unavailable.",
    canRequestMechanic: true
  };
}

async function post(path, body, httpClient = axios) {
  try {
    const response = await httpClient.post(`${getServiceUrl()}${path}`, body, {
      timeout: getTimeoutMs()
    });
    if (!response?.data || response.data.success !== true) return unavailable();
    return response.data;
  } catch (_error) {
    return unavailable();
  }
}

function findGuide(faultCategory, symptomText, breakdownType, options = {}) {
  return post(
    "/ai2/find-guide",
    {
      fault_category: faultCategory,
      symptom_text: symptomText || undefined,
      breakdown_type: breakdownType || undefined
    },
    options.httpClient
  );
}

function startGuide(guideId, safetyConfirmed, options = {}) {
  return post(
    "/ai2/start",
    { guide_id: guideId, safety_confirmed: Boolean(safetyConfirmed) },
    options.httpClient
  );
}

function processStep(guideId, stepId, selectedResult, options = {}) {
  return post(
    "/ai2/step",
    { guide_id: guideId, step_id: stepId, selected_result: selectedResult },
    options.httpClient
  );
}

function checkStopCondition(guideId, condition, options = {}) {
  return post(
    "/ai2/stop-condition",
    { guide_id: guideId, condition },
    options.httpClient
  );
}

module.exports = {
  checkStopCondition,
  findGuide,
  processStep,
  startGuide,
  unavailable
};
