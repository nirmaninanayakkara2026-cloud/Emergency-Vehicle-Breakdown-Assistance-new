/* Read-only application audit: real Python APIs and Node controllers, isolated in-memory sessions. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const mongoose = require("mongoose");
const Session = require("../src/models/TroubleshootingSession");
const controller = require("../src/controllers/selfAssistantController");
const ai1 = require("../src/services/aiDiagnosisService");
const ai2 = require("../src/services/ai2TroubleshootingService");
const language = require("../src/services/troubleshootingLanguageService");
const state = require("../src/services/troubleshootingStateService");

const root = path.resolve(__dirname, "../..");
const aiRoot = path.join(root, "backend/ai");
const venv = path.join(aiRoot, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const executable = process.env.AI_TEST_PYTHON || (fs.existsSync(venv) ? venv : "python");
const pythonCode = `import json,sys
from app import (FindGuideRequest,StartGuideRequest,StepResultRequest,find_guide_endpoint,start_guide_endpoint,process_step_endpoint)
from services.ai1_prediction_service import predict_fault
for line in sys.stdin:
 try:
  request=json.loads(line); op=request['op']; data=request['data']
  if op=='find': result=find_guide_endpoint(FindGuideRequest(**data))
  elif op=='start': result=start_guide_endpoint(StartGuideRequest(**data))
  elif op=='step': result=process_step_endpoint(StepResultRequest(**data))
  elif op=='predict': result=predict_fault(data['text'])
  print(json.dumps(result),flush=True)
 except Exception as error: print(json.dumps({'auditError':str(error)}),flush=True)
`;
const worker = spawn(executable, ["-u", "-c", pythonCode], { cwd: aiRoot, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
let waiting;
let stderr = "";
worker.stderr.on("data", (data) => { stderr = (stderr + data).slice(-4000); });
worker.on("error", (error) => waiting?.reject(error));
worker.on("exit", (code) => {
  if (waiting) waiting.reject(new Error(`Python audit worker exited ${code}: ${stderr}`));
});
readline.createInterface({ input: worker.stdout }).on("line", (line) => {
  const current = waiting;
  waiting = null;
  if (!current) return;
  try {
    const result = JSON.parse(line);
    if (result.auditError) throw new Error(result.auditError);
    current.resolve(result);
  } catch (error) { current.reject(error); }
});
function python(op, data) {
  assert.equal(waiting, null, "Audit worker requests must be sequential");
  return new Promise((resolve, reject) => {
    waiting = { resolve, reject };
    worker.stdin.write(JSON.stringify({ op, data }) + "\n");
  });
}
waiting = null;

const database = new Map();
const driverId = new mongoose.Types.ObjectId();
let latestPrediction = null;
let gptCalls = 0;
Session.prototype.save = async function () {
  const error = this.validateSync();
  if (error) throw error;
  database.set(String(this._id), this.toObject());
  return this;
};
Session.findById = async (id) => database.has(String(id)) ? new Session(database.get(String(id))) : null;
Session.create = async (data) => new Session(data).save();
ai2.startGuide = (guide_id, safety_confirmed) => python("start", { guide_id, safety_confirmed });
ai2.processStep = (guide_id, step_id, selected_result) => python("step", { guide_id, step_id, selected_result });
ai2.findGuide = (fault_category, symptom_text, breakdown_type) => python("find", { fault_category, symptom_text, breakdown_type });
ai1.diagnoseBreakdown = async (text) => {
  latestPrediction = ai1.normalizePrediction(await python("predict", { text }));
  return latestPrediction;
};
language.interpretMessage = async () => { gptCalls++; return { available: false }; };

async function call(handler, sessionId, body = {}) {
  let caught;
  const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; } };
  await handler({ params: { sessionId }, user: { _id: driverId }, body }, response, (error) => { caught = error; });
  assert.equal(caught, undefined, caught?.stack);
  assert.ok(response.code < 400, `Unexpected HTTP ${response.code}`);
  return response.body;
}
function restore(snapshot) {
  const session = new Session(snapshot);
  database.set(String(session._id), session.toObject());
  return String(session._id);
}
async function read(id) { return (await Session.findById(id)).toObject(); }
async function send(id, body) {
  const session = await Session.findById(id);
  return call(controller.sendMessage, id, { stepId: session.currentStepId, expectedState: state.stateOf(session), ...body });
}
const guides = JSON.parse(fs.readFileSync(path.join(aiRoot, "ai2/knowledge/troubleshooting_knowledge_base.json"), "utf8")).guides;
const archive = JSON.parse(fs.readFileSync(path.join(aiRoot, "dataset/processed/ai2_troubleshooting_archive.json"), "utf8"));
const report = { generatedAt: new Date().toISOString(), scope: "All active guides and approved answer branches; all original archive symptom examples; bounded uncertainty and safety wording probes. Car sessions, real Python and Node code; MongoDB and GPT are isolated substitutes.", guides: [], paths: [], uncertainty: [], entryCases: [], safety: [], assertions: [] };
const stepSnapshots = new Map();
const verificationSnapshots = new Map();

async function beginGuide(guide) {
  const result = await ai2.startGuide(guide.id, false);
  if (guide.risk_level === "HIGH") {
    assert.equal(result.status, "professional_help_required");
    assert.equal(result.current_step, undefined);
    return null;
  }
  const session = new Session({
    driverId, vehicleType: "car", breakdownType: "other", diagnosticInputText: guide.symptoms.join(". "),
    predictedFault: { fault: guide.fault_category }, guideId: guide.id, guideTitle: guide.title,
    riskLevel: guide.risk_level, recommendedService: guide.recommended_service,
    status: result.status === "safety_confirmation_required" ? "awaiting_safety_confirmation" : "in_progress",
    currentStep: result.current_step || null, currentStepId: result.current_step?.step_id || null
  });
  await session.save();
  if (session.status === "awaiting_safety_confirmation") {
    assert.equal(result.current_step, null);
    await call(controller.confirmSafety, String(session._id));
  }
  return read(String(session._id));
}

async function walk(guide, snapshot, choices = []) {
  assert.ok(choices.length < 15, "Unexpected path loop");
  let id = restore(snapshot);
  let session = await Session.findById(id);
  const completed = session.completedSteps.map((item) => item.stepId);
  assert.equal(new Set(completed).size, completed.length, "A completed physical check was repeated");
  if (["resolved", "professional_help_required"].includes(session.status)) {
    if (session.status === "resolved") assert.ok(choices.some((item) => item.answer === "resolved" && item.phase === "resolution"));
    report.paths.push({ guideId: guide.id, title: guide.subcategory, choices, outcome: session.status, reason: session.escalationReason, message: session.lastMessage });
    return;
  }
  if (session.status === "awaiting_resolution_confirmation") {
    verificationSnapshots.set(`${guide.id}/${completed.join(",")}`, await read(id));
    for (const answer of ["resolved", "unresolved"]) {
      id = restore(snapshot);
      await send(id, { selectedResult: answer });
      await walk(guide, await read(id), [...choices, { phase: "resolution", answer }]);
    }
    return;
  }
  assert.equal(session.status, "in_progress");
  if (session.currentPhase === "instruction") await call(controller.confirmStepAction, id, { stepId: session.currentStepId });
  snapshot = await read(id);
  session = await Session.findById(id);
  stepSnapshots.set(`${guide.id}/${session.currentStepId}`, snapshot);
  for (const option of session.currentStep.possible_results) {
    id = restore(snapshot);
    await call(controller.submitStep, id, { stepId: session.currentStepId, selectedResult: option.value });
    await walk(guide, await read(id), [...choices, { phase: "observation", stepId: session.currentStepId, answer: option.value, label: option.label }]);
  }
}

const breakdownForFault = {
  electrical_system_fault: "electrical_problem", wheel_tire_fault: "flat_tyre", cooling_system_fault: "engine_overheating",
  brake_system_fault: "brake_problem", fuel_system_fault: "fuel_problem", steering_system_fault: "steering_problem",
  transmission_fault: "transmission_problem", engine_system_fault: "engine_problem"
};
const safetyMessages = [
  ["There is smoke coming from the battery", true], ["There is fire under the bonnet", true],
  ["I can smell petrol", true], ["Strong fuel smell", true], ["A burning smell from the wiring", true],
  ["The battery is leaking", true], ["The battery is swollen", true], ["Brake failure", true],
  ["The brakes are not working", true], ["My brakes have stopped working", true],
  ["Steering locked", true], ["I cannot control the steering", true], ["Severe overheating", true],
  ["The temperature gauge is in the red", true], ["The engine temperature gauge is at maximum", true],
  ["Steam is coming from the engine", true], ["I am in moving traffic", true],
  ["I am stranded in the middle of the highway", true], ["Low oil pressure warning", true],
  ["No smoke or fire", false], ["The battery is not leaking", false], ["Engine misfire", false],
  ["The engine is not overheating", false], ["I don't smell fuel", false]
];

async function main() {
  for (const guide of guides) {
    const snapshot = await beginGuide(guide);
    if (snapshot) await walk(guide, snapshot);
    else report.paths.push({ guideId: guide.id, title: guide.subcategory, choices: [], outcome: "professional_help_required", reason: "high_risk_guide" });
    const paths = report.paths.filter((item) => item.guideId === guide.id);
    const resolvedPaths = paths.filter((item) => item.outcome === "resolved");
    report.guides.push({ id: guide.id, title: guide.subcategory, fault: guide.fault_category, risk: guide.risk_level, classification: resolvedPaths.length ? "can_confirm_resolution" : snapshot ? "checks_then_professional_help" : "immediate_professional_help", terminalPaths: paths.length, resolvedPaths: resolvedPaths.length });
  }
  console.log(`Exercised ${report.guides.length} guides and ${report.paths.length} complete answer paths.`);

  for (const [key, snapshot] of [...stepSnapshots, ...verificationSnapshots]) {
    const id = restore(snapshot);
    const results = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await send(id, { selectedResult: "not_sure" });
      results.push({ state: response.state, status: response.status, stepId: response.session.currentStepId });
      if (attempt === 0) assert.equal(response.escalate, false, `${key}: first uncertainty must clarify`);
      if (response.status === "professional_help_required" || response.session.currentStepId !== snapshot.currentStepId) break;
    }
    report.uncertainty.push({ key, results });
  }
  console.log(`Exercised uncertainty at ${report.uncertainty.length} distinct check/verification points.`);

  for (const record of archive) {
    const text = record.symptoms.join(". ");
    const breakdownType = breakdownForFault[record.fault_category] || "other";
    latestPrediction = null;
    const response = await call(controller.startSelfAssistant, null, { vehicleType: "car", breakdownType, diagnosticInputText: text });
    const selected = report.guides.find((guide) => guide.id === response.session?.guideId);
    report.entryCases.push({ sourceId: record.record_id, title: record.original_fault_name, expectedFault: record.fault_category, text, breakdownType, modelFault: latestPrediction?.predictedFault || null, status: response.status, selectedGuide: selected?.title || null, selectedGuideId: selected?.id || null, selectedGuideCanResolve: selected?.classification === "can_confirm_resolution", reason: response.session?.escalationReason || null });
  }
  console.log(`Exercised ${report.entryCases.length} original symptom examples through startup with real AI 1 predictions where required.`);

  const battery = guides.find((guide) => guide.id === "ai2_aktc_0036");
  const instruction = await beginGuide(battery);
  const states = [instruction, stepSnapshots.get(`${battery.id}/step_1`), verificationSnapshots.get(`${battery.id}/step_1`)];
  for (const snapshot of states) {
    assert.ok(snapshot);
    for (const [message, expectedStop] of safetyMessages) {
      const id = restore(snapshot);
      const callsBefore = gptCalls;
      const response = await send(id, { message });
      const actualStop = response.status === "professional_help_required";
      report.safety.push({ state: state.stateOf(new Session(snapshot)), message, expectedStop, actualStop, gptRequested: gptCalls > callsBefore, passed: actualStop === expectedStop, result: response.state });
    }
  }
  report.assertions = ["All HIGH guides expose no active repair step", "All terminal paths finish in a supported state", "Every resolved path includes an explicit driver resolution answer", "No completed check repeats", "First uncertainty does not immediately escalate"];
  report.summary = {
    archiveRecords: archive.length, activeGuides: guides.length, excludedSourceRecords: archive.length - guides.length,
    canConfirmResolution: report.guides.filter((guide) => guide.classification === "can_confirm_resolution").length,
    checksOnly: report.guides.filter((guide) => guide.classification === "checks_then_professional_help").length,
    immediateProfessionalHelp: report.guides.filter((guide) => guide.classification === "immediate_professional_help").length,
    terminalPaths: report.paths.length, resolvedPaths: report.paths.filter((item) => item.outcome === "resolved").length,
    uncertaintyPoints: report.uncertainty.length, startupExamples: report.entryCases.length,
    safetyProbes: report.safety.length, safetyPassed: report.safety.filter((item) => item.passed).length,
    safetyMismatches: report.safety.filter((item) => !item.passed).length
  };
  const output = path.join(root, "docs/troubleshooting-case-audit.json");
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  writeMarkdown();
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("Reports written to docs/troubleshooting-case-audit.md and .json");
}

function writeMarkdown() {
  const categories = [...new Set(report.guides.map((guide) => guide.fault))];
  const startupCounts = report.entryCases.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});
  const safe = (value) => String(value ?? "—").replace(/\|/g, "/").replace(/\n/g, " ");
  const label = { can_confirm_resolution: "Can confirm resolution", checks_then_professional_help: "Checks only; then professional help", immediate_professional_help: "Immediate professional help" };
  const lines = [
    "# Driver troubleshooting case audit", "", `Generated: ${report.generatedAt}`, "",
    "This tests software outcomes, not whether a repair works on a real vehicle. 'Can confirm resolution' means the driver explicitly reports that the original problem has gone away after an approved observation. None of the current guide steps are classified as SAFE_ACTION repair procedures.", "",
    "## Scope and totals", "", report.scope, "",
    ...Object.entries(report.summary).map(([key, value]) => `- ${key}: ${value}`), "",
    "## Cases that can reach confirmed resolution", "",
    "| Guide | Required answer sequence | Final result |", "| --- | --- | --- |",
    ...report.paths.filter((item) => item.outcome === "resolved").map((item) => `| ${safe(item.title)} | ${item.choices.map((choice) => safe(choice.label || choice.answer)).join(" → ")} | Resolved |`), "",
    "Corroded terminals, incorrect tyre pressure, low washer fluid and faulty pumps still escalate: approved cleaning, inflation, refill and repair instructions are absent. A normal result without confirmation that the original problem is gone does not mark a session resolved.", "",
    "## Outcomes by problem category", "",
    "These are capabilities of the current chatbot, not a judgment that drivers can never address these problems. In particular, none of the cooling/temperature guides currently reaches confirmed resolution.", "",
    "| Category | Can confirm resolution | Checks only | Immediate professional help |", "| --- | --- | --- | --- |",
    ...categories.map((fault) => `| ${fault} | ${["can_confirm_resolution", "checks_then_professional_help", "immediate_professional_help"].map((classification) => report.guides.filter((guide) => guide.fault === fault && guide.classification === classification).length).join(" | ")} |`), "",
    "## Every active guide", "", "| ID | Guide | Category | Risk | Outcome capability | Paths tested |", "| --- | --- | --- | --- | --- | --- |",
    ...report.guides.map((guide) => `| ${guide.id} | ${safe(guide.title)} | ${guide.fault} | ${guide.risk} | ${label[guide.classification]} | ${guide.terminalPaths} |`), "",
    "## Excluded source cases", "", "These source records have no approved driver guide. Direct startup is unavailable; symptom routing can still select a different guide or ask for information. Exclusion does not mean the underlying fault can never be repaired.", "",
    ...archive.filter((record) => !guides.some((guide) => guide.source_record_id === record.record_id)).map((record) => `- ${record.record_id}: ${record.original_fault_name}`), "",
    "## Safety wording failures", "", "The probes below expected immediate backend handling, including when GPT is unavailable. Failures are reported without changing application behavior. They show that keyword matching is not comprehensive.", "",
    "| Conversation state | Driver message | Expected stop | Actual stop | GPT requested |", "| --- | --- | --- | --- | --- |",
    ...report.safety.filter((item) => !item.passed).map((item) => `| ${item.state} | ${safe(item.message)} | ${item.expectedStop} | ${item.actualStop} | ${item.gptRequested} |`), "",
    "## Initial symptom routing: all original cases", "", "The main problem is selected using each record's known category where the app has such a selector; otherwise it uses Other or Engine Problem. Actual AI 1 inference is used, except when an initial safety rule stops the request first. These are source-data examples, not an independent model-accuracy benchmark. Guide capability is listed separately because routing may choose another guide.", "",
    ...Object.entries(startupCounts).map(([status, count]) => `- ${status}: ${count}`), "",
    "Routing findings in this run: the washer-fluid symptom example asks for more information rather than directly reaching its resolution-capable guide. Door-lock symptoms with a clicking sound select Battery Replacement. Uneven tyre wear with vibration selects TPMS. These matches need review; reaching a guide with a resolution branch does not establish the cause or repair the reported fault.", "",
    "| Source case | Main problem | Initial result | Selected guide | Selected guide can confirm resolution |", "| --- | --- | --- | --- | --- |",
    ...report.entryCases.map((item) => `| ${safe(item.title)} | ${item.breakdownType} | ${item.status} | ${safe(item.selectedGuide)} | ${item.selectedGuideCanResolve ? "Yes" : "No"} |`), "",
    "## Verified invariants", "", ...report.assertions.map((item) => `- ${item}`), "",
    "Full answer-by-answer paths, uncertainty results, input texts, predictions and safety results are in [the JSON evidence](troubleshooting-case-audit.json).", "",
    "Run again: `cd backend` then `node scripts/auditTroubleshootingCases.js`. Requires the project's installed Python AI dependencies. The script never loads backend/.env, contacts OpenAI, or connects to MongoDB. It uses serialized Mongoose documents to isolate test sessions and one local Python worker for real inference/guide decisions. It does not cover every free-text phrasing, other vehicle types, mobile interaction, or live database concurrency.", ""
  ];
  fs.writeFileSync(path.join(root, "docs/troubleshooting-case-audit.md"), lines.join("\n"));
}

main().catch((error) => { console.error(error.stack); process.exitCode = 1; }).finally(() => {
  worker.stdin.end();
});
