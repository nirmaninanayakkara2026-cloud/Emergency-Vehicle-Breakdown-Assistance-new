const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const mongoose = require("mongoose");
const Session = require("../src/models/TroubleshootingSession");
const controller = require("../src/controllers/selfAssistantController");
const ai2 = require("../src/services/ai2TroubleshootingService");
const ai1 = require("../src/services/aiDiagnosisService");
const state = require("../src/services/troubleshootingStateService");
const language = require("../src/services/troubleshootingLanguageService");
const { detectDanger } = require("../src/services/troubleshootingSafetyService");

const aiRoot = path.resolve(__dirname, "../ai");
const venv = path.join(aiRoot, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = process.env.AI_TEST_PYTHON || (fs.existsSync(venv) ? venv : "python");
const bridge = `import json,sys
from ai2.services.troubleshooting_engine import start_troubleshooting,process_step_result,get_guide_for_fault
request=json.load(sys.stdin)
if request['op']=='start': result=start_troubleshooting(*request['args'])
elif request['op']=='step': result=process_step_result(*request['args'])
else:
 guide=get_guide_for_fault(*request['args'])
 result={'guide_available':bool(guide),'guide':dict(guide,guide_id=guide['id']) if guide else None}
if result.get('status')=='in_progress' and request['op']=='step': result['next_step']=result.pop('current_step')
print(json.dumps(dict(result,success=True)))`;

function engine(op, ...args) {
  const result = spawnSync(python, ["-c", bridge], { cwd: aiRoot, input: JSON.stringify({ op, args }), encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

const driverId = new mongoose.Types.ObjectId();
const stored = new Map();
const originals = {};
before(() => {
  originals.save = Session.prototype.save;
  originals.find = Session.findById;
  originals.create = Session.create;
  originals.start = ai2.startGuide;
  originals.step = ai2.processStep;
  originals.guide = ai2.findGuide;
  originals.interpret = language.interpretMessage;
  originals.diagnose = ai1.diagnoseBreakdown;
  Session.prototype.save = async function () {
    const error = this.validateSync();
    if (error) throw error;
    stored.set(String(this._id), this.toObject());
    return this;
  };
  Session.findById = async (id) => stored.has(String(id)) ? new Session(stored.get(String(id))) : null;
  Session.create = async (data) => new Session(data).save();
  ai2.startGuide = async (...args) => engine("start", ...args);
  ai2.processStep = async (...args) => engine("step", ...args);
  ai2.findGuide = async (...args) => engine("find", ...args);
  language.interpretMessage = async () => ({ available: false });
});
after(() => {
  Session.prototype.save = originals.save;
  Session.findById = originals.find;
  Session.create = originals.create;
  ai2.startGuide = originals.start;
  ai2.processStep = originals.step;
  ai2.findGuide = originals.guide;
  language.interpretMessage = originals.interpret;
  ai1.diagnoseBreakdown = originals.diagnose;
});

async function call(handler, id, body = {}, expectCode = 200) {
  let error;
  const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.body = JSON.parse(JSON.stringify(data)); return this; } };
  await handler({ params: { sessionId: id }, user: { _id: driverId }, body }, res, (value) => { error = value; });
  assert.equal(res.code, expectCode, error?.stack);
  if (expectCode < 400) assert.equal(error, undefined, error?.stack);
  return res.body;
}

async function begin(guideId) {
  const step = engine("start", guideId, true).current_step;
  const session = new Session({ driverId, vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "Car won't start; clicking sound", predictedFault: { fault: "electrical_system_fault" }, guideId, riskLevel: guideId === "ai2_aktc_0036" ? "CAUTION" : "LOW", status: "in_progress", safetyConfirmed: true, currentStep: step, currentStepId: step.step_id });
  state.record(session, "assistant", step.instruction);
  await session.save();
  return String(session._id);
}
async function message(id, body) {
  const session = await Session.findById(id);
  return call(controller.sendMessage, id, { expectedState: state.stateOf(session), stepId: session.currentStepId, ...body });
}
async function answer(id, selectedResult) {
  const session = await Session.findById(id);
  await call(controller.confirmStepAction, id, { stepId: session.currentStepId });
  return call(controller.submitStep, id, { stepId: session.currentStepId, selectedResult });
}

test("battery observation -> explicit resolution -> persisted success with no mechanic", async () => {
  ai1.diagnoseBreakdown = async () => ({ predictedFault: "electrical_system_fault", faultLabel: "Electrical / Starting System Problem", requiredService: "battery_electrical_mechanic", confidence: 0.91, confidenceLevel: "high", predictionMargin: 0.7, needsMoreInformation: false, topPredictions: [] });
  const start = await call(controller.startSelfAssistant, null, { vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "Car won't start, clicking sound and dim lights" }, 201);
  assert.equal(start.status, "awaiting_safety_confirmation");
  assert.equal(start.session.guideId, "ai2_aktc_0036");
  const id = start.session._id;
  await call(controller.confirmSafety, id);
  const check = await answer(id, "clean_terminals");
  assert.equal(check.state, "CHECKING_RESOLUTION");
  assert.equal(check.resolved, false);
  const result = await message(id, { message: "Yes, it started" });
  assert.equal(result.state, "RESOLVED");
  assert.equal(result.recommendedService, null);
  assert.equal(result.escalate, false);
  assert.equal((await Session.findById(id)).status, "resolved");
});

test("unresolved normal check continues to another approved check without repeating; exhaustion escalates", async () => {
  const id = await begin("ai2_aktc_0091");
  await answer(id, "sufficient_fluid_level");
  const next = await message(id, { message: "No, still not working" });
  assert.equal(next.state, "TROUBLESHOOTING");
  assert.equal(next.currentStep.step_id, "step_2");
  assert.equal(next.session.completedSteps.length, 1);
  await answer(id, "pump_operates_correctly");
  const result = await message(id, { selectedResult: "unresolved" });
  assert.equal(result.state, "ESCALATED");
  assert.equal(result.escalationReason, "approved_steps_exhausted");
  assert.deepEqual(result.session.completedSteps.map((item) => item.stepId), ["step_1", "step_2"]);
  const instructions = result.session.messages.filter((item) => item.role === "assistant" && item.content.includes("recall whether washer"));
  assert.equal(instructions.length, 1);
});

test("smoke during instruction phase stops before model access or action confirmation", async () => {
  const id = await begin("ai2_aktc_0036");
  let calls = 0;
  language.interpretMessage = async () => { calls++; return { available: false }; };
  const result = await message(id, { message: "There is smoke coming from the battery" });
  assert.equal(result.state, "ESCALATED");
  assert.equal(result.currentStep, null);
  assert.match(result.message, /emergency services/);
  assert.equal(calls, 0);
  await call(controller.setResult, id, { resolved: true }, 409);
});

test("not sure clarifies twice without completing or repeating a physical check", async () => {
  const id = await begin("ai2_aktc_0098");
  const result = await answer(id, "not_sure");
  assert.equal(result.state, "CLARIFICATION");
  assert.equal(result.session.completedSteps.length, 0);
  assert.match(result.message, /gauge reading/);
  assert.equal((await message(id, { message: "Not sure" })).escalate, false);
  const end = await message(id, { message: "Not sure" });
  assert.equal(end.escalationReason, "insufficient_approved_information");
});

test("continued uncertainty uses an explicitly approved independent washer observation", async () => {
  const id = await begin("ai2_aktc_0091");
  await answer(id, "not_sure");
  const alternative = await message(id, { message: "Not sure" });
  assert.equal(alternative.state, "TROUBLESHOOTING");
  assert.equal(alternative.currentStep.step_id, "step_2");
  assert.equal(alternative.session.completedSteps[0].selectedResult, "not_sure");
  assert.equal(alternative.escalate, false);
});

test("danger in structured symptoms is checked even when supplied summary omits it", async () => {
  const result = await call(controller.startSelfAssistant, null, {
    vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "Car won't start",
    symptomCapture: { observedSymptoms: { see: ["smoke"] } }
  }, 201);
  assert.equal(result.state, "ESCALATED");
});

test("stale chat requests are rejected and saved history restores the current question", async () => {
  const id = await begin("ai2_aktc_0091");
  await answer(id, "sufficient_fluid_level");
  await message(id, { selectedResult: "unresolved" });
  await call(controller.sendMessage, id, { message: "correct", stepId: "step_1", expectedState: "VERIFYING_ACTION" }, 409);
  const restored = await call(controller.getSession, id);
  assert.equal(restored.session.currentStepId, "step_2");
  assert.ok(restored.session.messages.some((item) => item.content.includes("original" ) || item.content.includes("washer problem")));
});

test("actual symptom matching picks TPMS instead of wheel bearing; bearing symptoms remain high risk", () => {
  const tpms = engine("find", "wheel_tire_fault", "TPMS tyre pressure warning", "flat_tyre");
  assert.equal(tpms.guide.guide_id, "ai2_aktc_0098");
  const bearing = engine("find", "wheel_tire_fault", "Grinding wheel bearing noise", "flat_tyre");
  assert.equal(bearing.guide.risk_level, "HIGH");
});

test("model interpretation cannot advance until driver confirms; invented instructions never appear", async () => {
  const id = await begin("ai2_aktc_0036");
  await call(controller.confirmStepAction, id, { stepId: "step_1" });
  language.interpretMessage = async () => ({ available: true, intent: "answer", selectedResult: "clean_terminals", instruction: "Disconnect the battery", state: "RESOLVED" });
  const proposed = await message(id, { message: "They look shiny without any deposits" });
  assert.equal(proposed.session.completedSteps.length, 0);
  assert.equal(proposed.pendingInterpretation, "clean_terminals");
  assert.doesNotMatch(proposed.message, /disconnect/i);
  const confirmed = await message(id, { selectedResult: "confirm_interpretation" });
  assert.equal(confirmed.state, "CHECKING_RESOLUTION");
  language.interpretMessage = async () => ({ available: false });
});

test("possible model-reported danger holds all resolution paths pending explicit clarification", async () => {
  const id = await begin("ai2_aktc_0036");
  await answer(id, "clean_terminals");
  language.interpretMessage = async () => ({ available: true, intent: "possible_danger", evidence: "strange" });
  const held = await message(id, { message: "Something strange is happening" });
  assert.equal(held.pendingInterpretation, "danger_confirmation");
  await call(controller.setResult, id, { resolved: true }, 409);
  const result = await message(id, { selectedResult: "danger_yes" });
  assert.equal(result.escalationReason, "driver_confirmed_danger");
  language.interpretMessage = async () => ({ available: false });
});

test("corroded terminals preserve escalation; source labels never become cleaning instructions", async () => {
  const id = await begin("ai2_aktc_0036");
  const result = await answer(id, "corroded_terminals");
  assert.equal(result.state, "ESCALATED");
  assert.match(result.message, /Do not clean/);
});

test("invalid answer and premature resolution leave state intact", async () => {
  const id = await begin("ai2_aktc_0036");
  await call(controller.setResult, id, { resolved: true }, 409);
  await call(controller.submitStep, id, { stepId: "step_1", selectedResult: "clean_terminals" }, 409);
  await call(controller.confirmStepAction, id, { stepId: "step_1" });
  await call(controller.submitStep, id, { stepId: "step_1", selectedResult: "invented_result" }, 400);
  assert.equal((await Session.findById(id)).completedSteps.length, 0);
});

test("danger on the initial symptom message bypasses classifier even when unavailable", async () => {
  ai1.diagnoseBreakdown = async () => { throw new Error("Must not classify before checking danger"); };
  const result = await call(controller.startSelfAssistant, null, { vehicleType: "car", breakdownType: "vehicle_not_starting", diagnosticInputText: "Battery leaking and smoke" }, 201);
  assert.equal(result.state, "ESCALATED");
  assert.equal(result.currentStep, null);
});

test("shared safety rules handle negation, mixed statements, substring collisions and hazards", () => {
  for (const text of ["No smoke or fire", "engine misfire", "The battery is not leaking", "Correct pressure"]) assert.equal(detectDanger(text), null, text);
  for (const text of ["No smoke but battery leaking", "No smoke and battery is leaking", "Not sure if there is smoke", "Fuel smell", "brakes not working", "steering locked", "temperature gauge in red zone", "I am in moving traffic"]) assert.ok(detectDanger(text), text);
});

test("OpenAI structured interpretation rejects extra instructions, invalid options, and invented evidence", async () => {
  const context = { state: "VERIFYING_ACTION", options: [{ value: "clean", label: "Clean terminals" }], latestMessage: "They look clean", history: [{ role: "user", content: "me@example.com" }], completedSteps: [] };
  for (const bad of [
    { intent: "answer", selectedResult: "clean", evidence: "clean", instruction: "remove parts" },
    { intent: "answer", selectedResult: "resolved", evidence: "clean" },
    { intent: "answer", selectedResult: "clean", evidence: "corrosion" }
  ]) {
    const result = await originals.interpret(context, { model: "test-model", client: { responses: { create: async () => ({ output_text: JSON.stringify(bad) }) } } });
    assert.equal(result.available, false);
  }
  let request;
  const valid = await originals.interpret(context, { model: "test-model", client: { responses: { create: async (data) => { request = data; return { output_text: JSON.stringify({ intent: "answer", selectedResult: "clean", evidence: "clean" }) }; } } } });
  assert.equal(valid.available, true);
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.doesNotMatch(request.input, /me@example.com/);
  const offline = await originals.interpret(context, { model: "test-model", client: { responses: { create: async () => { throw new Error("offline"); } } } });
  assert.equal(offline.available, false);
});
