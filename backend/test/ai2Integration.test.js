const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const TroubleshootingSession = require("../src/models/TroubleshootingSession");
const aiDiagnosisService = require("../src/services/aiDiagnosisService");
const ai2Service = require("../src/services/ai2TroubleshootingService");
const controller = require("../src/controllers/selfAssistantController");

const driverId = new mongoose.Types.ObjectId();
const otherDriverId = new mongoose.Types.ObjectId();
const sessionId = new mongoose.Types.ObjectId().toString();

const prediction = {
  predictedFault: "electrical_system_fault",
  faultLabel: "Electrical / Starting System Problem",
  requiredService: "battery_electrical_mechanic",
  confidence: 0.91,
  confidenceLevel: "high",
  predictionMargin: 0.7,
  isAmbiguous: false,
  needsMoreInformation: false,
  topPredictions: [{ fault: "electrical_system_fault", probability: 0.91 }],
  predictionSource: "ai_model"
};

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return payload; }
  };
}

async function invoke(handler, req) {
  const res = response();
  let error;
  await handler(req, res, (forwarded) => { error = forwarded; });
  return { res, error };
}

function fakeSession(overrides = {}) {
  return {
    _id: sessionId,
    driverId,
    guideId: "ai2_aktc_0036",
    riskLevel: "CAUTION",
    status: "awaiting_safety_confirmation",
    currentStepId: null,
    currentStep: {
      step_id: "step_1",
      instruction: "Use the approved visual check.",
      result_question: "What did you safely observe?",
      possible_results: [{ value: "not_sure", label: "Not Sure" }]
    },
    currentPhase: "result",
    currentInstructionConfirmedAt: new Date(),
    completedSteps: [],
    recommendedService: "battery_electrical_mechanic",
    completedAt: null,
    async save() { this.saved = true; },
    ...overrides
  };
}

test("AI 2 client sends bounded requests to FastAPI", async () => {
  let request;
  const httpClient = {
    async post(url, body, options) {
      request = { url, body, options };
      return { data: { success: true, guide_available: false } };
    }
  };
  const result = await ai2Service.findGuide(
    "electrical_system_fault",
    "weak lights",
    "vehicle_not_starting",
    { httpClient }
  );
  assert.equal(result.guide_available, false);
  assert.match(request.url, /\/ai2\/find-guide$/);
  assert.equal(request.body.fault_category, "electrical_system_fault");
  assert.ok(request.options.timeout > 0);
});

test("AI 2 client fails closed when Python is offline", async () => {
  const result = await ai2Service.startGuide("guide", true, {
    httpClient: { post: async () => { throw new Error("offline"); } }
  });
  assert.equal(result.status, "troubleshooting_unavailable");
  assert.equal(result.canRequestMechanic, true);
  assert.equal(result.current_step, undefined);
});

test("low AI 1 confidence requests more information without creating a session", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const originalFindGuide = ai2Service.findGuide;
  const originalCreate = TroubleshootingSession.create;
  let created = false;
  let ai2Called = false;
  aiDiagnosisService.diagnoseBreakdown = async () => ({ ...prediction, needsMoreInformation: true });
  ai2Service.findGuide = async () => { ai2Called = true; };
  TroubleshootingSession.create = async () => { created = true; };
  try {
    const { res, error } = await invoke(controller.startSelfAssistant, {
      user: { _id: driverId },
      body: { vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "does not start" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "more_information_required");
    assert.equal(res.body.aiPrediction.predictedFault, "electrical_system_fault");
    assert.equal(res.body.aiPrediction.faultLabel, "Electrical / Starting System Problem");
    assert.equal(res.body.aiPrediction.requiredService, "battery_electrical_mechanic");
    assert.equal(res.body.aiPrediction.fallbackUsed, false);
    assert.equal(created, false);
    assert.equal(ai2Called, false);
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
    ai2Service.findGuide = originalFindGuide;
    TroubleshootingSession.create = originalCreate;
  }
});

test("low-confidence response derives service from the existing fault mapping", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  aiDiagnosisService.diagnoseBreakdown = async () => ({
    ...prediction,
    requiredService: undefined,
    needsMoreInformation: true
  });
  try {
    const { res, error } = await invoke(controller.startSelfAssistant, {
      user: { _id: driverId },
      body: { vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "clicking" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "more_information_required");
    assert.equal(res.body.aiPrediction.requiredService, "battery_electrical_mechanic");
    assert.equal(res.body.aiPrediction.fallbackUsed, false);
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
  }
});

test("low-confidence response uses marked general mechanic fallback when fault and service are missing", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  aiDiagnosisService.diagnoseBreakdown = async () => ({
    ...prediction,
    predictedFault: null,
    faultLabel: "Fault classification unavailable",
    requiredService: undefined,
    needsMoreInformation: true
  });
  try {
    const { res, error } = await invoke(controller.startSelfAssistant, {
      user: { _id: driverId },
      body: { vehicleType: "car", breakdownType: "other", diagnosticInputText: "unclear problem" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "more_information_required");
    assert.equal(res.body.aiPrediction.requiredService, "general_mechanic");
    assert.equal(res.body.aiPrediction.fallbackUsed, true);
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
  }
});

test("caution guide waits for confirmation and exposes no step", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const originalFind = ai2Service.findGuide;
  const originalStart = ai2Service.startGuide;
  const originalCreate = TroubleshootingSession.create;
  let startCalled = false;
  aiDiagnosisService.diagnoseBreakdown = async () => prediction;
  ai2Service.findGuide = async () => ({
    success: true,
    guide_available: true,
    guide: {
      guide_id: "ai2_aktc_0036",
      title: "Battery Replacement",
      risk_level: "CAUTION",
      safety_warning: "Park safely.",
      before_you_begin: ["Apply the parking brake"],
      recommended_service: "battery_electrical_mechanic",
      professional_help_required: false
    }
  });
  ai2Service.startGuide = async () => { startCalled = true; };
  TroubleshootingSession.create = async (payload) => fakeSession(payload);
  try {
    const { res, error } = await invoke(controller.startSelfAssistant, {
      user: { _id: driverId },
      body: { vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "weak lights and clicking" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "awaiting_safety_confirmation");
    assert.equal(res.body.currentStep, undefined);
    assert.equal(startCalled, false);
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
    ai2Service.findGuide = originalFind;
    ai2Service.startGuide = originalStart;
    TroubleshootingSession.create = originalCreate;
  }
});

test("low-risk guide starts only with a FastAPI-approved step", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const originalFind = ai2Service.findGuide;
  const originalStart = ai2Service.startGuide;
  const originalCreate = TroubleshootingSession.create;
  aiDiagnosisService.diagnoseBreakdown = async () => ({ ...prediction, predictedFault: "wheel_tire_fault" });
  ai2Service.findGuide = async () => ({ success: true, guide_available: true, guide: {
    guide_id: "ai2_aktc_0098", title: "Tyre Pressure Check", risk_level: "LOW",
    recommended_service: "tire_mechanic", professional_help_required: false
  } });
  ai2Service.startGuide = async () => ({ success: true, status: "in_progress", current_step: {
    step_id: "step_1", instruction: "Use the approved visual check.", question: "What do you notice?", possible_results: []
  } });
  TroubleshootingSession.create = async (payload) => fakeSession(payload);
  try {
    const { res, error } = await invoke(controller.startSelfAssistant, {
      user: { _id: driverId },
      body: { vehicleType: "car", breakdownType: "flat_tyre", diagnosticInputText: "tyre pressure warning" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "ready_to_start");
    assert.equal(res.body.currentStep.step_id, "step_1");
    assert.equal(res.body.riskLevel, "LOW");
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
    ai2Service.findGuide = originalFind;
    ai2Service.startGuide = originalStart;
    TroubleshootingSession.create = originalCreate;
  }
});

test("high-risk guide creates no active repair process", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const originalFind = ai2Service.findGuide;
  const originalCreate = TroubleshootingSession.create;
  aiDiagnosisService.diagnoseBreakdown = async () => ({ ...prediction, predictedFault: "brake_system_fault" });
  ai2Service.findGuide = async () => ({ success: true, guide_available: true, guide: {
    guide_id: "ai2_aktc_0001", title: "Brake Issue", risk_level: "HIGH",
    recommended_service: "brake_mechanic", professional_help_required: true
  } });
  TroubleshootingSession.create = async (payload) => fakeSession(payload);
  try {
    const { res, error } = await invoke(controller.startSelfAssistant, {
      user: { _id: driverId },
      body: { vehicleType: "car", breakdownType: "brake_problem", diagnosticInputText: "brakes feel unsafe" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "professional_help_required");
    assert.equal(res.body.currentStep, undefined);
    assert.equal(res.body.riskLevel, "HIGH");
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
    ai2Service.findGuide = originalFind;
    TroubleshootingSession.create = originalCreate;
  }
});

test("safety confirmation starts a caution session", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const originalStart = ai2Service.startGuide;
  const session = fakeSession();
  TroubleshootingSession.findById = async () => session;
  ai2Service.startGuide = async (guideId, confirmed) => {
    assert.equal(confirmed, true);
    return { success: true, status: "in_progress", current_step: { step_id: "step_1", instruction: "Look safely.", question: "What do you see?", possible_results: [] } };
  };
  try {
    const { res, error } = await invoke(controller.confirmSafety, { params: { sessionId }, user: { _id: driverId }, body: {} });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "in_progress");
    assert.equal(session.safetyConfirmed, true);
    assert.equal(session.currentStepId, "step_1");
    assert.equal(session.currentPhase, "instruction");
  } finally {
    TroubleshootingSession.findById = originalFindById;
    ai2Service.startGuide = originalStart;
  }
});

test("action confirmation persists result phase before options can be submitted", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const session = fakeSession({
    status: "in_progress",
    currentStepId: "step_1",
    currentPhase: "instruction",
    currentInstructionConfirmedAt: null
  });
  TroubleshootingSession.findById = async () => session;
  try {
    const { res, error } = await invoke(controller.confirmStepAction, {
      params: { sessionId }, user: { _id: driverId }, body: { stepId: "step_1" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.currentPhase, "result");
    assert.equal(session.currentPhase, "result");
    assert.ok(session.currentInstructionConfirmedAt instanceof Date);
    assert.equal(session.saved, true);
  } finally {
    TroubleshootingSession.findById = originalFindById;
  }
});

test("result submission is rejected until the approved action is confirmed", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const originalStep = ai2Service.processStep;
  let engineCalled = false;
  TroubleshootingSession.findById = async () => fakeSession({ status: "in_progress", currentStepId: "step_1", currentPhase: "instruction" });
  ai2Service.processStep = async () => { engineCalled = true; };
  try {
    const { res, error } = await invoke(controller.submitStep, {
      params: { sessionId }, user: { _id: driverId }, body: { stepId: "step_1", selectedResult: "not_sure" }
    });
    assert.equal(res.statusCode, 409);
    assert.match(error.message, /Confirm the approved instruction/);
    assert.equal(engineCalled, false);
  } finally {
    TroubleshootingSession.findById = originalFindById;
    ai2Service.processStep = originalStep;
  }
});

test("backend next step resets the persisted phase to instruction", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const originalStep = ai2Service.processStep;
  const session = fakeSession({ status: "in_progress", currentStepId: "step_1", currentPhase: "result" });
  TroubleshootingSession.findById = async () => session;
  ai2Service.processStep = async () => ({ success: true, status: "in_progress", next_step: {
    step_id: "step_2", instruction: "Read the next approved check.", result_question: "What happened?", possible_results: []
  } });
  try {
    const { res, error } = await invoke(controller.submitStep, {
      params: { sessionId }, user: { _id: driverId }, body: { stepId: "step_1", selectedResult: "not_sure" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.nextStep.step_id, "step_2");
    assert.equal(session.currentStepId, "step_2");
    assert.equal(session.currentPhase, "instruction");
    assert.equal(session.completedSteps[0].instructionConfirmed, true);
  } finally {
    TroubleshootingSession.findById = originalFindById;
    ai2Service.processStep = originalStep;
  }
});

test("confirmation cannot bypass the session state gate", async () => {
  const originalFindById = TroubleshootingSession.findById;
  TroubleshootingSession.findById = async () => fakeSession({ status: "in_progress" });
  try {
    const { res, error } = await invoke(controller.confirmSafety, { params: { sessionId }, user: { _id: driverId }, body: {} });
    assert.equal(res.statusCode, 409);
    assert.match(error.message, /not awaiting safety confirmation/);
  } finally {
    TroubleshootingSession.findById = originalFindById;
  }
});

test("smoke stops an active session immediately", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const originalStop = ai2Service.checkStopCondition;
  const session = fakeSession({ status: "in_progress", currentStepId: "step_1" });
  TroubleshootingSession.findById = async () => session;
  ai2Service.checkStopCondition = async () => ({ success: true, stop: true, status: "professional_help_required", message: "Stop for smoke." });
  try {
    const { res, error } = await invoke(controller.stopSession, { params: { sessionId }, user: { _id: driverId }, body: { condition: "smoke" } });
    assert.equal(error, undefined);
    assert.equal(res.body.stop, true);
    assert.equal(session.status, "professional_help_required");
    assert.equal(session.currentStepId, null);
  } finally {
    TroubleshootingSession.findById = originalFindById;
    ai2Service.checkStopCondition = originalStop;
  }
});

test("not sure is delegated to the authoritative engine", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const originalStep = ai2Service.processStep;
  const session = fakeSession({ status: "in_progress", currentStepId: "step_1" });
  TroubleshootingSession.findById = async () => session;
  ai2Service.processStep = async (guideId, stepId, selectedResult) => {
    assert.equal(selectedResult, "not_sure");
    return { success: true, status: "professional_help_required", message: "Stopped safely." };
  };
  try {
    const { res, error } = await invoke(controller.submitStep, {
      params: { sessionId }, user: { _id: driverId }, body: { stepId: "step_1", selectedResult: "not_sure" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "professional_help_required");
    assert.equal(session.completedSteps.length, 1);
  } finally {
    TroubleshootingSession.findById = originalFindById;
    ai2Service.processStep = originalStep;
  }
});

test("engine completion waits for the driver's real-world resolution confirmation", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const originalStep = ai2Service.processStep;
  const session = fakeSession({ status: "in_progress", currentStepId: "step_1", currentPhase: "result" });
  TroubleshootingSession.findById = async () => session;
  ai2Service.processStep = async () => ({
    success: true,
    status: "resolved",
    message: "The approved pathway is complete."
  });
  try {
    const { res, error } = await invoke(controller.submitStep, {
      params: { sessionId }, user: { _id: driverId }, body: { stepId: "step_1", selectedResult: "clean" }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "resolved");
    assert.equal(session.status, "awaiting_resolution_confirmation");
    assert.equal(session.completedAt, null);
    assert.equal(session.currentPhase, "completed");
  } finally {
    TroubleshootingSession.findById = originalFindById;
    ai2Service.processStep = originalStep;
  }
});

test("driver cannot access another driver's session", async () => {
  const originalFindById = TroubleshootingSession.findById;
  TroubleshootingSession.findById = async () => fakeSession({ driverId: otherDriverId });
  try {
    const { res, error } = await invoke(controller.getSession, { params: { sessionId }, user: { _id: driverId } });
    assert.equal(res.statusCode, 403);
    assert.match(error.message, /permission/);
  } finally {
    TroubleshootingSession.findById = originalFindById;
  }
});

test("history is scoped to the authenticated driver and limited to five", async () => {
  const originalFind = TroubleshootingSession.find;
  let filter;
  let limit;
  TroubleshootingSession.find = (query) => {
    filter = query;
    return {
      sort() { return this; },
      async limit(value) { limit = value; return []; }
    };
  };
  try {
    const { res, error } = await invoke(controller.getHistory, { user: { _id: driverId } });
    assert.equal(error, undefined);
    assert.equal(String(filter.driverId), String(driverId));
    assert.equal(limit, 5);
    assert.deepEqual(res.body.sessions, []);
  } finally {
    TroubleshootingSession.find = originalFind;
  }
});

test("driver-confirmed result is persisted only after engine completion", async () => {
  const originalFindById = TroubleshootingSession.findById;
  const session = fakeSession({ status: "awaiting_resolution_confirmation", currentStepId: null, currentStep: null, currentPhase: "completed" });
  TroubleshootingSession.findById = async () => session;
  try {
    const { res, error } = await invoke(controller.setResult, {
      params: { sessionId }, user: { _id: driverId }, body: { resolved: true }
    });
    assert.equal(error, undefined);
    assert.equal(res.body.status, "resolved");
    assert.equal(session.status, "resolved");
  } finally {
    TroubleshootingSession.findById = originalFindById;
  }
});
