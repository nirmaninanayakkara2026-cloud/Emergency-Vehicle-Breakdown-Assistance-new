const mongoose = require("mongoose");
const TroubleshootingSession = require("../models/TroubleshootingSession");
const structuredProblemRoutingService = require("../services/structuredProblemRoutingService");
const ai2Service = require("../services/ai2TroubleshootingService");
const { buildDiagnosticText } = require("../utils/buildDiagnosticText");
const { normalizeSymptomCapture } = require("../utils/symptomNormalizer");
const { mapBreakdownToServiceType, VEHICLE_TYPES } = require("../utils/domainConstants");
const faultServiceMapping = require("../../ai/config/fault_service_mapping.json");

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
    if (!breakdownType || String(breakdownType).length > 100) {
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
      beforeYouBegin: guide.before_you_begin
    };

    if (guide.risk_level === "HIGH" || guide.professional_help_required) {
      const session = await TroubleshootingSession.create({
        ...baseSession,
        status: "professional_help_required",
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
    await session.save();
    return res.status(200).json({
      success: true,
      status: "in_progress",
      currentStep: result.current_step,
      session: sessionPayload(session)
    });
  } catch (error) {
    return next(error);
  }
}

async function confirmStepAction(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
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
    await session.save();
    return res.status(200).json({
      success: true,
      status: "in_progress",
      currentPhase: "result",
      currentStep: session.currentStep,
      session: sessionPayload(session)
    });
  } catch (error) {
    return next(error);
  }
}

async function submitStep(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (session.status !== "in_progress") {
      res.status(409);
      throw new Error("This troubleshooting session is not active");
    }
    const stepId = String(req.body.stepId || "");
    const selectedResult = String(req.body.selectedResult || "");
    if (!stepId || stepId !== session.currentStepId || !selectedResult) {
      res.status(400);
      throw new Error("The current step and selected result are required");
    }
    if (session.currentPhase !== "result") {
      res.status(409);
      throw new Error("Confirm the approved instruction before selecting a result");
    }
    const result = await ai2Service.processStep(
      session.guideId,
      stepId,
      selectedResult
    );
    if (result.status === "troubleshooting_unavailable") return unavailableResponse(res);
    const currentStep = session.currentStep || {};
    const selectedOption = (currentStep.possible_results || []).find(
      (item) => item.value === selectedResult
    );
    session.completedSteps.push({
      stepId,
      instruction: currentStep.instruction || "",
      instructionConfirmed: true,
      selectedResult,
      resultLabel: selectedOption?.label || (selectedResult === "not_sure" ? "Not Sure" : selectedResult),
      completedAt: new Date()
    });
    if (result.status === "in_progress" && result.next_step) {
      session.currentStepId = result.next_step.step_id;
      session.currentStep = result.next_step;
      session.currentPhase = "instruction";
      session.currentInstructionConfirmedAt = null;
    } else if (result.status === "resolved") {
      session.status = "awaiting_resolution_confirmation";
      session.currentStepId = null;
      session.currentStep = null;
      session.currentPhase = "completed";
    } else {
      session.status = "professional_help_required";
      session.currentStepId = null;
      session.currentStep = null;
      session.currentPhase = "completed";
      session.completedAt = new Date();
    }
    await session.save();
    return res.status(200).json({
      success: true,
      status: result.status,
      nextStep: result.next_step,
      message: result.message,
      recommendedService: result.recommended_service || session.recommendedService,
      session: sessionPayload(session)
    });
  } catch (error) {
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
    const result = session.guideId
      ? await ai2Service.checkStopCondition(session.guideId, condition)
      : null;
    session.status = "professional_help_required";
    session.currentStepId = null;
    session.currentStep = null;
    session.currentPhase = "completed";
    session.completedAt = new Date();
    await session.save();
    return res.status(200).json({
      success: true,
      stop: true,
      status: "professional_help_required",
      message: result?.message || "Troubleshooting stopped. Professional assistance is recommended.",
      recommendedService: session.recommendedService,
      session: sessionPayload(session)
    });
  } catch (error) {
    return next(error);
  }
}

async function setResult(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    if (!["awaiting_resolution_confirmation", "resolved"].includes(session.status)) {
      res.status(409);
      throw new Error("Only a completed troubleshooting session can be marked resolved");
    }
    const resolved = req.body.resolved === true;
    session.status = resolved ? "resolved" : "professional_help_required";
    session.currentStepId = null;
    session.currentStep = null;
    session.currentPhase = "completed";
    session.completedAt = new Date();
    await session.save();
    return res.status(200).json({ success: true, status: session.status, session: sessionPayload(session) });
  } catch (error) {
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
    return next(error);
  }
}

async function getSession(req, res, next) {
  try {
    const session = await findOwnedSession(req, res);
    return res.status(200).json({ success: true, session: sessionPayload(session) });
  } catch (error) {
    return next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const sessions = await TroubleshootingSession.find({ driverId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);
    return res.status(200).json({ success: true, sessions });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelSession,
  confirmStepAction,
  confirmSafety,
  getHistory,
  getSession,
  setResult,
  startSelfAssistant,
  stopSession,
  submitStep
};
