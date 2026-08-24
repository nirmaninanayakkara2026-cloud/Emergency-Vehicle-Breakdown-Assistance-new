const mongoose = require("mongoose");
const BreakdownRequest = require("../models/BreakdownRequest");
const ProviderProfile = require("../models/ProviderProfile");
const TroubleshootingSession = require("../models/TroubleshootingSession");
const {
  PROVIDER_ROLES,
  PROVIDER_STATUS_TRANSITIONS,
  SERVICE_TYPE_MAP,
  mapBreakdownToServiceType
} = require("../utils/domainConstants");
const {
  validateBreakdownRequestInput,
  validateStatusUpdateInput
} = require("../utils/requestValidation");
const {
  getRecommendationsForRequest,
  toPublicRecommendationResult
} = require("../services/recommendationService");
const { getServiceCostRange } = require("../config/serviceCostRanges");
const aiDiagnosisService = require("../services/aiDiagnosisService");
const clarificationService = require("../services/clarificationService");
const { normalizeSymptomCapture } = require("../utils/symptomNormalizer");
const { buildDiagnosticText } = require("../utils/buildDiagnosticText");
const faultServiceMapping = require("../../ai/config/fault_service_mapping.json");

const MAX_CLARIFICATION_ATTEMPTS = 1;
const KNOWN_REQUIRED_SERVICES = new Set([
  ...Object.values(SERVICE_TYPE_MAP),
  ...Object.values(faultServiceMapping)
]);

function isProviderRole(role) {
  return PROVIDER_ROLES.includes(role);
}

function isSameId(a, b) {
  const first = a && a._id ? a._id : a;
  const second = b && b._id ? b._id : b;
  return String(first) === String(second);
}

async function getProviderProfileForUser(userId) {
  return ProviderProfile.findOne({ userId });
}

async function canUserViewRequest(user, request) {
  if (user.role === "admin") return true;
  if (user.role === "driver" && isSameId(request.driverId, user._id)) return true;

  if (isProviderRole(user.role) && request.selectedProviderId) {
    const profile = await getProviderProfileForUser(user._id);
    return profile && isSameId(request.selectedProviderId, profile._id);
  }

  return false;
}

function populateRequest(query) {
  return query
    .populate("driverId", "name phone role")
    .populate("selectedProviderId");
}

async function createBreakdownRequest(req, res, next) {
  try {
    const errors = validateBreakdownRequestInput(req.body);
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const guidedCaptureUsed = Boolean(req.body.symptomCapture);
    const symptomCapture = {
      ...normalizeSymptomCapture(req.body.symptomCapture),
      guidedCaptureUsed
    };
    const builtDiagnosticInputText = buildDiagnosticText({
      vehicleType: req.body.vehicleType,
      breakdownType: req.body.breakdownType,
      symptomCapture,
      problemDescription: req.body.problemDescription
    });
    const suppliedDiagnosticInputText = String(req.body.diagnosticInputText || "").trim();
    const diagnosticInputText = (suppliedDiagnosticInputText || builtDiagnosticInputText).slice(0, 3000);
    let troubleshootingSession = null;
    if (req.body.troubleshootingSessionId) {
      if (!mongoose.Types.ObjectId.isValid(req.body.troubleshootingSessionId)) {
        res.status(400);
        throw new Error("Troubleshooting session id is invalid");
      }
      troubleshootingSession = await TroubleshootingSession.findById(req.body.troubleshootingSessionId);
      if (!troubleshootingSession || !isSameId(troubleshootingSession.driverId, req.user._id)) {
        res.status(403);
        throw new Error("The troubleshooting session does not belong to this driver");
      }
    }
    const carriedRequiredService = KNOWN_REQUIRED_SERVICES.has(req.body.requiredService)
      ? req.body.requiredService
      : null;
    const fallbackRequiredService = troubleshootingSession?.recommendedService || carriedRequiredService ||
      mapBreakdownToServiceType(req.body.breakdownType);
    const aiPrediction = await aiDiagnosisService.diagnoseBreakdown(
      diagnosticInputText,
      { fallbackRequiredService }
    );
    const requiredServiceType = troubleshootingSession?.recommendedService ||
      carriedRequiredService || aiPrediction.requiredService;
    const estimatedCostRange = getServiceCostRange(requiredServiceType);

    const request = await BreakdownRequest.create({
      driverId: req.user._id,
      troubleshootingSessionId: troubleshootingSession?._id || null,
      vehicleType: req.body.vehicleType,
      vehicleModel: req.body.vehicleModel,
      breakdownType: req.body.breakdownType,
      urgencyLevel: req.body.urgencyLevel,
      problemDescription: String(req.body.problemDescription || "").trim(),
      location: req.body.location,
      symptomCapture,
      diagnosticInputText,
      aiPrediction,
      aiPredictionHistory: [aiPrediction],
      requiredServiceType,
      status: "provider_selection",
      estimatedCostRange,
      estimatedCost: {
        minimum: estimatedCostRange.min,
        maximum: estimatedCostRange.max
      }
    });

    return res.status(201).json({
      success: true,
      message: "Breakdown request created successfully",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

async function requestClarification(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const request = await BreakdownRequest.findById(req.params.id);
    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }
    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can request clarification");
    }
    if (!request.aiPrediction || !request.aiPrediction.needsMoreInformation) {
      return res.status(200).json({
        success: true,
        clarificationNeeded: false
      });
    }
    const clarificationAttempts = Number(request.clarificationAttempts || 0);
    if (clarificationAttempts >= MAX_CLARIFICATION_ATTEMPTS) {
      return res.status(200).json({
        success: true,
        clarificationNeeded: false,
        clarificationAvailable: false,
        maximumAttemptsReached: true
      });
    }
    const topPredictions = request.aiPrediction.topPredictions || [];
    if (topPredictions.length < 2) {
      return res.status(200).json({
        success: true,
        clarificationNeeded: true,
        clarificationAvailable: false,
        questions: []
      });
    }

    const clarification = await clarificationService.generateClarificationQuestions({
      vehicleType: request.vehicleType,
      mainBreakdownCategory: request.breakdownType,
      collectedSymptomAnswers: request.symptomCapture,
      diagnosticInputText: request.diagnosticInputText,
      topPredictions,
      confidence: request.aiPrediction.confidence,
      predictionMargin: request.aiPrediction.predictionMargin
    });
    if (!clarification.available) {
      return res.status(200).json({
        success: true,
        clarificationNeeded: true,
        clarificationAvailable: false,
        questions: []
      });
    }

    const questions = clarification.questions.slice(0, 2);
    request.clarificationQuestions = questions;
    request.clarificationAttempts = clarificationAttempts + 1;
    await request.save();
    return res.status(200).json({
      success: true,
      clarificationNeeded: true,
      clarificationAvailable: true,
      questions
    });
  } catch (error) {
    return next(error);
  }
}

function validateClarificationAnswers(answers, questions) {
  if (!Array.isArray(answers) || answers.length < 1 || answers.length > 2) {
    return "Answers must contain one or two items";
  }
  const questionsById = new Map(questions.map((item) => [item.id, item]));
  for (const item of answers) {
    if (!item || !item.questionId || !questionsById.has(item.questionId)) {
      return "Each answer must reference a current clarification question";
    }
    const answer = String(item.answer || "").trim();
    if (!answer || answer.length > 100) {
      return "Each clarification answer must contain at most 100 characters";
    }
    if (!questionsById.get(item.questionId).options.includes(answer)) {
      return "Clarification answers must use one of the supplied options";
    }
  }
  return null;
}

async function submitClarificationAnswers(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }
    const request = await BreakdownRequest.findById(req.params.id);
    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }
    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can submit clarification");
    }

    const questions = (request.clarificationQuestions || []).map((item) =>
      typeof item.toObject === "function" ? item.toObject() : item
    );
    if (!questions.length) {
      res.status(400);
      throw new Error("No active clarification questions are available");
    }
    const validationError = validateClarificationAnswers(req.body.answers, questions);
    if (validationError) {
      res.status(400);
      throw new Error(validationError);
    }

    const questionsById = new Map(questions.map((item) => [item.id, item]));
    const savedAnswers = req.body.answers.map((item) => ({
      questionId: item.questionId,
      question: questionsById.get(item.questionId).question,
      answer: String(item.answer).trim(),
      answeredAt: new Date()
    }));
    const additionalSymptoms = savedAnswers
      .map(
        (item) =>
          `Additional symptom clarification: ${item.question.replace(/[.\s]+$/, "")} Answer: ${item.answer.replace(/[.\s]+$/, "")}.`
      )
      .join(" ");
    const availableOriginalLength = Math.max(0, 3000 - additionalSymptoms.length - 1);
    request.diagnosticInputText = `${String(request.diagnosticInputText || "")
      .slice(0, availableOriginalLength)
      .trim()} ${additionalSymptoms}`.trim();
    request.clarificationAnswers.push(...savedAnswers);
    request.clarificationQuestions = [];

    const fallbackRequiredService = mapBreakdownToServiceType(request.breakdownType);
    const aiPrediction = await aiDiagnosisService.diagnoseBreakdown(
      request.diagnosticInputText,
      { fallbackRequiredService }
    );
    if (!Array.isArray(request.aiPredictionHistory)) {
      request.aiPredictionHistory = [];
    }
    if (!request.aiPredictionHistory.length && request.aiPrediction) {
      request.aiPredictionHistory.push(request.aiPrediction);
    }
    request.aiPredictionHistory.push(aiPrediction);
    request.aiPrediction = aiPrediction;
    request.requiredServiceType = aiPrediction.requiredService;
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Clarification answers saved and fault prediction updated",
      prediction: aiPrediction,
      diagnosticInputText: request.diagnosticInputText,
      clarificationAttempts: request.clarificationAttempts
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyBreakdownRequests(req, res, next) {
  try {
    const requests = await populateRequest(
      BreakdownRequest.find({ driverId: req.user._id }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      message: "Driver breakdown requests fetched successfully",
      data: { requests }
    });
  } catch (error) {
    return next(error);
  }
}

async function getAssignedProviderRequests(req, res, next) {
  try {
    const profile = await getProviderProfileForUser(req.user._id);

    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }

    const requests = await populateRequest(
      BreakdownRequest.find({ selectedProviderId: profile._id }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      message: "Assigned breakdown requests fetched successfully",
      data: { requests }
    });
  } catch (error) {
    return next(error);
  }
}

async function getBreakdownRequestById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const request = await populateRequest(BreakdownRequest.findById(req.params.id));

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!(await canUserViewRequest(req.user, request))) {
      res.status(403);
      throw new Error("You do not have permission to view this request");
    }

    return res.status(200).json({
      success: true,
      message: "Breakdown request fetched successfully",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

async function getBreakdownRequestRecommendations(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can view recommendations");
    }

    const result = toPublicRecommendationResult(await getRecommendationsForRequest(request));

    return res.status(200).json({
      success: true,
      message: result.message,
      data: { ...result, recommendations: result.providers }
    });
  } catch (error) {
    return next(error);
  }
}

async function selectProvider(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const { providerId } = req.body;

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      res.status(400);
      throw new Error("Valid providerId is required");
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can select a provider");
    }

    if (["cancelled", "completed"].includes(request.status)) {
      res.status(400);
      throw new Error("Provider cannot be selected for a completed or cancelled request");
    }

    if (request.selectedProviderId && request.status !== "provider_rejected") {
      res.status(409);
      throw new Error("A provider has already been requested for this breakdown");
    }

    const recommendationResult = await getRecommendationsForRequest(request);
    const recommendation = recommendationResult.providers.find(
      (item) => isSameId(item.providerId, providerId)
    );
    if (!recommendation) {
      res.status(400);
      throw new Error("The selected provider is not currently suitable for this request");
    }

    const provider = await ProviderProfile.findOne({
      _id: providerId,
      isApproved: true,
      isActive: { $ne: false },
      availabilityStatus: "available"
    });

    if (!provider) {
      res.status(404);
      throw new Error("Approved provider not found");
    }

    request.selectedProviderId = provider._id;
    request.status = "provider_requested";
    request.assignedAt = new Date();
    request.providerDistanceKm = recommendation.distanceKm;
    request.rejectedAt = null;
    request.rejectionReason = "";
    request.estimatedCostRange = getServiceCostRange(request.requiredServiceType);
    request.estimatedCost = {
      minimum: request.estimatedCostRange.min,
      maximum: request.estimatedCostRange.max
    };
    await request.save();

    const populatedRequest = await populateRequest(BreakdownRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Provider selected successfully",
      data: { request: populatedRequest }
    });
  } catch (error) {
    return next(error);
  }
}

async function requireSelectedProvider(req, res, request) {
  if (!request.selectedProviderId) {
    res.status(400);
    throw new Error("No provider has been selected for this request");
  }
  const profile = await getProviderProfileForUser(req.user._id);
  if (!profile || !isSameId(request.selectedProviderId, profile._id)) {
    res.status(403);
    throw new Error("Only the selected provider can manage this request");
  }
  return profile;
}

async function acceptBreakdownRequest(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }
    const request = await BreakdownRequest.findById(req.params.id);
    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }
    await requireSelectedProvider(req, res, request);
    if (request.status !== "provider_requested") {
      res.status(409);
      throw new Error("Only a newly requested provider assignment can be accepted");
    }
    const arrival = req.body.estimatedArrivalMinutes;
    if (arrival !== undefined &&
        (!Number.isInteger(Number(arrival)) || Number(arrival) < 1 || Number(arrival) > 1440)) {
      res.status(400);
      throw new Error("Estimated arrival must be between 1 and 1440 minutes");
    }
    request.status = "accepted";
    request.acceptedAt = new Date();
    if (arrival !== undefined) request.estimatedArrivalMinutes = Number(arrival);
    await request.save();
    const populatedRequest = await populateRequest(BreakdownRequest.findById(request._id));
    return res.status(200).json({
      success: true,
      message: "Breakdown request accepted",
      data: { request: populatedRequest }
    });
  } catch (error) {
    return next(error);
  }
}

async function rejectBreakdownRequest(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }
    const request = await BreakdownRequest.findById(req.params.id);
    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }
    const provider = await requireSelectedProvider(req, res, request);
    if (request.status !== "provider_requested") {
      res.status(409);
      throw new Error("Only a pending provider request can be rejected");
    }
    if (!(request.rejectedProviderIds || []).some((id) => isSameId(id, provider._id))) {
      request.rejectedProviderIds.push(provider._id);
    }
    request.status = "provider_rejected";
    request.rejectedAt = new Date();
    request.rejectionReason = String(req.body.reason || "").trim().slice(0, 300);
    request.selectedProviderId = null;
    request.assignedAt = null;
    request.providerDistanceKm = null;
    await request.save();
    return res.status(200).json({
      success: true,
      message: "Provider declined the request. The driver can select another provider.",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

async function updateBreakdownRequestStatus(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const errors = validateStatusUpdateInput(req.body.status);
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    const providerProfile = await requireSelectedProvider(req, res, request);

    if (request.status === "cancelled") {
      res.status(400);
      throw new Error("Cancelled requests cannot be updated");
    }

    const allowedNext = PROVIDER_STATUS_TRANSITIONS[request.status] || [];
    if (!allowedNext.includes(req.body.status)) {
      res.status(409);
      throw new Error(`Request cannot move from ${request.status} to ${req.body.status}`);
    }

    const now = new Date();
    request.status = req.body.status;
    if (["provider_en_route", "on_the_way"].includes(req.body.status)) request.enRouteAt = now;
    if (req.body.status === "arrived") request.arrivedAt = now;
    if (req.body.status === "in_progress") request.workStartedAt = now;
    if (req.body.status === "completed") {
      if (req.body.finalCost !== undefined &&
          (!Number.isFinite(Number(req.body.finalCost)) || Number(req.body.finalCost) < 0)) {
        res.status(400);
        throw new Error("Final cost must be a non-negative number");
      }
      request.completedAt = now;
      if (req.body.finalCost !== undefined) request.finalCost = Number(req.body.finalCost);
      providerProfile.completedJobs = Number(providerProfile.completedJobs || 0) + 1;
      await providerProfile.save();
    }
    await request.save();

    const populatedRequest = await populateRequest(BreakdownRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Breakdown request status updated successfully",
      data: { request: populatedRequest }
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelBreakdownRequest(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can cancel it");
    }

    if (request.status === "completed") {
      res.status(400);
      throw new Error("Completed requests cannot be cancelled");
    }

    request.status = "cancelled";
    request.cancelledAt = new Date();
    request.cancellationReason = String(req.body.reason || "").trim().slice(0, 300);
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Breakdown request cancelled successfully",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

async function reviewBreakdownRequest(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }
    const request = await BreakdownRequest.findById(req.params.id);
    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }
    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can review it");
    }
    if (request.status !== "completed") {
      res.status(409);
      throw new Error("A review can only be submitted after the job is completed");
    }
    if (request.review) {
      res.status(409);
      throw new Error("A review has already been submitted for this request");
    }
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400);
      throw new Error("Rating must be an integer from 1 to 5");
    }
    const comment = String(req.body.comment || "").trim();
    if (comment.length > 500) {
      res.status(400);
      throw new Error("Review comment must contain at most 500 characters");
    }
    if (!request.selectedProviderId) {
      res.status(400);
      throw new Error("The completed request has no provider to review");
    }
    const provider = await ProviderProfile.findById(request.selectedProviderId);
    if (!provider) {
      res.status(404);
      throw new Error("Selected provider not found");
    }
    const previousReviews = Number(provider.totalReviews || 0);
    const previousAverage = Number(provider.averageRating || 0);
    provider.averageRating = Number(
      ((previousAverage * previousReviews + rating) / (previousReviews + 1)).toFixed(2)
    );
    provider.totalReviews = previousReviews + 1;
    request.review = { rating, comment, submittedAt: new Date() };
    await provider.save();
    await request.save();
    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      data: {
        review: request.review,
        providerRating: provider.averageRating,
        providerTotalReviews: provider.totalReviews
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  acceptBreakdownRequest,
  cancelBreakdownRequest,
  createBreakdownRequest,
  getAssignedProviderRequests,
  getBreakdownRequestById,
  getBreakdownRequestRecommendations,
  getMyBreakdownRequests,
  requestClarification,
  rejectBreakdownRequest,
  reviewBreakdownRequest,
  selectProvider,
  submitClarificationAnswers,
  updateBreakdownRequestStatus
};
