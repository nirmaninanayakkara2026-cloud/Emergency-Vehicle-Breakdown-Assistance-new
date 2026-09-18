const mongoose = require("mongoose");
const TroubleshootingSession = require("../models/TroubleshootingSession");
const structuredProblemRoutingService = require("../services/structuredProblemRoutingService");
const ai2Service = require("../services/ai2TroubleshootingService");
const conversation = require("../services/troubleshootingStateService");
const language = require("../services/troubleshootingLanguageService");
const { detectDanger, dangerMessage } = require("../services/troubleshootingSafetyService");
const { buildDiagnosticText } = require("../utils/buildDiagnosticText");
const { normalizeSymptomCapture } = require("../utils/symptomNormalizer");
const { mapBreakdownToServiceType, VEHICLE_TYPES } = require("../utils/domainConstants");
const faultServiceMapping = require("../../ai/config/fault_service_mapping.json");
const simpleAssistance = require("../services/simpleAssistanceService");
const aiTroubleshootingHelp = require("../services/aiTroubleshootingHelpService");

const TERMINAL_STATUSES = new Set([
  "resolved",
  "professional_help_required",
  "cancelled"
]);

function sameId(first, second) {
  return String(first?._id || first) === String(second?._id || second);
}

function predictionSnapshot(prediction) {
  return {
    fault: prediction.predictedFault,
    label: prediction.faultLabel,
    confidence: prediction.confidence,
    confidenceLevel: prediction.confidenceLevel,
    needsMoreInformation: prediction.needsMoreInformation
  };
}

function resolvePredictionService(prediction = {}) {
  const normalizedService = prediction.requiredService || prediction.required_service;
  if (normalizedService) {
    return { requiredService: normalizedService, fallbackUsed: false };
  }
  const mappedService = faultServiceMapping[prediction.predictedFault || prediction.predicted_fault];
  if (mappedService) {
    return { requiredService: mappedService, fallbackUsed: false };
  }
  return { requiredService: "general_mechanic", fallbackUsed: true };
}

function apiPrediction(prediction) {
  const service = resolvePredictionService(prediction);
  return {
    predictedFault: prediction.predictedFault,
    faultLabel: prediction.faultLabel,
    requiredService: service.requiredService,
    fallbackUsed: service.fallbackUsed,
    confidence: prediction.confidence,
    confidenceLevel: prediction.confidenceLevel,
    predictionMargin: prediction.predictionMargin,
    isAmbiguous: prediction.isAmbiguous,
    needsMoreInformation: prediction.needsMoreInformation,
    topPredictions: prediction.topPredictions,
    predictionSource: prediction.predictionSource
  };
}

function unavailableResponse(res) {
  return res.status(503).json({
    success: false,
    status: "troubleshooting_unavailable",
    message: "Self-troubleshooting is temporarily unavailable.",
    canRequestMechanic: true
  });
}

function sessionPayload(session) {
  return typeof session.toJSON === "function" ? session.toJSON() : session;
}

async function findOwnedSession(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId)) {
    res.status(400);
    throw new Error("Troubleshooting session id is invalid");
  }
  const session = await TroubleshootingSession.findById(req.params.sessionId);
  if (!session) {
    res.status(404);
    throw new Error("Troubleshooting session not found");
  }
  if (!sameId(session.driverId, req.user._id)) {
    res.status(403);
    throw new Error("You do not have permission to access this troubleshooting session");
  }
  return session;
}

async function startSelfAssistant(req, res, next) {
  try {
    const { vehicleType, breakdownType } = req.body;
    if (!VEHICLE_TYPES.includes(vehicleType)) {
      res.status(400);
      throw new Error("A supported vehicle type is required");
    }
    if (typeof breakdownType !== "string" || !breakdownType.trim() || breakdownType.length > 100) {
      res.status(400);
      throw new Error("Breakdown type is required");
    }

    const symptomCapture = normalizeSymptomCapture(req.body.symptomCapture);
    const suppliedText = String(req.body.diagnosticInputText || "").trim();
    const diagnosticInputText = (suppliedText || buildDiagnosticText({
      vehicleType,
      breakdownType,
      symptomCapture,
      problemDescription: req.body.problemDescription
    })).slice(0, 3000);
    if (!diagnosticInputText) {
      res.status(400);
      throw new Error("Symptom information is required");
    }

    if (req.body.driverType !== undefined) {
      if (!["technical", "non_technical"].includes(req.body.driverType)) {
        res.status(400);
        throw new Error("Choose how you want to identify the problem.");
      }
      const safetyText = [suppliedText, buildDiagnosticText({
        symptomCapture, problemDescription: req.body.problemDescription
      })].join("\n");
      const result = await simpleAssistance.start({
        driverType: req.body.driverType, vehicleType, breakdownType,
        symptomCapture, diagnosticInputText, safetyText
      }, req.user._id);
      return res.status(result.session ? 201 : 200).json(result);
    }

    const danger = detectDanger([suppliedText, buildDiagnosticText({
      vehicleType, breakdownType, symptomCapture, problemDescription: req.body.problemDescription
    })].join("\n"));
    if (danger) {
      const session = new TroubleshootingSession({
        driverId: req.user._id, vehicleType, breakdownType, symptomCapture, diagnosticInputText,
        predictedFault: predictionSnapshot({ faultLabel: "Safety concern reported", needsMoreInformation: false }),
        riskLevel: "HIGH", recommendedService: mapBreakdownToServiceType(breakdownType)
      });
      conversation.record(session, "user", diagnosticInputText);
      conversation.escalate(session, danger.id, dangerMessage(danger));
      await session.save();
      return res.status(201).json(conversation.payload(session, { riskLevel: "HIGH" }));
    }

    const aiPrediction = await structuredProblemRoutingService.diagnoseWithStructuredProblemPolicy(
      breakdownType,
      diagnosticInputText,
      { fallbackRequiredService: mapBreakdownToServiceType(breakdownType) }
    );
    if (aiPrediction.needsMoreInformation) {
      return res.status(200).json({
        success: true,
        status: "more_information_required",
        aiPrediction: apiPrediction(aiPrediction),
        message: "We need a little more information before starting troubleshooting."
      });
    }

    const guideResult = await ai2Service.findGuide(
      aiPrediction.predictedFault,
      diagnosticInputText,
      breakdownType
    );
    if (guideResult.status === "troubleshooting_unavailable") {
      return unavailableResponse(res);
    }

    const guide = guideResult.guide;
    if (!guideResult.guide_available || !guide) {
      const session = await TroubleshootingSession.create({
        driverId: req.user._id,
        vehicleType,
        breakdownType,
        symptomCapture,
        diagnosticInputText,
        predictedFault: predictionSnapshot(aiPrediction),
        status: "professional_help_required",
        escalationReason: "no_matching_approved_guide",
        lastMessage: "No validated self-troubleshooting guide matches these symptoms.",
        recommendedService: guideResult.recommended_service || "general_mechanic",
        completedAt: new Date()
      });
      return res.status(201).json({
        success: true,
        status: "professional_help_required",
        message: "No validated self-troubleshooting guide is available for this issue.",
        recommendedService: session.recommendedService,
        aiPrediction: apiPrediction(aiPrediction),
        session: sessionPayload(session)
      });
    }

    const baseSession = {
      driverId: req.user._id,
      vehicleType,
      breakdownType,
      symptomCapture,
      diagnosticInputText,
      predictedFault: predictionSnapshot(aiPrediction),
      guideId: guide.guide_id,
      guideTitle: guide.title,
      riskLevel: guide.risk_level,
      recommendedService: guide.recommended_service,
      safetyWarning: guide.safety_warning,
      beforeYouBegin: guide.before_you_begin,
      messages: [{ role: "user", content: diagnosticInputText.slice(0, 2000), createdAt: new Date() }]
    };

    if (guide.risk_level === "HIGH" || guide.professional_help_required) {
      const session = await TroubleshootingSession.create({
        ...baseSession,
        status: "professional_help_required",
        escalationReason: "high_risk_guide",
        lastMessage: "This issue may be unsafe to troubleshoot without professional assistance.",
        completedAt: new Date()
      });
      return res.status(201).json({
        success: true,
        status: "professional_help_required",
        riskLevel: "HIGH",
        message: "This issue may be unsafe to troubleshoot without professional assistance.",
        recommendedService: guide.recommended_service,
        aiPrediction: apiPrediction(aiPrediction),
        session: sessionPayload(session)
      });
    }

    if (guide.risk_level === "CAUTION") {
      const session = await TroubleshootingSession.create({
        ...baseSession,
        status: "awaiting_safety_confirmation"
      });
      return res.status(201).json({
        success: true,
        status: "awaiting_safety_confirmation",
        riskLevel: "CAUTION",
        safetyWarning: guide.safety_warning,
        beforeYouBegin: guide.before_you_begin,
        requiresSafetyConfirmation: true,
        aiPrediction: apiPrediction(aiPrediction),
        session: sessionPayload(session)
      });
    }

    const startResult = await ai2Service.startGuide(guide.guide_id, false);
    if (startResult.status === "troubleshooting_unavailable") {
      return unavailableResponse(res);
    }
    if (startResult.status !== "in_progress" || !startResult.current_step) {
      return unavailableResponse(res);
    }
    const session = await TroubleshootingSession.create({
      ...baseSession,
      status: "in_progress",
      currentStepId: startResult.current_step.step_id,
      currentStep: startResult.current_step,
      currentPhase: "instruction",
      lastMessage: startResult.current_step.instruction,
      messages: [...baseSession.messages, { role: "assistant", content: startResult.current_step.instruction, createdAt: new Date() }],
      startedAt: new Date()
    });
    return res.status(201).json({
      success: true,
      status: "ready_to_start",
      riskLevel: "LOW",
      requiresSafetyConfirmation: false,
      currentStep: startResult.current_step,
      aiPrediction: apiPrediction(aiPrediction),
      session: sessionPayload(session)
    });
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function confirmSafety(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.status !== "awaiting_safety_confirmation" || session.riskLevel !== "CAUTION") {
      res.status(409);
      throw new Error("This session is not awaiting safety confirmation");
    }
    if (session.driverType) return res.status(200).json(await simpleAssistance.confirmSafety(session));
    const result = await ai2Service.startGuide(session.guideId, true);
    if (result.status === "troubleshooting_unavailable") return unavailableResponse(res);
    if (result.status !== "in_progress" || !result.current_step) {
      session.status = "professional_help_required";
      session.completedAt = new Date();
      await session.save();
      return res.status(200).json({ success: true, ...result, session: sessionPayload(session) });
    }
    session.safetyConfirmed = true;
    session.status = "in_progress";
    session.currentStepId = result.current_step.step_id;
    session.currentStep = result.current_step;
    session.currentPhase = "instruction";
    session.currentInstructionConfirmedAt = null;
    session.startedAt = new Date();
    conversation.record(session, "assistant", result.current_step.instruction);
    await session.save();
    return res.status(200).json({
      success: true,
      status: "in_progress",
      currentStep: result.current_step,
      session: sessionPayload(session)
    });
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function confirmStepAction(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.driverType) {
      res.status(409);
      throw new Error("Use the guided action buttons for this session.");
    }
    const stepId = String(req.body.stepId || "");
    if (session.status !== "in_progress") {
      res.status(409);
      throw new Error("This troubleshooting session is not active");
    }
    if (!stepId || stepId !== session.currentStepId) {
      res.status(400);
      throw new Error("The current approved step is required");
    }
    if (session.currentPhase === "result") {
      return res.status(200).json({
        success: true,
        status: "in_progress",
        currentPhase: "result",
        currentStep: session.currentStep,
        session: sessionPayload(session)
      });
    }
    session.currentPhase = "result";
    session.currentInstructionConfirmedAt = new Date();
    conversation.record(session, "user", "Done - I Checked");
    conversation.record(session, "assistant", session.currentStep?.result_question || session.currentStep?.question || "What did you observe?");
    await session.save();
    return res.status(200).json(conversation.payload(session));
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function submitStep(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.driverType) {
      res.status(409);
      throw new Error("Use the guided action buttons for this session.");
    }
    if (session.status !== "in_progress") {
      res.status(409);
      throw new Error("This troubleshooting session is not active");
    }
    const stepId = String(req.body.stepId || "");
    const selectedResult = String(req.body.selectedResult || "");
    const danger = detectDanger(selectedResult);
    if (danger) {
      conversation.record(session, "user", selectedResult);
      conversation.escalate(session, danger.id, dangerMessage(danger));
      await session.save();
      return res.status(200).json(conversation.payload(session));
    }
    if (!stepId || stepId !== session.currentStepId || !selectedResult) {
      res.status(400);
      throw new Error("The current step and selected result are required");
    }
    if (session.currentPhase !== "result") {
      res.status(409);
      throw new Error("Confirm the approved instruction before selecting a result");
    }
    const result = await applySelection(session, selectedResult, res);
    if (!result) return;
    await session.save();
    return res.status(200).json(conversation.payload(session));
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function applySelection(session, selectedResult, res, recordAnswer = true) {
  const option = conversation.optionsFor(session).find((item) => item.value === selectedResult);
  if (!option) {
    res.status(400);
    throw new Error("Choose a current approved answer");
  }
  if (recordAnswer) conversation.record(session, "user", option.label);
  if (selectedResult === "danger_yes") {
    conversation.escalate(session, "driver_confirmed_danger", "Stop troubleshooting and keep clear of the unsafe area. Professional assistance is required.");
  } else if (selectedResult === "danger_no") {
    session.pendingInterpretation = null;
    conversation.record(session, "assistant", "Thank you for clarifying. Please choose the observation that matches the current question.");
  } else if (selectedResult === "not_sure") {
    if (session.status === "in_progress" && session.clarificationCount >= 1 && session.currentStep?.uncertain_next_step) {
      const alternative = await ai2Service.processStep(session.guideId, session.currentStepId, "skip_unsure");
      if (alternative.status === "troubleshooting_unavailable") {
        unavailableResponse(res);
        return false;
      }
      conversation.applyStepResult(session, alternative, "not_sure");
    } else conversation.clarify(session);
  } else if (session.status === "awaiting_resolution_confirmation") {
    conversation.resolve(session, selectedResult === "resolved");
  } else {
    const result = await ai2Service.processStep(session.guideId, session.currentStepId, selectedResult);
    if (result.status === "troubleshooting_unavailable") {
      unavailableResponse(res);
      return false;
    }
    if (["invalid_step", "invalid_result"].includes(result.status)) {
      res.status(400);
      throw new Error(result.message || "The approved answer was rejected");
    }
    conversation.applyStepResult(session, result, selectedResult);
  }
  return true;
}

function normalizeReply(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function sendMessage(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.driverType) {
      res.status(409);
      throw new Error("Use Ask AI for More Help to explain the current step.");
    }
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    const selectedResult = typeof req.body.selectedResult === "string" ? req.body.selectedResult : "";
    if ((!message && !selectedResult) || message.length > 1000 || selectedResult.length > 200) {
      res.status(400);
      throw new Error("Send a message of 1 to 1000 characters or a current answer");
    }
    if (TERMINAL_STATUSES.has(session.status)) return res.status(200).json(conversation.payload(session));
    // Raw text is always checked before state checks, parsing, or a model call.
    const danger = detectDanger(message || selectedResult);
    if (danger) {
      conversation.record(session, "user", message || selectedResult);
      conversation.escalate(session, danger.id, dangerMessage(danger));
      await session.save();
      return res.status(200).json(conversation.payload(session));
    }
    if (!["in_progress", "awaiting_resolution_confirmation"].includes(session.status)) {
      res.status(409);
      throw new Error("Complete the safety confirmation before troubleshooting");
    }
    if (req.body.expectedState !== conversation.stateOf(session) ||
      (req.body.stepId || null) !== (session.currentStepId || null)) {
      res.status(409);
      throw new Error("This conversation has changed. Reopen the session to see the current question.");
    }
    if (selectedResult) {
      let answer = selectedResult;
      if (answer === "confirm_interpretation") {
        answer = session.pendingInterpretation;
        if (!answer) {
          res.status(409);
          throw new Error("There is no pending interpretation to confirm");
        }
      }
      if (session.pendingInterpretation === "danger_confirmation" && !["danger_yes", "danger_no"].includes(answer)) {
        res.status(409);
        throw new Error("Please clarify the possible unsafe condition first");
      }
      if (answer === "reject_interpretation") {
        session.pendingInterpretation = null;
        conversation.record(session, "user", "That is not what I meant");
        conversation.record(session, "assistant", "Please choose the closest answer below, or describe what you observed.");
      } else if (!(await applySelection(session, answer, res))) return;
    } else {
      conversation.record(session, "user", message);
      const options = conversation.optionsFor(session);
      const normalized = normalizeReply(message);
      let exact = options.find((item) => [normalizeReply(item.value), normalizeReply(item.label)].includes(normalized));
      if (session.status === "awaiting_resolution_confirmation" && session.pendingInterpretation !== "danger_confirmation") {
        const yes = ["yes", "yes it started", "it works now", "problem resolved", "yes it is resolved"].includes(normalized);
        const no = ["no", "still not working", "no still not working", "it still does not work", "no still not starting"].includes(normalized);
        if (yes || no) exact = options.find((item) => item.value === (yes ? "resolved" : "unresolved"));
      }
      const unsure = ["not sure", "unsure", "i am not sure", "i don t know", "i dont know", "i cannot tell"].includes(normalized);
      if (session.currentPhase === "instruction" && session.status === "in_progress") {
        // Text cannot silently bypass the explicit action-confirmation control.
        if (unsure) conversation.clarify(session);
        else conversation.record(session, "assistant", `${session.currentStep.instruction}\nWhen you have completed only this approved check, select Done - I Checked. If it is unclear, you can stop without touching anything.`);
      } else if (session.pendingInterpretation === "danger_confirmation" && !exact) {
        conversation.record(session, "assistant", "Please answer the safety question below before continuing. If you cannot rule out danger, choose Yes.");
      } else if (unsure) {
        if (!(await applySelection(session, "not_sure", res, false))) return;
      } else if (exact) {
        if (!(await applySelection(session, exact.value, res, false))) return;
      } else {
        const interpretation = await language.interpretMessage({
          state: conversation.stateOf(session), options, latestMessage: message,
          symptom: session.diagnosticInputText,
          instruction: session.currentStep?.instruction || "Do not operate the vehicle to answer the resolution question.",
          question: session.currentStep?.result_question || session.lastMessage,
          completedSteps: session.completedSteps, history: session.messages
        });
        session.pendingInterpretation = null;
        if (interpretation.available && interpretation.intent === "answer" && options.some((item) => item.value === interpretation.selectedResult)) {
          const option = options.find((item) => item.value === interpretation.selectedResult);
          // A model interpretation is a proposal. Only the driver's confirmation changes state.
          session.pendingInterpretation = option.value;
          conversation.record(session, "assistant", `Did you mean: "${option.label}"? Please confirm or choose a different answer below.`);
        } else if (interpretation.available && interpretation.intent === "possible_danger") {
          const validated = detectDanger(message);
          if (validated) conversation.escalate(session, validated.id, dangerMessage(validated));
          else {
            // Backend policy holds the flow until the driver explicitly clarifies the concern.
            session.pendingInterpretation = "danger_confirmation";
            conversation.record(session, "assistant", "Your reply may describe an unsafe condition. Do not perform another check. Are you reporting danger or an unsafe location?");
          }
        } else {
          conversation.clarify(session);
        }
      }
    }
    await session.save();
    return res.status(200).json(conversation.payload(session));
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function stopSession(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (TERMINAL_STATUSES.has(session.status)) {
      return res.status(200).json({ success: true, status: session.status, session: sessionPayload(session) });
    }
    const condition = String(req.body.condition || "User requested professional assistance").slice(0, 200);
    conversation.record(session, "user", condition);
    const danger = detectDanger(condition);
    if (session.driverType) simpleAssistance.stop(session, danger ? dangerMessage(danger) : "Troubleshooting stopped at your request. Professional assistance is available.");
    else conversation.escalate(session, danger?.id || "driver_requested_assistance", danger ? dangerMessage(danger) : "Troubleshooting stopped at your request. Professional assistance is available.");
    await session.save();
    return res.status(200).json({
      success: true,
      stop: true,
      status: "professional_help_required",
      message: session.lastMessage,
      escalationReason: session.escalationReason,
      recommendedService: session.recommendedService,
      session: sessionPayload(session)
    });
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function setResult(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.driverType) {
      if (!["in_progress", "awaiting_resolution_confirmation", "resolved"].includes(session.status) || typeof req.body.resolved !== "boolean") {
        res.status(409);
        throw new Error("An active guidance session and an explicit resolution answer are required.");
      }
      if (session.status === "resolved") return res.status(200).json(simpleAssistance.response(session));
      return res.status(200).json(await simpleAssistance.act(session, req.body.resolved ? "solved" : "still_not_fixed"));
    }
    if (!["awaiting_resolution_confirmation", "resolved"].includes(session.status)) {
      res.status(409);
      throw new Error("Only a completed troubleshooting session can be marked resolved");
    }
    if (typeof req.body.resolved !== "boolean") {
      res.status(400);
      throw new Error("An explicit resolution answer is required");
    }
    if (session.pendingInterpretation === "danger_confirmation") {
      res.status(409);
      throw new Error("Please clarify the possible unsafe condition first");
    }
    if (session.status === "resolved") return res.status(200).json(conversation.payload(session));
    conversation.record(session, "user", req.body.resolved ? "The problem is resolved, with no danger signs" : "The problem remains");
    conversation.resolve(session, req.body.resolved);
    await session.save();
    return res.status(200).json(conversation.payload(session));
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function cancelSession(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (!TERMINAL_STATUSES.has(session.status)) {
      session.status = "cancelled";
      session.currentStepId = null;
      session.currentStep = null;
      session.currentPhase = "completed";
      session.completedAt = new Date();
      await session.save();
    }
    return res.status(200).json({ success: true, status: session.status, session: sessionPayload(session) });
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.driverType) return res.status(200).json(simpleAssistance.response(session));
    return res.status(200).json({ success: true, session: sessionPayload(session) });
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const sessions = await TroubleshootingSession.find({ driverId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    return res.status(200).json({ success: true, sessions: sessions.map((session) =>
      session.driverType ? simpleAssistance.response(session).session : session) });
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function guidanceAction(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (!session.driverType || !["in_progress", "awaiting_resolution_confirmation"].includes(session.status)) {
      res.status(409);
      throw new Error("This guidance session is not active.");
    }
    const { action, selectedResult, stepId } = req.body;
    if (!["solved", "still_not_fixed", "not_sure", "observation"].includes(action)) {
      res.status(400);
      throw new Error("Choose a guidance action.");
    }
    if ((stepId || null) !== (session.currentStepId || null)) {
      res.status(409);
      throw new Error("This step has changed. Reopen the session to continue.");
    }
    if (action === "observation" && !session.currentStep?.possible_results?.some((item) => item.value === selectedResult)) {
      res.status(400);
      throw new Error("Choose an observation from the current step.");
    }
    if (action === "observation") {
      const option = session.currentStep.possible_results.find((item) => item.value === selectedResult);
      const danger = detectDanger(`${option.value}. ${option.label}`);
      if (danger) {
        const safetyHelp = await aiTroubleshootingHelp.getDangerSafetyHelp({
          danger, driverType: session.driverType, vehicleType: session.vehicleType,
          symptoms: `${option.value}. ${option.label}`
        });
        session.safetyActions = safetyHelp.actions;
        session.riskLevel = "HIGH";
        if (safetyHelp.source === "OPENAI") session.troubleshootingSource = "OPENAI";
        simpleAssistance.stop(session, dangerMessage(danger));
        await session.save();
        return res.status(200).json(simpleAssistance.response(session));
      }
    }
    return res.status(200).json(await simpleAssistance.act(session, action, selectedResult));
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

async function askForHelp(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
    if (!question || question.length > 500) {
      res.status(400);
      throw new Error("Enter a question of 1 to 500 characters.");
    }
    if (!session.driverType || session.status !== "in_progress" || !session.currentStep) {
      res.status(409);
      throw new Error("Open an active guidance step to ask for an explanation.");
    }
    return res.status(200).json(await simpleAssistance.explain(session, question));
  } catch (error) {
    if (error.name === "VersionError") res.status(409);
    return next(error);
  }
}

module.exports = {
  guidanceAction,
  askForHelp,
  cancelSession,
  confirmStepAction,
  confirmSafety,
  getHistory,
  getSession,
  setResult,
  startSelfAssistant,
  stopSession,
  submitStep,
  sendMessage
};
