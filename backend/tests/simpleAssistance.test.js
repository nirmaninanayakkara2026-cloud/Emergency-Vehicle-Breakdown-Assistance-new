const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const mongoose = require("mongoose");
const Session = require("../src/models/TroubleshootingSession");
const controller = require("../src/controllers/selfAssistantController");
const ai1 = require("../src/services/aiDiagnosisService");
const ai2 = require("../src/services/ai2TroubleshootingService");
const aiHelp = require("../src/services/aiTroubleshootingHelpService");
const { detectDanger } = require("../src/services/troubleshootingSafetyService");
const { buildModelInput } = require("../src/services/simpleAssistanceService");
const BreakdownRequest = require("../src/models/BreakdownRequest");
const { createBreakdownRequest } = require("../src/controllers/breakdownRequestController");

const aiRoot = path.resolve(__dirname, "../ai");
const venv = path.join(aiRoot, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.AI_TEST_PYTHON || (fs.existsSync(venv) ? venv : "python");
const driverId = new mongoose.Types.ObjectId();
const saved = new Map();
const originals = {};
let modelCalls = 0;
let helpCalls = 0;
let safetyHelpCalls = 0;
let lastHelpContext;

function pythonCall(code, input) {
  const result = spawnSync(python, ["-c", code], { cwd: aiRoot, input: JSON.stringify(input), encoding: "utf8", timeout: 30000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}
before(() => {
  originals.save = Session.prototype.save;
  originals.find = Session.findById;
  originals.predict = ai1.diagnoseBreakdown;
  originals.guide = ai2.findGuide;
  originals.help = aiHelp.getAiTroubleshootingHelp;
  originals.safetyHelp = aiHelp.getDangerSafetyHelp;
  Session.prototype.save = async function () {
    const error = this.validateSync();
    if (error) throw error;
    saved.set(String(this._id), this.toObject());
    return this;
  };
  Session.findById = async (id) => saved.has(String(id)) ? new Session(saved.get(String(id))) : null;
  ai1.diagnoseBreakdown = async () => {
    modelCalls += 1;
    return { predictedFault: "electrical_system_fault", confidence: 0.67,
      confidenceLevel: "medium", needsMoreInformation: false };
  };
  ai2.findGuide = async (category, text) => pythonCall(`import json,sys
from ai2.services.troubleshooting_engine import get_guide_for_fault
category,text=json.load(sys.stdin)
guide=get_guide_for_fault(category,text)
print(json.dumps({'success':True,'guide_available':bool(guide),'guide':dict(guide,guide_id=guide['id']) if guide else None}))`, [category, text]);
  aiHelp.getAiTroubleshootingHelp = async (context) => {
    helpCalls += 1;
    lastHelpContext = context;
    return { available: true, professionalHelp: false, risk: "LOW",
      explanation: "Look only at the visible terminals from a safe position. A white crust may be corrosion. Do not touch them.",
      steps: ["Read the warning message already displayed on the dashboard.", "Consult the vehicle handbook for that message."] };
  };
  aiHelp.getDangerSafetyHelp = async ({ danger, driverType }) => {
    safetyHelpCalls += 1;
    const actions = [
      "If the vehicle is already stopped safely, switch it off and apply the parking brake.",
      "Do not restart or operate the vehicle.",
      "Request a mechanic or recovery vehicle and describe the warning signs you observed."
    ];
    if (danger.emergency) actions.splice(1, 0, "If there is smoke, fire or a fuel leak, leave the vehicle using a safe route and keep everyone away.");
    if (danger.id === "overheating" && driverType === "technical") actions.splice(-1, 0,
      "Keep the engine switched off until it is completely cold. Never remove a radiator or coolant-reservoir cap while the system is hot.",
      "Only after the engine is completely cold, use the vehicle handbook to identify the coolant reservoir and visually inspect for leakage.",
      "Only if there is no visible leak, the reservoir is not empty, and the handbook permits it, add the exact specified premixed coolant through the coolant reservoir up to its marked level.",
      "Do not drive if the reservoir is empty, a leak or damaged belt is visible, or the temperature warning returns. Request vehicle recovery."
    );
    return { available: true, source: "OPENAI", professionalHelp: true, actions };
  };
});
after(() => {
  Session.prototype.save = originals.save;
  Session.findById = originals.find;
  ai1.diagnoseBreakdown = originals.predict;
  ai2.findGuide = originals.guide;
  aiHelp.getAiTroubleshootingHelp = originals.help;
  aiHelp.getDangerSafetyHelp = originals.safetyHelp;
});

async function call(handler, body, id, user = driverId) {
  let error;
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.body = JSON.parse(JSON.stringify(data)); } };
  await handler({ user: { _id: user }, params: { sessionId: id }, body }, res, (value) => { error = value; });
  return { ...res, error };
}
const batteryInput = {
  driverType: "non_technical", vehicleType: "car", breakdownType: "vehicle_not_starting",
  diagnosticInputText: "Vehicle will not start. Clicking sound. Dashboard lights are weak. No smoke. No fuel smell.",
  symptomCapture: { symptoms: { starting_behavior: "clicking", light_condition: "dim", danger_signs: ["none"] } }
};
async function batterySession() {
  const result = await call(controller.startSelfAssistant, batteryInput);
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "awaiting_safety_confirmation");
  return result.body.session;
}
async function activeBattery() {
  const session = await batterySession();
  const result = await call(controller.confirmSafety, {}, session._id);
  assert.equal(result.error, undefined);
  return result.body.session;
}

test("nontechnical battery symptoms use AI 1 then the actual local battery guide", async () => {
  const previousModel = modelCalls;
  const previousHelp = helpCalls;
  const session = await batterySession();
  assert.equal(modelCalls, previousModel + 1);
  assert.equal(helpCalls, previousHelp);
  assert.equal(session.predictedFault.fault, "electrical_system_fault");
  assert.match(session.identifiedProblem, /Weak 12V Battery/);
  assert.equal(session.guideId, "ai2_aktc_0036");
  assert.equal(session.troubleshootingSource, "LOCAL_KB");
  assert.equal(session.riskLevel, "CAUTION");
  assert.deepEqual(session.guidanceSteps, []);
  assert.ok((await Session.findById(session._id)).guidanceSteps.length);
});

test("technical electrical category narrows to battery guidance", async () => {
  const result = await call(controller.startSelfAssistant, { ...batteryInput, driverType: "technical", breakdownType: "electrical_problem" });
  assert.equal(result.error, undefined);
  assert.equal(result.body.session.guideId, "ai2_aktc_0036");
  assert.equal(result.body.session.driverType, "technical");
});

test("technical washer selection bypasses AI 1 clarification and opens its local guide", async () => {
  const result = await call(controller.startSelfAssistant, {
    driverType: "technical", vehicleType: "car", breakdownType: "visibility_problem",
    diagnosticInputText: "No washer fluid sprays. The washer-fluid level looks low. There is no visible leak.",
    symptomCapture: { symptoms: {
      washer_behavior: "no_spray", washer_level: "low_fluid", danger_signs: ["none"]
    } }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "in_progress");
  assert.equal(result.body.session.predictedFault.fault, "visibility_system_fault");
  assert.equal(result.body.session.guideId, "ai2_aktc_0091");
  assert.equal(result.body.currentStep.step_id, "step_1");
});

test("technical cabin-filter selection bypasses AI 1 clarification and opens its local guide", async () => {
  const result = await call(controller.startSelfAssistant, {
    driverType: "technical", vehicleType: "car", breakdownType: "cabin_filter_problem",
    diagnosticInputText: "Cabin airflow is weak and the cabin air filter looks dirty. No smoke or burning smell.",
    symptomCapture: { symptoms: {
      cabin_airflow: "weak_airflow", cabin_filter_observation: "dirty_filter", danger_signs: ["none"]
    } }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "in_progress");
  assert.equal(result.body.session.predictedFault.fault, "air_conditioning_fault");
  assert.equal(result.body.session.guideId, "ai2_aktc_0015");
  assert.equal(result.body.currentStep.step_id, "step_1");
});

test("nontechnical loss of power offers an air-filter first check without optional text", async () => {
  const previousHelp = helpCalls;
  const result = await call(controller.startSelfAssistant, {
    driverType: "non_technical", vehicleType: "car", breakdownType: "loss_of_power",
    diagnosticInputText: [
      "Guided symptoms - Loss of power",
      "Power loss timing: When accelerating",
      "Warning light: No",
      "Danger signs: None",
      "Other observations: FEEL - Loss of power"
    ].join("\n"),
    symptomCapture: {
      symptoms: { power_loss_timing: "accelerating", power_warning: "no", danger_signs: ["none"] },
      observedSymptoms: { see: [], hear: [], smell: [], feel: ["loss_of_power"] },
      additionalDescription: ""
    }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "awaiting_safety_confirmation");
  assert.equal(result.body.session.predictedFault.fault, "engine_system_fault");
  assert.equal(result.body.session.identifiedProblem, "Air Filter");
  assert.equal(result.body.session.guideId, "ai2_aktc_0076");
  assert.equal(result.body.session.troubleshootingSource, "LOCAL_KB");
  assert.equal(helpCalls, previousHelp);
});

test("nontechnical red temperature warning can enter the guarded low-coolant check", async () => {
  const result = await call(controller.startSelfAssistant, {
    driverType: "non_technical", vehicleType: "car", breakdownType: "feels_hot",
    diagnosticInputText: "The temperature meter is in the red. Coolant looked low after the engine cooled. No smoke, steam, or visible leak.",
    symptomCapture: {
      symptoms: { warning_detail: "temperature_red", hot_signs: "coolant_low", danger_signs: ["none"] },
      observedSymptoms: { see: [], hear: [], smell: [], feel: [] }, additionalDescription: ""
    }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "awaiting_safety_confirmation");
  assert.equal(result.body.session.predictedFault.fault, "cooling_system_fault");
  assert.equal(result.body.session.identifiedProblem, "Coolant Reservoir");
  assert.equal(result.body.session.guideId, "ai2_aktc_0088");
  assert.equal(result.body.session.troubleshootingSource, "LOCAL_KB");
});

test("typed low coolant from the older Nothing else choice also enters the guarded check", async () => {
  const result = await call(controller.startSelfAssistant, {
    driverType: "non_technical", vehicleType: "car", breakdownType: "feels_hot",
    diagnosticInputText: "The temperature meter is in the red. After the engine cooled completely, the coolant level looked low. There is no visible leak, smoke, steam, or burning smell.",
    symptomCapture: {
      symptoms: { warning_detail: "temperature_red", hot_signs: "none", danger_signs: ["none"] },
      observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
      additionalDescription: "After the engine cooled completely, the coolant level looked low. There is no visible leak, smoke, steam, or burning smell."
    }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "awaiting_safety_confirmation");
  assert.equal(result.body.session.guideId, "ai2_aktc_0088");
});

test("red temperature with steam still stops instead of entering the coolant check", async () => {
  const result = await call(controller.startSelfAssistant, {
    driverType: "non_technical", vehicleType: "car", breakdownType: "feels_hot",
    diagnosticInputText: "The temperature meter is in the red and steam is visible.",
    symptomCapture: { symptoms: {
      warning_detail: "temperature_red", hot_signs: "steam", danger_signs: ["none"]
    } }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "professional_help_required");
  assert.equal(result.body.session.riskLevel, "HIGH");
});

test("CAUTION acknowledgement opens the approved visual check", async () => {
  const session = await activeBattery();
  assert.equal(session.status, "in_progress");
  assert.equal(session.safetyConfirmed, true);
  assert.match(session.currentStep.instruction, /inspect battery terminals/i);
  assert.equal(session.currentStep.source_instruction, undefined);
});

test("missing useful local knowledge invokes OpenAI fallback", async () => {
  const previous = helpCalls;
  const result = await call(controller.startSelfAssistant, {
    driverType: "technical", vehicleType: "car", breakdownType: "electrical_problem",
    diagnosticInputText: "The interior display shows an unfamiliar message."
  });
  assert.equal(result.error, undefined);
  assert.equal(helpCalls, previous + 1);
  assert.equal(result.body.session.troubleshootingSource, "OPENAI");
  assert.equal(result.body.status, "in_progress");
  assert.equal(result.body.session.guidanceSteps.length, 2);
});

test("a high-risk AI 2 guide returns immediate safety actions without repair generation", async (t) => {
  t.mock.method(ai2, "findGuide", async () => ({ guide_available: true, guide: {
    guide_id: "high_risk_test", title: "Unsafe Component Safety Guide", risk_level: "HIGH",
    professional_help_required: true, steps: []
  } }));
  const previousHelp = helpCalls;
  const previousSafetyHelp = safetyHelpCalls;
  const result = await call(controller.startSelfAssistant, {
    driverType: "technical", vehicleType: "car", breakdownType: "engine_problem",
    diagnosticInputText: "An internal engine component appears faulty."
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "professional_help_required");
  assert.equal(result.body.riskLevel, "HIGH");
  assert.equal(helpCalls, previousHelp);
  assert.equal(safetyHelpCalls, previousSafetyHelp + 1);
  assert.ok(result.body.session.safetyActions.length >= 3);
});

test("oil-can warning stops safely with a useful problem and engine-mechanic recommendation", async () => {
  const result = await call(controller.startSelfAssistant, {
    driverType: "non_technical", vehicleType: "car", breakdownType: "warning_light",
    diagnosticInputText: "The oil-can warning appeared while driving and stayed on. The vehicle is safely parked and switched off. No smoke or visible fluid leak.",
    symptomCapture: { symptoms: {
      warning_detail: "oil_pressure_warning", notice_timing: "driving", danger_signs: ["none"]
    } }
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "professional_help_required");
  assert.equal(result.body.aiPrediction.predictedFault, "engine_system_fault");
  assert.equal(result.body.aiPrediction.faultLabel, "Engine Oil Pressure Warning");
  assert.equal(result.body.recommendedService, "engine_mechanic");
});

for (const symptoms of ["Smoke is coming from the engine.", "My brakes are not working.", "I don't smell fuel, but smoke is coming out.", "The steering is not working.", "The high-voltage battery has a problem."]) {
  test(`danger skips diagnosis and repair guidance but returns safe actions: ${symptoms}`, async () => {
    const previousHelp = helpCalls;
    const previousSafetyHelp = safetyHelpCalls;
    const previousModel = modelCalls;
    const result = await call(controller.startSelfAssistant, { ...batteryInput, diagnosticInputText: symptoms });
    assert.equal(result.error, undefined);
    assert.equal(result.body.status, "professional_help_required");
    assert.equal(result.body.currentStep, null);
    assert.deepEqual(result.body.session.guidanceSteps, []);
    assert.equal(helpCalls, previousHelp);
    assert.equal(safetyHelpCalls, previousSafetyHelp + 1);
    assert.equal(modelCalls, previousModel);
    assert.equal(result.body.session.troubleshootingSource, "OPENAI");
    assert.ok(result.body.session.safetyActions.length >= 3);
    assert.match(result.body.session.safetyActions.at(-1), /mechanic|recovery/i);
  });
}

test("only a technical driver receives the cold-engine overheating checks", async () => {
  const input = {
    vehicleType: "car", breakdownType: "cooling_problem",
    diagnosticInputText: "The temperature gauge is in the red. No smoke, steam or visible leak."
  };
  const technical = await call(controller.startSelfAssistant, { ...input, driverType: "technical" });
  const nontechnical = await call(controller.startSelfAssistant, { ...input,
    driverType: "non_technical", breakdownType: "feels_hot" });
  assert.equal(technical.body.status, "professional_help_required");
  assert.equal(nontechnical.body.status, "professional_help_required");
  assert.ok(technical.body.session.safetyActions.some((action) => /completely cold/i.test(action)));
  assert.ok(technical.body.session.safetyActions.some((action) => /specified premixed coolant/i.test(action)));
  assert.ok(technical.body.session.safetyActions.some((action) => /request vehicle recovery/i.test(action)));
  assert.equal(nontechnical.body.session.safetyActions.some((action) => /specified premixed coolant/i.test(action)), false);
});

test("negative observations do not trigger danger; affirmative failures still do", () => {
  for (const text of ["The engine is not overheating.", "I don't smell fuel.", "No smoke. No fuel smell.", "The battery is not leaking.", "No fire or smoke.", "No smoke or burning smell.", "No smoke, sparks, or exposed damaged wiring.", "There is no smoke, overheating, or fluid leak.", "There is no warning light, smoke, burning smell, unusual noise, overheating, or fluid leak."]) {
    assert.equal(detectDanger(text), null, text);
  }
  for (const text of ["My brakes are not working", "No smoke and brakes are not working", "No warning light, but smoke is coming from the bonnet", "Fuel is leaking", "Battery is leaking", "I am not sure if it is overheating", "The temperature gauge is in the red"]) {
    assert.ok(detectDanger(text), text);
  }
});

test("more help explains the current step without advancing or changing the source", async () => {
  const session = await activeBattery();
  const result = await call(controller.askForHelp, { question: "How do I check them?" }, session._id);
  assert.equal(result.error, undefined);
  assert.match(result.body.help, /visible terminals/);
  assert.equal(result.body.session.currentStepId, session.currentStepId);
  assert.equal(result.body.session.troubleshootingSource, "LOCAL_KB");
  assert.equal(result.body.session.completedSteps.length, 0);
});

test("danger reported while asking for help stops repair guidance and returns safety actions", async () => {
  const session = await activeBattery();
  const previousHelp = helpCalls;
  const previousSafetyHelp = safetyHelpCalls;
  const result = await call(controller.askForHelp, { question: "There is now smoke. What should I do?" }, session._id);
  assert.equal(result.body.status, "professional_help_required");
  assert.equal(helpCalls, previousHelp);
  assert.equal(safetyHelpCalls, previousSafetyHelp + 1);
  assert.ok(result.body.session.safetyActions.some((action) => /leave the vehicle/i.test(action)));
});

test("a dangerous step observation stops before the guide can continue", async () => {
  const step = {
    step_id: "visible_check", instruction: "Look from a safe position.",
    possible_results: [{ value: "smoke_visible", label: "Smoke is visible", action: "continue", next_step: "next_check" }]
  };
  const session = new Session({
    driverId, driverType: "non_technical", vehicleType: "car",
    breakdownType: "vehicle_not_starting", diagnosticInputText: "Vehicle will not start",
    predictedFault: { fault: "electrical_system_fault", label: "Electrical / Starting System Problem" },
    status: "in_progress", riskLevel: "CAUTION", currentStep: step,
    currentStepId: step.step_id, guidanceSteps: [step, { step_id: "next_check", instruction: "Another check" }]
  });
  await session.save();
  const previousRepairHelp = helpCalls;
  const previousSafetyHelp = safetyHelpCalls;
  const result = await call(controller.guidanceAction, {
    action: "observation", selectedResult: "smoke_visible", stepId: step.step_id
  }, String(session._id));
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "professional_help_required");
  assert.equal(result.body.riskLevel, "HIGH");
  assert.equal(result.body.currentStep, null);
  assert.deepEqual(result.body.session.guidanceSteps, []);
  assert.equal(helpCalls, previousRepairHelp);
  assert.equal(safetyHelpCalls, previousSafetyHelp + 1);
  assert.ok(result.body.session.safetyActions.some((action) => /leave the vehicle/i.test(action)));
});

test("Not sure stays on the step instead of immediately escalating", async () => {
  const session = await activeBattery();
  const result = await call(controller.guidanceAction, { action: "not_sure", stepId: session.currentStepId }, session._id);
  assert.equal(result.error, undefined);
  assert.equal(result.body.status, "in_progress");
  assert.equal(result.body.session.completedSteps.length, 0);
});

test("Problem Solved persists the resolution, driver type, source and timestamp", async () => {
  const session = await activeBattery();
  const result = await call(controller.guidanceAction, { action: "solved", stepId: session.currentStepId }, session._id);
  assert.equal(result.error, undefined);
  const stored = await Session.findById(session._id);
  assert.equal(stored.status, "resolved");
  assert.equal(stored.resolved, true);
  assert.equal(stored.driverType, "non_technical");
  assert.equal(stored.troubleshootingSource, "LOCAL_KB");
  assert.ok(stored.completedAt);
});

test("normal battery observation requires resolution confirmation; still broken uses fallback guidance", async () => {
  const session = await activeBattery();
  const observed = await call(controller.guidanceAction, { action: "observation", selectedResult: "clean_terminals", stepId: session.currentStepId }, session._id);
  assert.equal(observed.error, undefined);
  assert.equal(observed.body.status, "awaiting_resolution_confirmation");
  assert.equal(observed.body.session.resolved, false);
  const result = await call(controller.guidanceAction, { action: "still_not_fixed", stepId: null }, session._id);
  assert.equal(result.body.status, "in_progress");
  assert.equal(result.body.session.troubleshootingSource, "OPENAI");
  assert.equal(result.body.currentStep.step_id, "ai_self_fix_1");
  assert.equal(result.body.session.recommendedService, "battery_electrical_mechanic");
});

test("a local observation with no self-fix guide asks OpenAI for safe driver actions", async () => {
  const step = {
    step_id: "pressure_check", instruction: "Check the tyre pressure using a suitable gauge.",
    possible_results: [{ value: "low_pressure", label: "Low pressure", action: "request_mechanic", next_step: null }]
  };
  const session = new Session({
    driverId, driverType: "non_technical", vehicleType: "car", breakdownType: "flat_tyre",
    diagnosticInputText: "Tyre pressure warning is on", identifiedProblem: "Tyre pressure problem",
    predictedFault: { fault: "wheel_tire_fault", label: "Wheel / Tyre Problem" },
    troubleshootingSource: "LOCAL_KB", status: "in_progress", riskLevel: "LOW",
    currentStep: step, currentStepId: step.step_id, guidanceSteps: [step]
  });
  await session.save();
  const previous = helpCalls;
  const result = await call(controller.guidanceAction, {
    action: "observation", selectedResult: "low_pressure", stepId: step.step_id
  }, String(session._id));
  assert.equal(result.error, undefined);
  assert.equal(helpCalls, previous + 1);
  assert.equal(result.body.status, "in_progress");
  assert.equal(result.body.session.troubleshootingSource, "OPENAI");
  assert.equal(result.body.currentStep.step_id, "ai_self_fix_1");
  assert.equal(result.body.session.completedSteps[0].selectedResult, "low_pressure");
  assert.match(lastHelpContext.symptoms, /Local check result: Low pressure/);
  assert.match(lastHelpContext.currentStep, /tyre pressure/i);
});

test("Still Not Fixed advances generated checks and stops when exhausted", async () => {
  const start = await call(controller.startSelfAssistant, { driverType: "technical", vehicleType: "car", breakdownType: "electrical_problem", diagnosticInputText: "The interior display shows an unfamiliar message." });
  const id = start.body.session._id;
  const next = await call(controller.guidanceAction, { action: "still_not_fixed", stepId: "ai_step_1" }, id);
  assert.equal(next.body.currentStep.step_id, "ai_step_2");
  const end = await call(controller.guidanceAction, { action: "still_not_fixed", stepId: "ai_step_2" }, id);
  assert.equal(end.body.status, "professional_help_required");
});

test("Still Not Fixed advances the next approved local step when all outcomes agree", async () => {
  const guide = pythonCall(`import json
from ai2.services.troubleshooting_engine import get_guide_by_id
print(json.dumps(get_guide_by_id('ai2_aktc_0078')))`, null);
  const session = new Session({
    driverId, vehicleType: "car", driverType: "technical", breakdownType: "engine_problem",
    diagnosticInputText: "Engine oil level looks low", predictedFault: { fault: "engine_system_fault" },
    troubleshootingSource: "LOCAL_KB", guideId: guide.id, guidanceSteps: guide.steps,
    status: "in_progress", riskLevel: "CAUTION", safetyConfirmed: true,
    currentStep: guide.steps[0], currentStepId: guide.steps[0].step_id
  });
  await session.save();
  const result = await call(controller.guidanceAction, { action: "still_not_fixed", stepId: "step_1" }, String(session._id));
  assert.equal(result.error, undefined);
  assert.equal(result.body.currentStep.step_id, "step_2");
  assert.match(result.body.currentStep.instruction, /visible leak/);
});

test("missing OpenAI or invalid AI output leaves a usable professional-help result", async () => {
  const client = { responses: { create: async () => { throw new Error("Offline"); } } };
  const result = await originals.help({ category: "electrical_system_fault", problem: "Display message" }, { client, model: "test-model" });
  assert.equal(result.available, false);
  assert.equal(result.professionalHelp, true);
  assert.deepEqual(result.steps, []);
});

test("a local guide with unresolved placeholder instructions uses the controlled fallback", async (t) => {
  t.mock.method(ai2, "findGuide", async () => ({ guide_available: true, guide: {
    guide_id: "incomplete_guide", title: "Display Safety Guide", risk_level: "LOW",
    steps: [{ step_id: "step_1", instruction: "Inspect the named area." }]
  } }));
  const previous = helpCalls;
  const result = await call(controller.startSelfAssistant, {
    driverType: "technical", vehicleType: "car", breakdownType: "electrical_problem",
    diagnosticInputText: "An unfamiliar display message appeared."
  });
  assert.equal(result.error, undefined);
  assert.equal(helpCalls, previous + 1);
  assert.equal(result.body.session.troubleshootingSource, "OPENAI");
});

test("legacy chat endpoints cannot bypass new guided-session controls", async () => {
  const session = await activeBattery();
  for (const handler of [controller.confirmStepAction, controller.submitStep, controller.sendMessage]) {
    const result = await call(handler, { stepId: session.currentStepId, selectedResult: "clean_terminals", message: "resolved" }, session._id);
    assert.equal(result.code, 409);
  }
});

test("mechanic handoff preserves the saved diagnosis and service without reclassifying symptoms", async (t) => {
  const session = await activeBattery();
  const previous = modelCalls;
  let request;
  t.mock.method(BreakdownRequest, "create", async (payload) => {
    request = new BreakdownRequest(payload);
    assert.equal(request.validateSync(), undefined);
    return request;
  });
  const result = await call(createBreakdownRequest, {
    troubleshootingSessionId: session._id, vehicleType: "car", breakdownType: "other",
    urgencyLevel: "medium", location: { latitude: 6.9, longitude: 79.8 },
    diagnosticInputText: batteryInput.diagnosticInputText
  });
  assert.equal(result.error, undefined);
  assert.equal(result.code, 201);
  assert.equal(modelCalls, previous);
  assert.equal(request.aiPrediction.predictedFault, "electrical_system_fault");
  assert.equal(request.requiredServiceType, "battery_electrical_mechanic");
  assert.equal(String((await Session.findById(session._id)).breakdownRequestId), String(request._id));
});

test("ownership, inactive sessions and stale step submissions are rejected", async () => {
  const session = await batterySession();
  const other = await call(controller.askForHelp, { question: "Explain" }, session._id, new mongoose.Types.ObjectId());
  assert.equal(other.code, 403);
  const early = await call(controller.guidanceAction, { action: "solved" }, session._id);
  assert.equal(early.code, 409);
  await call(controller.confirmSafety, {}, session._id);
  const stale = await call(controller.guidanceAction, { action: "solved", stepId: "wrong_step" }, session._id);
  assert.equal(stale.code, 409);
});

test("OpenAI uses controlled structured output and supplied step context", async () => {
  let payload;
  const result = await originals.help({ mode: "explain", category: "electrical_system_fault", problem: "Battery connection issue", currentStep: "Inspect visible terminals without touching.", question: "How do I check them?" }, {
    model: "configured-test-model", client: { responses: { create: async (value) => {
      payload = value;
      return { output_text: JSON.stringify({ professionalHelp: false, risk: "CAUTION", steps: [], explanation: "Look for a crusty deposit without touching anything." }) };
    } } }
  });
  assert.equal(result.professionalHelp, false);
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.strict, true);
  assert.equal(JSON.parse(payload.input).currentStep, "Inspect visible terminals without touching.");
  assert.equal(payload.tools, undefined);
});

test("OpenAI selects only the applicable fixed driver self-fix pack", async () => {
  const cases = [
    ["electrical_system_fault", "Weak 12V battery", "Clicking and dim lights; still not fixed", "retry_start_with_low_load"],
    ["wheel_tire_fault", "Tyre pressure problem", "Local check result: Low pressure. No visible damage, puncture or leak.", "adjust_tire_pressure"],
    ["visibility_system_fault", "Windshield washer fluid", "Local check result: Low fluid level", "refill_washer_fluid"],
    ["air_conditioning_fault", "Cabin Air Filter", "Debris blocks the cabin air filter", "replace_cabin_filter"],
    ["electrical_system_fault", "Horn fuse", "Horn is not working; fuse is blown", "replace_owner_serviceable_fuse"],
    ["engine_system_fault", "Air Filter", "Engine air filter is dirty", "replace_engine_air_filter"]
  ];
  for (const [category, problem, symptoms, actionId] of cases) {
    let payload;
    const result = await originals.help({ mode: "fallback", category, problem,
      vehicleType: "car", symptoms }, { model: "configured-test-model",
      client: { responses: { create: async (value) => {
        payload = value;
        return { output_text: JSON.stringify({ professionalHelp: false, actionIds: [actionId] }) };
      } } } });
    assert.equal(result.professionalHelp, false, actionId);
    assert.ok(result.steps.length >= 3, actionId);
    assert.deepEqual(payload.text.format.schema.properties.actionIds.items.enum, [actionId]);
    assert.equal(payload.text.format.strict, true);
    assert.equal(payload.store, false);
  }
});

test("self-fix selector rejects an action outside the context-specific allowlist", async () => {
  const result = await originals.help({
    mode: "fallback", category: "wheel_tire_fault", problem: "Tyre pressure problem",
    vehicleType: "car", symptoms: "Local check result: Low pressure"
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: false, actionIds: ["replace_engine_air_filter"] })
  }) } } });
  assert.equal(result.professionalHelp, true);
  assert.deepEqual(result.steps, []);
});

test("a conservative model refusal cannot hide a uniquely approved battery action", async () => {
  const result = await originals.help({
    mode: "fallback", category: "electrical_system_fault",
    problem: "Electrical / Starting System Problem", vehicleType: "car",
    symptoms: "Vehicle will not start. Clicking sound. Dashboard lights are weak. No smoke or burning smell. The terminals look clean. The problem is still not fixed."
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: true, actionIds: [] })
  }) } } });
  assert.equal(result.professionalHelp, false);
  assert.equal(result.risk, "LOW");
  assert.match(result.steps.join(" "), /Switch off lights/i);
});

test("a conservative model refusal cannot hide a uniquely approved engine air-filter action", async () => {
  const result = await originals.help({
    mode: "fallback", category: "engine_system_fault", problem: "Air Filter",
    vehicleType: "car", symptoms: "The engine air filter is dirty and blocked. The handbook says it is owner-serviceable. There is no smoke, overheating, or fluid leak."
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: true, actionIds: [] })
  }) } } });
  assert.equal(result.professionalHelp, false);
  assert.match(result.steps.join(" "), /correct replacement/i);
});

test("a conservative model refusal cannot hide a uniquely approved washer-fluid refill", async () => {
  const result = await originals.help({
    mode: "fallback", category: "visibility_system_fault",
    problem: "Windshield Washer Fluid", vehicleType: "car",
    symptoms: "No washer spray. Local check result: Low fluid level. There is no visible leak."
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: true, actionIds: [] })
  }) } } });
  assert.equal(result.professionalHelp, false);
  assert.match(result.steps.join(" "), /washer fluid/i);
});

test("a conservative model refusal cannot hide a uniquely approved cabin-filter action", async () => {
  const result = await originals.help({
    mode: "fallback", category: "air_conditioning_fault",
    problem: "Cabin Air Filter", vehicleType: "car",
    symptoms: "Weak airflow. The cabin air filter is dirty and clogged. Local check result: Debris in intake. No burning smell."
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: true, actionIds: [] })
  }) } } });
  assert.equal(result.professionalHelp, false);
  assert.match(result.steps.join(" "), /airflow direction/i);
});

test("a confirmed low coolant level with no leak receives the reviewed cold-engine top-up", async () => {
  const result = await originals.help({
    mode: "fallback", category: "cooling_system_fault", problem: "Coolant Reservoir",
    vehicleType: "car",
    symptoms: "The temperature meter reached the red. The coolant level is low. Local check result: No visible leaks. The engine is now completely cold."
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: true, actionIds: [] })
  }) } } });
  assert.equal(result.professionalHelp, false);
  assert.equal(result.risk, "CAUTION");
  assert.match(result.steps.join(" "), /specified premixed coolant/i);
  assert.match(result.steps.join(" "), /never remove.*cap.*hot/i);
});

test("low coolant with a visible leak cannot use the coolant top-up action", async () => {
  let calls = 0;
  const result = await originals.help({
    mode: "fallback", category: "cooling_system_fault", problem: "Coolant Reservoir",
    vehicleType: "car", symptoms: "The coolant level is low and there is a visible leak."
  }, { model: "configured-test-model", client: { responses: { create: async () => {
    calls += 1;
    return { output_text: "{}" };
  } } } });
  assert.equal(result.professionalHelp, true);
  assert.equal(calls, 0);
});

test("dangerous problems let OpenAI select only backend-approved safety actions", async () => {
  let payload;
  const result = await originals.safetyHelp({
    danger: { id: "smoke_or_fire", emergency: true }, vehicleType: "car",
    symptoms: "Smoke is coming from the engine."
  }, { model: "configured-test-model", client: { responses: { create: async (value) => {
    payload = value;
    return { output_text: JSON.stringify({ actionIds: ["leave_vehicle", "emergency_services"] }) };
  } } } });
  assert.equal(result.source, "OPENAI");
  assert.equal(result.professionalHelp, true);
  assert.ok(result.actions.some((action) => /leave the vehicle/i.test(action)));
  assert.ok(result.actions.some((action) => /emergency services/i.test(action)));
  assert.ok(result.actions.some((action) => /mechanic|recovery/i.test(action)));
  assert.match(result.actions[0], /switch.*off/i);
  assert.match(result.actions.at(-1), /mechanic|recovery/i);
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.strict, true);
  assert.deepEqual(payload.text.format.schema.properties.actionIds.items.enum, [
    "switch_off", "hazards", "leave_vehicle", "avoid_traffic", "do_not_restart",
    "do_not_touch", "emergency_services", "professional_help"
  ]);
  assert.equal(payload.tools, undefined);
});

test("technical overheating displays validated human-friendly steps written by OpenAI", async () => {
  let payload;
  const generatedActions = [
    "Park safely, apply the parking brake, and switch the engine off.",
    "Wait until the engine is completely cold before checking anything.",
    "Never remove the radiator or coolant-reservoir cap while the system is hot.",
    "After it is completely cold, use the owner's manual to identify the reservoir and visually inspect the reservoir, hoses, radiator area and ground for visible leaks while staying clear of the cooling fan.",
    "Only if there is no visible leak, the reservoir is not empty, and the owner's manual permits it, add the specified premixed coolant through the reservoir to the marked level.",
    "Do not drive if coolant is leaking, the reservoir is empty, a belt is damaged, or the warning returns; request a mechanic or vehicle recovery."
  ];
  const result = await originals.safetyHelp({
    danger: { id: "overheating", emergency: false }, driverType: "technical",
    vehicleType: "car", symptoms: "The temperature gauge is in the red."
  }, { model: "configured-test-model", client: { responses: { create: async (value) => {
    payload = value;
    return { output_text: JSON.stringify({ professionalHelp: true, actions: generatedActions }) };
  } } } });
  assert.equal(result.source, "OPENAI");
  assert.deepEqual(result.actions, generatedActions);
  assert.equal(payload.text.format.name, "technical_overheat_guidance");
  assert.equal(payload.text.format.strict, true);
  assert.equal(payload.store, false);
});

test("unsafe technical overheating output is replaced with fixed safety guidance", async () => {
  const result = await originals.safetyHelp({
    danger: { id: "overheating", emergency: false }, driverType: "technical",
    vehicleType: "car", symptoms: "The temperature gauge is in the red."
  }, { model: "configured-test-model", client: { responses: { create: async () => ({
    output_text: JSON.stringify({ professionalHelp: true, actions: [
      "Switch the engine off.",
      "Wait until it is completely cold.",
      "Open the radiator cap while it is hot.",
      "Use the owner's manual and visually inspect for a visible leak.",
      "Only if there is no visible leak and the manual permits it, add the specified coolant.",
      "Request vehicle recovery."
    ] })
  }) } } });
  assert.equal(result.source, "SAFETY_RULES");
  assert.ok(result.actions.some((action) => /Never remove a radiator/i.test(action)));
  assert.doesNotMatch(result.actions.join(" "), /Open the radiator cap while it is hot/i);
});

test("invalid or unavailable safety AI uses fixed backend emergency actions", async () => {
  for (const create of [
    async () => ({ output_text: JSON.stringify({ actionIds: ["repair_engine"] }) }),
    async () => { throw new Error("Offline"); }
  ]) {
    const result = await originals.safetyHelp({
      danger: { id: "smoke_or_fire", emergency: true }, vehicleType: "car", symptoms: "Smoke"
    }, { model: "test-model", client: { responses: { create } } });
    assert.equal(result.source, "SAFETY_RULES");
    assert.equal(result.professionalHelp, true);
    assert.ok(result.actions.some((action) => /leave the vehicle/i.test(action)));
    assert.ok(result.actions.some((action) => /emergency services/i.test(action)));
    assert.doesNotMatch(result.actions.join(" "), /repair engine/i);
  }
});

test("generated dangerous, malformed or empty repair guidance is rejected", () => {
  for (const instruction of ["Disconnect the battery cables.", "Open the hot radiator cap.", "Repair the brakes.", "Jack up the vehicle.", "Pour oil into the engine."]) {
    assert.equal(aiHelp.validateHelp({ professionalHelp: false, risk: "LOW", steps: [instruction], explanation: "" }, "fallback").professionalHelp, true);
  }
  assert.equal(aiHelp.validateHelp({ steps: [] }, "fallback").professionalHelp, true);
  assert.equal(aiHelp.validateHelp({ professionalHelp: false, risk: "LOW", steps: [], explanation: "" }, "fallback").professionalHelp, true);
});

test("high risk problems never reach the OpenAI client", async () => {
  const result = await originals.help({ category: "brake_system_fault", question: "How do I fix the brakes?" }, {
    client: { responses: { create() { throw new Error("Must not call OpenAI"); } } }
  });
  assert.equal(result.professionalHelp, true);
  assert.equal(result.reason, "This problem needs professional assistance.");
});

test("the actual saved AI 1 model classifies battery symptoms after absent hazards are removed", () => {
  const modelInput = buildModelInput(batteryInput.diagnosticInputText);
  assert.doesNotMatch(modelInput, /fuel smell|smoke/i);
  assert.match(modelInput, /will not start/i);
  assert.equal(buildModelInput("The tyre is flat"), "The tire is flat");
  const result = pythonCall(`import sys,json
from services.ai1_prediction_service import predict_fault
print(json.dumps(predict_fault(json.load(sys.stdin))))`, modelInput);
  assert.equal(result.predicted_fault, "electrical_system_fault");
});
