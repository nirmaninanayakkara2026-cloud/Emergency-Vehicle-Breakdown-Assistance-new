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
  selfAssistantClarificationQuestions,
  conversationState
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

test("main problem values remain intact for structured backend routing", () => {
  assert.equal(mapSymptomTypeToRequestType("vehicle_not_starting"), "vehicle_not_starting");
  assert.equal(mapSymptomTypeToRequestType("electrical_problem"), "electrical_problem");
  assert.equal(mapSymptomTypeToRequestType("fuel_problem"), "fuel_problem");
  assert.equal(mapSymptomTypeToRequestType("steering_problem"), "steering_problem");
  assert.equal(mapSymptomTypeToRequestType("transmission_problem"), "transmission_problem");
  assert.equal(mapSymptomTypeToRequestType("strange_noise"), "strange_noise");
  assert.equal(mapRequestTypeToSymptomType("battery_issue"), "vehicle_not_starting");
  assert.equal(mapRequestTypeToSymptomType("fuel_issue"), "fuel_problem");
});

test("flat tyre capture contains only tyre-specific guided questions", () => {
  const questions = getQuestionsForProblem("flat_tyre");
  assert.deepEqual(questions[0].options.map(({ value }) => value), [
    "front_left", "front_right", "rear_left", "rear_right", "not_sure"
  ]);
  assert.equal(questions[1].type, "multi_choice");
  assert.deepEqual(questions[1].options.map(({ value }) => value), [
    "completely_flat", "low_pressure", "visible_damage", "pulling_side", "not_sure"
  ]);
  assert.equal(questions[2].optional, true);
  assert.deepEqual(questions[2].options.map(({ value }) => value), [
    "puncture_visible", "sidewall_damage", "unusual_vibration", "none", "not_sure"
  ]);
  assert.doesNotMatch(JSON.stringify(questions), /starting_behavior|light_condition|dashboard|battery/i);
});

test("flat tyre diagnostic text contains current tyre answers and no stale starting answers", () => {
  const diagnosticInputText = buildSymptomDescription({
    vehicleType: "car",
    breakdownType: "flat_tyre",
    symptoms: {
      affected_tyre: "front_left",
      tyre_condition: ["completely_flat", "pulling_side"]
    },
    observedSymptoms: { see: [], hear: [], smell: [], feel: [] },
    description: ""
  });
  assert.match(diagnosticInputText, /Guided symptoms - Flat Tyre/);
  assert.match(diagnosticInputText, /Front left/);
  assert.match(diagnosticInputText, /Completely flat/);
  assert.match(diagnosticInputText, /Vehicle pulling to one side/);
  assert.doesNotMatch(diagnosticInputText, /dashboard|clicking|starting behavior/i);
});

test("guided screens reject initial symptom data from a different main problem", () => {
  const guidedScreen = fs.readFileSync(path.join(sourceRoot, "screens/driver/GuidedSymptomCaptureScreen.js"), "utf8");
  const requestScreen = fs.readFileSync(path.join(sourceRoot, "screens/driver/RequestMechanicScreen.js"), "utf8");
  const selfScreen = fs.readFileSync(path.join(sourceRoot, "screens/driver/SelfBreakdownAssistantScreen.js"), "utf8");
  assert.match(guidedScreen, /initialDataMatches/);
  assert.match(requestScreen, /guidedSymptoms\?\.breakdownType === breakdownType/);
  assert.match(selfScreen, /guidedSymptoms\?\.breakdownType === breakdownType/);
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
  assert.match(requestScreen, /<MainProblemGrid\s+options=\{BREAKDOWN_TYPES\}/);
  assert.match(selfScreen, /<MainProblemGrid\s+options=\{getAssistanceProblems\(driverType, vehicleType\)\}/);
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
  ["in_progress", "TroubleshootingConversation"],
  ["awaiting_resolution_confirmation", "TroubleshootingConversation"],
  ["resolved", "SelfAssistantResult"],
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
  assert.equal(prefill.breakdownType, "vehicle_not_starting");
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
  assert.match(source, /We still don't have enough information to safely start\s+self-troubleshooting\./);
  assert.match(source, /title="Add More Symptoms"/);
  assert.match(source, /title="Request Mechanic Instead"/);
});

test("request mechanic submits the carried post-clarification service", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/RequestMechanicScreen.js"), "utf8");
  const service = fs.readFileSync(path.join(sourceRoot, "services/requestService.js"), "utf8");
  assert.match(screen, /requiredService: prefill\.requiredService \|\| prefill\.requiredServiceType/);
  assert.match(screen, /diagnosticInputText:\s+prefill\.diagnosticInputText/);
  assert.match(screen, /symptomCapture:\s+prefill\.symptomCapture/);
  assert.match(service, /requiredService: payload\.requiredService/);
  assert.match(service, /predictedFault: payload\.predictedFault/);
});

test("guided assistance shows instructions and explicit observations without continuous chat", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/TroubleshootingConversationScreen.js"), "utf8");
  assert.match(screen, /step.instruction/);
  assert.match(screen, /submitGuidanceAction/);
  assert.match(screen, /After this check, what did you observe/);
  assert.match(screen, /currentStepIndex >= 0 \? currentStepIndex \+ 1 : 1/);
  assert.doesNotMatch(screen, /sendTroubleshootingMessage|confirm_interpretation|restoredMessages/);
  assert.match(screen, /response\.status === "awaiting_safety_confirmation"/);
  assert.match(screen, /navigation\.replace\("SelfAssistantSafety"/);
});

test("guided assistance keeps uncertainty, resolution and mechanic controls", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/TroubleshootingConversationScreen.js"), "utf8");
  for (const title of ["Not sure", "Problem Solved", "Still Not Fixed", "Request Mechanic", "Ask AI for More Help"]) {
    assert.ok(screen.includes(`title="${title}"`));
  }
  assert.match(screen, /triggerStopCondition/);
  assert.doesNotMatch(screen, /source_instruction|source record|dataset fields/i);
});

test("completed AI 2 flow asks the driver to confirm real-world resolution", () => {
  const source = fs.readFileSync(path.join(sourceRoot, "screens/driver/SelfAssistantResultScreen.js"), "utf8");
  assert.match(source, /That completes the basic troubleshooting steps\./);
  assert.match(source, /Is the vehicle problem now resolved\?/);
  assert.match(source, /Yes – Problem Resolved/);
  assert.match(source, /No – I Still Need Help/);
  assert.match(source, /title="Request Mechanic"/);
});

test("professional-help result displays backend-provided immediate safety actions", () => {
  const source = fs.readFileSync(path.join(sourceRoot, "screens/driver/SelfAssistantResultScreen.js"), "utf8");
  assert.match(source, /resultSession\?\.safetyActions\?\.length/);
  assert.match(source, /What to do now/);
  assert.match(source, /resultSession\.safetyActions\.map/);
  assert.match(source, /aiPrediction\.faultLabel \|\| formatFaultLabel\(aiPrediction\.predictedFault\)/);
  assert.match(source, /title="Ask AI for More Help"/);
  assert.match(source, /askForStepHelp\(sessionId, question\.trim\(\)\)/);
  assert.match(source, /AI can describe the possible problem and show passive observations only/);
  assert.match(source, /setObservationSteps\(Array\.isArray\(response\.observationSteps\)/);
  assert.match(source, /Safe observations only/);
  assert.match(source, /Get Description and Observations/);
});

test("resumed conversation state distinguishes clarification, pending verification, and completed repair", () => {
  assert.equal(conversationState({ status: "in_progress", currentPhase: "instruction" }), "TROUBLESHOOTING");
  assert.equal(conversationState({ status: "in_progress", currentPhase: "result" }), "VERIFYING_ACTION");
  assert.equal(conversationState({ status: "in_progress", currentPhase: "result", clarificationCount: 1 }), "CLARIFICATION");
  assert.equal(conversationState({ status: "in_progress", pendingInterpretation: "clean_terminals" }), "CLARIFICATION");
  assert.equal(conversationState({ status: "awaiting_resolution_confirmation" }), "CHECKING_RESOLUTION");
  assert.equal(conversationState({ status: "resolved" }), "RESOLVED");
});

test("optional AI help is scoped to a step and guarded against repeated taps", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/driver/TroubleshootingConversationScreen.js"), "utf8");
  assert.match(screen, /askForStepHelp\(sessionId, question.trim\(\)\)/);
  assert.match(screen, /if \(busy.current/);
  assert.match(screen, /helpOpen && step/);
  assert.match(screen, /maxLength=\{500\}/);
});

const { getAssistanceProblems, getAssistanceQuestions } = require("../src/data/assistanceOptions");
test("nontechnical choices describe observations without requiring a fault diagnosis", () => {
  const options = getAssistanceProblems("non_technical");
  assert.equal(options.length, 12);
  assert.ok(options.some((item) => item.value === "smoke_steam"));
  assert.ok(options.some((item) => item.value === "liquid_leaking"));
  assert.doesNotMatch(options.map((item) => item.label).join(" "), /transmission|cooling|electrical|engine fault/i);
  assert.ok(getAssistanceProblems("technical").some((item) => item.value === "transmission_problem"));
  assert.ok(getAssistanceProblems("technical").some((item) => item.value === "visibility_problem"));
  assert.equal(getAssistanceQuestions("visibility_problem")[0].id, "washer_behavior");
  assert.ok(getAssistanceProblems("technical").some((item) => item.value === "cabin_filter_problem"));
  assert.equal(getAssistanceQuestions("cabin_filter_problem")[0].id, "cabin_airflow");
});

test("both paths have short question sets with Not sure and no duplicate questions", () => {
  for (const driver of ["technical", "non_technical"]) {
    for (const problem of getAssistanceProblems(driver)) {
      const questions = getAssistanceQuestions(problem.value);
      assert.ok(questions.length >= 2 && questions.length <= 4);
      assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
      assert.ok(questions.every((q) => q.options.some((option) => option.value === "not_sure")));
    }
  }
});

test("vehicle feels too hot offers a cold-engine low-coolant observation", () => {
  const questions = getAssistanceQuestions("feels_hot", "car");
  const hotSigns = questions.find((item) => item.id === "hot_signs");
  assert.ok(hotSigns);
  assert.ok(hotSigns.options.some((option) => option.value === "coolant_low" && /after the engine cooled/i.test(option.label)));
});

test("bike questions use bike controls and keep air-cooled bikes out of coolant guidance", () => {
  const starting = getAssistanceQuestions("vehicle_not_starting", "bike");
  assert.match(starting[0].question, /starter|kick starter/i);
  assert.ok(starting[1].options.some((option) => option.value === "engine_stop_switch_off"));
  assert.ok(starting[1].options.some((option) => option.value === "side_stand_in_gear"));

  const steering = getAssistanceQuestions("steering_problem", "bike");
  assert.match(steering[0].question, /handlebars/i);
  assert.doesNotMatch(steering.map((item) => item.question).join(" "), /steering wheel/i);

  const tyre = getAssistanceQuestions("wheel_tyre_symptom", "bike");
  assert.deepEqual(tyre[0].options.filter((option) => option.value !== "not_sure")
    .map((option) => option.value), ["front", "rear", "both"]);

  const heat = getAssistanceQuestions("feels_hot", "bike");
  const bikeCooling = heat.find((item) => item.id === "bike_cooling_signs");
  assert.ok(bikeCooling.options.some((option) => option.value === "air_cooled"));
  assert.ok(bikeCooling.options.some((option) => option.value === "liquid_cooled_low_coolant"));
  assert.equal(bikeCooling.options.some((option) => option.value === "coolant_low"), false);

  const noise = getAssistanceQuestions("strange_noise", "bike");
  assert.ok(noise.find((item) => item.id === "bike_sound_location")
    .options.some((option) => option.value === "chain_rear_wheel"));
});

test("technical problem choices match the selected vehicle type", () => {
  const bike = getAssistanceProblems("technical", "bike").map((item) => item.value);
  const van = getAssistanceProblems("technical", "van").map((item) => item.value);
  const threeWheeler = getAssistanceProblems("technical", "three_wheeler").map((item) => item.value);
  assert.equal(bike.includes("visibility_problem"), false);
  assert.equal(bike.includes("cabin_filter_problem"), false);
  assert.ok(van.includes("visibility_problem"));
  assert.ok(van.includes("cabin_filter_problem"));
  assert.ok(threeWheeler.includes("visibility_problem"));
  assert.equal(threeWheeler.includes("cabin_filter_problem"), false);
});

test("driver type and clear observable answers survive capture, prediction and mechanic handoff", () => {
  for (const driverType of ["technical", "non_technical"]) {
    const data = buildStructuredSymptomPayload({ vehicleType: "car", driverType,
      breakdownType: driverType === "technical" ? "electrical_problem" : "vehicle_not_starting",
      symptoms: { starting_behavior: "clicking", light_condition: "dim", danger_signs: ["none"] },
    });
    const payload = buildSelfAssistantPayload(data);
    assert.equal(payload.driverType, driverType);
    assert.match(payload.diagnosticInputText, /clicking sound/i);
    assert.match(payload.diagnosticInputText, /Weak or dim/i);
    const prefill = buildSelfAssistantMechanicPrefill(payload, { session: { _id: "session-id", recommendedService: "battery_electrical_mechanic" } });
    assert.equal(prefill.troubleshootingSessionId, "session-id");
    assert.equal(prefill.requiredService, "battery_electrical_mechanic");
    assert.equal(prefill.diagnosticInputText, payload.diagnosticInputText);
  }
});
