const { sanitizeText } = require("./clarificationService");

const RESOLUTION_OPTIONS = [
  { value: "resolved", label: "Yes, the original problem is resolved and there are no danger signs" },
  { value: "unresolved", label: "No, the problem remains" },
  { value: "not_sure", label: "Not Sure" }
];

function stateOf(session) {
  if (session.status === "resolved") return "RESOLVED";
  if (session.status === "professional_help_required") return "ESCALATED";
  if (session.status === "cancelled") return "CANCELLED";
  if (session.status === "awaiting_resolution_confirmation") return "CHECKING_RESOLUTION";
  if (session.status === "awaiting_safety_confirmation") return "SAFETY_CONFIRMATION";
  if (session.pendingInterpretation || session.clarificationCount) return "CLARIFICATION";
  return session.currentPhase === "result" ? "VERIFYING_ACTION" : "TROUBLESHOOTING";
}

function record(session, role, content) {
  session.messages ||= [];
  session.messages.push({ role, content: sanitizeText(content, 2000), stepId: session.currentStepId, createdAt: new Date() });
  // Persist a bounded transcript; completedSteps retains the full approved-check history.
  if (session.messages.length > 120) session.messages.splice(0, session.messages.length - 120);
  if (role === "assistant") session.lastMessage = content;
}

function optionsFor(session) {
  if (session.pendingInterpretation === "danger_confirmation") return [
    { value: "danger_yes", label: "Yes, there is an unsafe condition" },
    { value: "danger_no", label: "No, I am not reporting danger" }
  ];
  if (session.status === "awaiting_resolution_confirmation") return RESOLUTION_OPTIONS;
  if (session.status !== "in_progress" || session.currentPhase !== "result") return [];
  const options = session.currentStep?.possible_results || [];
  return options.some((item) => item.value === "not_sure") ? options : [...options, { value: "not_sure", label: "Not Sure" }];
}

function payload(session, extra = {}) {
  return {
    success: true,
    status: session.status,
    state: stateOf(session),
    message: session.lastMessage || "",
    currentStep: session.currentStep,
    nextStep: session.status === "in_progress" ? session.currentStep : null,
    currentPhase: session.currentPhase,
    options: optionsFor(session),
    resolved: session.status === "resolved",
    escalate: session.status === "professional_help_required",
    escalationReason: session.escalationReason || null,
    pendingInterpretation: session.pendingInterpretation || null,
    recommendedService: session.status === "professional_help_required" ? session.recommendedService : null,
    session: typeof session.toJSON === "function" ? session.toJSON() : session,
    ...extra
  };
}

function escalate(session, reason, message) {
  session.status = "professional_help_required";
  session.escalationReason = reason;
  session.currentStepId = null;
  session.currentStep = null;
  session.resumeStep = null;
  session.pendingInterpretation = null;
  session.currentPhase = "completed";
  session.completedAt = new Date();
  record(session, "assistant", message);
}

function enterStep(session, step) {
  if (!step?.step_id || (session.completedSteps || []).some((item) => item.stepId === step.step_id)) {
    escalate(session, "approved_steps_exhausted", "There are no further approved checks that you have not already completed. Professional assistance is recommended.");
    return;
  }
  session.status = "in_progress";
  session.currentStepId = step.step_id;
  session.currentStep = step;
  session.currentPhase = "instruction";
  session.currentInstructionConfirmedAt = null;
  session.clarificationCount = 0;
  session.pendingInterpretation = null;
  session.resumeStep = null;
  record(session, "assistant", step.instruction);
}

function clarify(session) {
  session.pendingInterpretation = null;
  session.clarificationCount = (session.clarificationCount || 0) + 1;
  if (session.clarificationCount >= 3) {
    escalate(session, "insufficient_approved_information", "We still cannot establish the result safely, and this guide has no independent approved check to clarify it. Professional assistance is recommended.");
    return;
  }
  const message = session.status === "awaiting_resolution_confirmation"
    ? "Is the original problem still happening? Only choose resolved if you have already observed that it is gone and there are no danger signs. Do not operate the vehicle to find out."
    : session.currentStep?.simple_question || "Choose the closest observation below. You do not need to guess or touch anything.";
  record(session, "assistant", session.clarificationCount === 2 ? `You can describe what you already noticed in your own words. ${message}` : message);
}

function applyStepResult(session, result, selectedResult) {
  if (result.status === "clarification_required") {
    clarify(session);
    return;
  }
  const step = session.currentStep;
  const option = step?.possible_results?.find((item) => item.value === selectedResult);
  if (!(session.completedSteps || []).some((item) => item.stepId === session.currentStepId)) {
    session.completedSteps.push({ stepId: session.currentStepId, instruction: step?.instruction || "", instructionConfirmed: true, selectedResult, resultLabel: option?.label || selectedResult, completedAt: new Date() });
  }
  session.clarificationCount = 0;
  session.pendingInterpretation = null;
  if (result.status === "in_progress" && result.next_step) {
    enterStep(session, result.next_step);
  } else if (["awaiting_resolution_confirmation", "resolved"].includes(result.status)) {
    // "resolved" from older Python versions means checklist completion, not a confirmed repair.
    session.status = "awaiting_resolution_confirmation";
    session.resumeStep = result.next_step || null;
    session.currentStepId = null;
    session.currentStep = null;
    session.currentPhase = "completed";
    record(session, "assistant", result.message || "Is the original problem now resolved, with no remaining danger signs?");
  } else {
    escalate(session, "no_approved_self_repair", result.message || "There is not enough approved guidance to continue safely. Professional assistance is recommended.");
  }
}

function resolve(session, resolved) {
  session.pendingInterpretation = null;
  session.clarificationCount = 0;
  if (resolved) {
    session.status = "resolved";
    session.currentStepId = null;
    session.currentStep = null;
    session.resumeStep = null;
    session.currentPhase = "completed";
    session.completedAt = new Date();
    record(session, "assistant", "You confirmed that the original problem is resolved. This check is complete.");
  } else if (session.resumeStep) {
    enterStep(session, session.resumeStep);
  } else {
    escalate(session, "approved_steps_exhausted", "The problem remains after all available approved checks. Professional assistance is recommended.");
  }
}

module.exports = { stateOf, record, optionsFor, payload, escalate, enterStep, clarify, applyStepResult, resolve };
