const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

const mobileRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(mobileRoot, "src");
const defaultLoader = require.extensions[".js"];
require.extensions[".js"] = function compileMobileSource(module, filename) {
  if (!filename.startsWith(sourceRoot)) return defaultLoader(module, filename);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = babel.transformSync(source, {
    filename,
    presets: [["babel-preset-expo", { disableImportExportTransform: false }]]
  });
  return module._compile(compiled.code, filename);
};

const {
  appendSelfAssistantClarification,
  buildSelfAssistantMechanicPrefill,
  buildSelfAssistantPayload,
  resolveSelfAssistantRecommendation,
  routeSelfAssistantResponse,
  selfAssistantClarificationQuestions
} = require("../src/utils/selfAssistantFlow");
const {
  buildStructuredSymptomPayload,
  buildSymptomDescription,
  getQuestionsForProblem,
  mapRequestTypeToSymptomType,
  mapSymptomTypeToRequestType
} = require("../src/services/symptomCaptureService");
const { SYMPTOM_BREAKDOWN_TYPES } = require("../src/data/symptomQuestionFlows");
const { BREAKDOWN_TYPES } = require("../src/utils/constants");

const exactSymptoms = {
  vehicleType: "car",
  breakdownType: "vehicle_not_starting",
  symptoms: {
    starting_behavior: "engine_tries_to_start",
    light_condition: "normal",
    other_signs: ["strange_sound"]
  },
  observedSymptoms: { see: [], hear: ["clicking"], smell: [], feel: [] },
  description: ""
};

const engineProblemSymptoms = {
  vehicleType: "car",
  breakdownType: "engine_problem",
  symptoms: {
    engine_signs: [
      "loss_of_power",
      "engine_shaking",
      "engine_stalls",
      "knocking_sound",
      "warning_light",
      "hard_to_start",
      "smoke"
    ],
    engine_problem_timing: "during_acceleration"
  },
  observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
  description: ""
};

function navigationRecorder() {
  const calls = [];
  return {
    calls,
    navigate(name, params) { calls.push({ method: "navigate", name, params }); },
    replace(name, params) { calls.push({ method: "replace", name, params }); },
    reset(state) { calls.push({ method: "reset", state }); }
  };
}

test("preserves the complete structured symptom payload", () => {
  const payload = buildSelfAssistantPayload(exactSymptoms);
  assert.equal(payload.vehicleType, "car");
  assert.equal(payload.breakdownType, "vehicle_not_starting");
  assert.deepEqual(payload.symptomCapture.symptoms, exactSymptoms.symptoms);
  assert.deepEqual(payload.symptomCapture.observedSymptoms, exactSymptoms.observedSymptoms);
  assert.equal(payload.symptomCapture.guidedCaptureUsed, true);
  assert.match(payload.diagnosticInputText, /Engine tries to start/i);
  assert.match(payload.diagnosticInputText, /HEAR - Clicking/i);
});

test("engine problem remains separate from overheating in both main problem selectors", () => {
  for (const options of [SYMPTOM_BREAKDOWN_TYPES, BREAKDOWN_TYPES]) {
    assert.ok(options.some((option) => option.value === "engine_problem"));
    assert.ok(options.some((option) => option.value === "engine_overheating"));
  }
  assert.equal(mapSymptomTypeToRequestType("engine_problem"), "engine_problem");
});

test("main problem selectors expose the requested stable values in display order", () => {
  const expected = [
    "vehicle_not_starting",
    "engine_problem",
    "engine_overheating",
    "flat_tyre",
    "brake_problem",
    "electrical_problem",
    "fuel_problem",
    "steering_problem",
    "transmission_problem",
    "strange_noise",
    "other"
  ];
  assert.deepEqual(BREAKDOWN_TYPES.map(({ value }) => value), expected);
  assert.deepEqual(SYMPTOM_BREAKDOWN_TYPES.map(({ value }) => value), expected);
});

test("new mobile problem values map to existing request API categories", () => {
  assert.equal(mapSymptomTypeToRequestType("vehicle_not_starting"), "battery_issue");
  assert.equal(mapSymptomTypeToRequestType("electrical_problem"), "battery_issue");
  assert.equal(mapSymptomTypeToRequestType("fuel_problem"), "fuel_issue");
  assert.equal(mapSymptomTypeToRequestType("steering_problem"), "other");
  assert.equal(mapSymptomTypeToRequestType("transmission_problem"), "other");
  assert.equal(mapSymptomTypeToRequestType("strange_noise"), "other");
  assert.equal(mapRequestTypeToSymptomType("battery_issue"), "vehicle_not_starting");
  assert.equal(mapRequestTypeToSymptomType("fuel_issue"), "fuel_problem");
});

test("both problem selectors use the shared responsive accessible grid", () => {
  const grid = fs.readFileSync(path.join(sourceRoot, "components/symptom/MainProblemGrid.js"), "utf8");
  const requestScreen = fs.readFileSync(path.join(sourceRoot, "screens/driver/RequestMechanicScreen.js"), "utf8");
  const selfScreen = fs.readFileSync(path.join(sourceRoot, "screens/driver/SelfBreakdownAssistantScreen.js"), "utf8");

  assert.match(grid, /flexDirection: "row"/);
  assert.match(grid, /flexWrap: "wrap"/);
  assert.match(grid, /justifyContent: "space-between"/);
  assert.match(grid, /width: "48%"/);
  assert.match(grid, /minHeight: 108/);
  assert.match(grid, /numberOfLines=\{2\}/);
  assert.match(grid, /accessibilityRole="radio"/);
  assert.match(grid, /accessibilityLabel=\{option\.label\}/);
  assert.match(requestScreen, /<MainProblemGrid options=\{BREAKDOWN_TYPES\}/);
  assert.match(selfScreen, /<MainProblemGrid options=\{SYMPTOM_BREAKDOWN_TYPES\}/);
});

test("engine problem guided capture includes every requested symptom and timing choice", () => {
  const questions = getQuestionsForProblem("engine_problem");
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[0].options.map(({ value }) => value), [
    "loss_of_power",
    "engine_shaking",
    "engine_stalls",
    "knocking_sound",
    "warning_light",
    "hard_to_start",
    "smoke",
    "not_sure"
  ]);
  assert.deepEqual(questions[1].options.map(({ value }) => value), [
    "when_starting",
    "while_idling",
    "while_driving",
    "during_acceleration",
    "all_the_time",
    "not_sure"
  ]);
});

test("engine problem structured payload and diagnostic text preserve guided answers", () => {
  const structured = buildStructuredSymptomPayload(engineProblemSymptoms);
  const diagnosticInputText = buildSymptomDescription(structured);

  assert.equal(structured.breakdownType, "engine_problem");
  assert.deepEqual(structured.symptoms, engineProblemSymptoms.symptoms);
  assert.match(diagnosticInputText, /Guided symptoms - Engine Problem/);
  assert.match(diagnosticInputText, /Loss of power/);
  assert.match(diagnosticInputText, /Engine shaking/);
  assert.match(diagnosticInputText, /Engine stalls/);
  assert.match(diagnosticInputText, /Knocking sound/);
  assert.match(diagnosticInputText, /Warning light/);
  assert.match(diagnosticInputText, /Hard to start/);
  assert.match(diagnosticInputText, /Smoke/);
  assert.match(diagnosticInputText, /When it happens: During acceleration/);
});

test("low confidence opens clarification in self-assistant mode", () => {
  const navigation = navigationRecorder();
  const payload = buildSelfAssistantPayload(exactSymptoms);
  routeSelfAssistantResponse(navigation, {
    status: "more_information_required",
    aiPrediction: { confidenceLevel: "low", needsMoreInformation: true }
  }, payload, { replace: true });
  assert.equal(navigation.calls[0].name, "AIClarification");
  assert.equal(navigation.calls[0].params.selfAssistantMode, true);
  assert.deepEqual(navigation.calls[0].params.symptomCapture, payload.symptomCapture);
});

for (const [status, expectedScreen] of [
  ["ready_to_start", "TroubleshootingConversation"],
  ["awaiting_safety_confirmation", "SelfAssistantSafety"],
  ["professional_help_required", "SelfAssistantResult"],
  ["troubleshooting_unavailable", "SelfAssistantResult"]
]) {
  test(`${status} routes directly to ${expectedScreen}`, () => {
    const navigation = navigationRecorder();
    const payload = buildSelfAssistantPayload(exactSymptoms);
    routeSelfAssistantResponse(navigation, {
      status,
      session: { _id: "session-1", recommendedService: "general_mechanic" },
      currentStep: status === "ready_to_start" ? { step_id: "step-1" } : undefined,
      riskLevel: status === "awaiting_safety_confirmation" ? "CAUTION" : undefined,
      safetyWarning: "Park safely",
      beforeYouBegin: ["Apply the parking brake"]
    }, payload, { replace: true });
    assert.equal(navigation.calls.length, 1);
    assert.equal(navigation.calls[0].method, "replace");
    assert.equal(navigation.calls[0].name, expectedScreen);
    assert.equal(navigation.calls[0].params.sessionId, "session-1");
  });
}

test("clarification answers are appended without losing symptom capture", () => {
  const payload = buildSelfAssistantPayload(exactSymptoms);
  const questions = [{ id: "timing", question: "When did it begin?", options: ["Suddenly"] }];
  const updated = appendSelfAssistantClarification(payload, questions, { timing: "Suddenly" });
  assert.deepEqual(updated.symptomCapture, payload.symptomCapture);
  assert.match(updated.diagnosticInputText, /When did it begin\?: Suddenly/);
  assert.deepEqual(updated.clarificationAnswers, [{
    questionId: "timing",
    question: "When did it begin?",
    answer: "Suddenly"
  }]);
});

test("the single clarification round contains no more than two questions", () => {
  const payload = buildSelfAssistantPayload(exactSymptoms);
  assert.equal(selfAssistantClarificationQuestions(payload).length, 2);
});

test("post-clarification recommendation prefers normalized AI service and fault label", () => {
  const payload = buildSelfAssistantPayload(exactSymptoms);
  const recommendation = resolveSelfAssistantRecommendation({
    status: "more_information_required",
    aiPrediction: {
      predictedFault: "electrical_system_fault",
      faultLabel: "Electrical / Starting System Problem",
      requiredService: "battery_electrical_mechanic",
      needsMoreInformation: true
    }
  }, payload);
  assert.equal(recommendation.faultLabel, "Electrical / Starting System Problem");
  assert.equal(recommendation.requiredService, "battery_electrical_mechanic");
  assert.equal(recommendation.fallbackUsed, false);
});

test("post-clarification recommendation accepts legacy service fields and safely falls back", () => {
  assert.equal(resolveSelfAssistantRecommendation({
    aiPrediction: { required_service: "brake_mechanic" }
  }).requiredService, "brake_mechanic");
  assert.equal(resolveSelfAssistantRecommendation({
    requiredServiceType: "engine_mechanic"
  }).requiredService, "engine_mechanic");
  const fallback = resolveSelfAssistantRecommendation({ aiPrediction: {} });
  assert.equal(fallback.requiredService, "general_mechanic");
  assert.equal(fallback.fallbackUsed, true);
});

test("request mechanic prefill preserves symptoms, diagnosis text, fault, and service", () => {
  const payload = buildSelfAssistantPayload(exactSymptoms);
  const response = {
    status: "more_information_required",
    aiPrediction: {
      predictedFault: "electrical_system_fault",
      faultLabel: "Electrical / Starting System Problem",
      requiredService: "battery_electrical_mechanic"
    }
  };
  const prefill = buildSelfAssistantMechanicPrefill(payload, response);
  assert.equal(prefill.vehicleType, payload.vehicleType);
  assert.equal(prefill.breakdownType, "battery_issue");
  assert.deepEqual(prefill.symptomCapture, payload.symptomCapture);
  assert.equal(prefill.diagnosticInputText, payload.diagnosticInputText);
  assert.equal(prefill.predictedFault, "electrical_system_fault");
  assert.equal(prefill.requiredService, "battery_electrical_mechanic");
  assert.equal(prefill.requiredServiceType, "battery_electrical_mechanic");
});

test("completed capture can reset away the guided screens without a loop", () => {
  const navigation = navigationRecorder();
  const payload = buildSelfAssistantPayload(exactSymptoms);
  routeSelfAssistantResponse(navigation, {
    status: "ready_to_start",
    session: { _id: "session-1" },
    currentStep: { step_id: "step-1" }
  }, payload, { resetFlow: true });
  assert.equal(navigation.calls[0].method, "reset");
  assert.deepEqual(navigation.calls[0].state.routes.map((route) => route.name), [
    "DriverHome",
    "TroubleshootingConversation"
  ]);
});

test("summary keeps mechanic flow separate and guards self-assistant double taps", () => {
  const source = fs.readFileSync(path.join(sourceRoot, "screens/driver/SymptomSummaryScreen.js"), "utf8");
  assert.match(source, /if \(!selfAssistantSource\)/);
  assert.match(source, /navigation\.popTo\(sourceRoute, \{ guidedSymptoms: structuredSymptoms \}\)/);
  assert.match(source, /if \(processingRef\.current\) return/);
  assert.match(source, /startSelfAssistant\(payload\)/);
});

test("self-assistant clarification reruns the start endpoint", () => {
  const source = fs.readFileSync(path.join(sourceRoot, "screens/driver/AIClarificationScreen.js"), "utf8");
  assert.match(source, /const MAX_ATTEMPTS = 1/);
  assert.match(source, /selfAssistantMode/);
  assert.match(source, /appendSelfAssistantClarification/);
  assert.match(source, /startSelfAssistant\(updatedPayload\)/);
  assert.match(source, /routeSelfAssistantResponse/);
  assert.doesNotMatch(source, /Answer One More Question/);
  assert.doesNotMatch(source, /selfAssistantClarificationQuestions\(updatedPayload/);
  assert.match(source, /We still don't have enough information to safely start self-troubleshooting\./);
  assert.match(source, /title="Add More Symptoms"/);
  assert.match(source, /title="Request Mechanic Instead"/);
});

test("request mechanic submits the carried post-clarification service", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/RequestMechanicScreen.js"), "utf8");
  const service = fs.readFileSync(path.join(sourceRoot, "services/requestService.js"), "utf8");
  assert.match(screen, /requiredService: prefill\.requiredService \|\| prefill\.requiredServiceType/);
  assert.match(screen, /diagnosticInputText: prefill\.diagnosticInputText/);
  assert.match(screen, /symptomCapture: prefill\.symptomCapture/);
  assert.match(service, /requiredService: payload\.requiredService/);
  assert.match(service, /predictedFault: payload\.predictedFault/);
});

test("AI 2 conversation enforces instruction then confirmation then result", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/TroubleshootingConversationScreen.js"), "utf8");
  const service = fs.readFileSync(path.join(sourceRoot, "services/selfAssistantService.js"), "utf8");
  assert.match(screen, /currentPhase.*"instruction"/s);
  assert.match(screen, /currentPhase === "instruction"/);
  assert.match(screen, /title="Done – I Checked"/);
  assert.match(screen, /confirmTroubleshootingAction\(sessionId, currentStep\.step_id\)/);
  assert.match(screen, /setCurrentPhase\("result"\)/);
  assert.match(screen, /currentPhase === "result"/);
  assert.match(screen, /submitTroubleshootingStep/);
  assert.match(screen, /setCurrentPhase\("processing"\)/);
  assert.match(screen, /setCurrentPhase\("instruction"\)/);
  assert.match(service, /action-confirm/);
});

test("AI 2 conversation preserves all safety and escalation controls", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/TroubleshootingConversationScreen.js"), "utf8");
  assert.match(screen, /title="I Can't Do This"/);
  assert.match(screen, /That's okay\. Do not continue if you are unsure\./);
  assert.match(screen, /value: "not_sure", label: "Not Sure"/);
  assert.match(screen, /I Noticed Something Unsafe/);
  assert.match(screen, /Stop & Request Mechanic/);
  assert.match(screen, /response\.nextStep\.instruction/);
  assert.doesNotMatch(screen, /source_instruction|source record|dataset fields/i);
});

test("completed AI 2 flow asks the driver to confirm real-world resolution", () => {
  const source = fs.readFileSync(path.join(sourceRoot, "screens/driver/SelfAssistantResultScreen.js"), "utf8");
  assert.match(source, /That completes the basic troubleshooting steps\./);
  assert.match(source, /Is the vehicle problem now resolved\?/);
  assert.match(source, /Yes – Problem Resolved/);
  assert.match(source, /No – I Still Need Help/);
  assert.match(source, /riskLevel === "HIGH"/);
});
