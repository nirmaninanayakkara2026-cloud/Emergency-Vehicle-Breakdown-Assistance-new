const RequestAssignment = require("../models/RequestAssignment");
const { createRequestEvent } = require("./requestEventService");
const { runWithOptionalTransaction } = require("./transactionService");

const ASSIGNMENT_TRANSITIONS = Object.freeze({
  requested: ["accepted"],
  accepted: ["provider_en_route"],
  provider_en_route: ["arrived"],
  arrived: ["in_progress"],
  in_progress: ["completed"]
});

const REQUEST_TO_ASSIGNMENT_STATUS = Object.freeze({
  provider_requested: "requested",
  accepted: "accepted",
  on_the_way: "provider_en_route",
  provider_en_route: "provider_en_route",
  arrived: "arrived",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  provider_rejected: "rejected"
});

const STATUS_TIMESTAMPS = Object.freeze({
  accepted: "acceptedAt",
  rejected: "rejectedAt",
  provider_en_route: "enRouteAt",
  arrived: "arrivedAt",
  in_progress: "inProgressAt",
  completed: "completedAt",
  cancelled: "cancelledAt"
});

function sameId(first, second) {
  const a = first?._id || first;
  const b = second?._id || second;
  return Boolean(a && b) && String(a) === String(b);
}

async function createDocument(Model, payload, session) {
  if (!session) return Model.create(payload);
  const [document] = await Model.create([payload], { session });
  return document;
}

async function saveDocument(document, session) {
  return document.save(session ? { session } : undefined);
}

function snapshotFields(document, fields) {
  return Object.fromEntries(fields.map((field) => {
    const value = document[field];
    return [field, Array.isArray(value) ? [...value] : value];
  }));
}

async function persistPairedDocuments({ assignment, request, session, assignmentFields, requestFields, mutate }) {
  const assignmentBefore = snapshotFields(assignment, assignmentFields);
  const requestBefore = snapshotFields(request, requestFields);
  mutate();
  try {
    await saveDocument(assignment, session);
    await saveDocument(request, session);
  } catch (error) {
    if (!session) {
      Object.assign(assignment, assignmentBefore);
      Object.assign(request, requestBefore);
      try {
        await saveDocument(assignment);
        await saveDocument(request);
      } catch (_rollbackError) {
        error.partialWrite = {
          assignmentId: assignment._id,
          requestId: request._id,
          rollbackFailed: true
        };
      }
    }
    throw error;
  }
}

function recommendationSnapshot(recommendation = {}) {
  return {
    distanceKm: recommendation.distanceKm ?? null,
    rating: recommendation.rating ?? null,
    responseTime: recommendation.averageResponseTime ?? recommendation.responseTimeMinutes ?? null,
    serviceMatch: recommendation.matchType || "",
    recommendationScore: recommendation.recommendationScore ?? null
  };
}

async function getCurrentAssignment(request, options = {}) {
  const current = request?.currentAssignmentId;
  if (current && typeof current === "object" && current.status) return current;
  if (!current) return null;
  let query = RequestAssignment.findById(current);
  if (options.populateProvider && query?.populate) query = query.populate("providerId");
  return query;
}

async function createLegacyAssignment(request, session) {
  if (!request.selectedProviderId) return null;
  const existing = await RequestAssignment.findOne({
    breakdownRequestId: request._id,
    providerId: request.selectedProviderId,
    status: { $nin: ["rejected", "cancelled"] }
  });
  if (existing) return existing;
  return createDocument(RequestAssignment, {
    breakdownRequestId: request._id,
    providerId: request.selectedProviderId,
    status: REQUEST_TO_ASSIGNMENT_STATUS[request.status] || "requested",
    recommendationSnapshot: { distanceKm: request.providerDistanceKm ?? null },
    estimatedArrivalMinutes: request.estimatedArrivalMinutes ?? null,
    rejectionReason: request.rejectionReason || "",
    requestedAt: request.assignedAt || null,
    acceptedAt: request.acceptedAt || null,
    rejectedAt: request.rejectedAt || null,
    enRouteAt: request.enRouteAt || null,
    arrivedAt: request.arrivedAt || null,
    inProgressAt: request.workStartedAt || null,
    completedAt: request.completedAt || null,
    cancelledAt: request.cancelledAt || null
  }, session);
}

async function ensureCurrentAssignment(request, session = null) {
  let assignment = await getCurrentAssignment(request);
  if (!assignment) assignment = await createLegacyAssignment(request, session);
  if (assignment && !request.currentAssignmentId) request.currentAssignmentId = assignment._id;
  return assignment;
}

async function createAssignment({ request, provider, recommendation, actor }) {
  let createdAssignment;
  const original = {
    currentAssignmentId: request.currentAssignmentId,
    selectedProviderId: request.selectedProviderId,
    status: request.status,
    assignedAt: request.assignedAt,
    providerDistanceKm: request.providerDistanceKm
  };

  try {
    createdAssignment = await runWithOptionalTransaction(async (session) => {
      const now = new Date();
      createdAssignment = await createDocument(RequestAssignment, {
        breakdownRequestId: request._id,
        providerId: provider._id || provider,
        status: "requested",
        recommendationSnapshot: recommendationSnapshot(recommendation),
        requestedAt: now
      }, session);
      request.currentAssignmentId = createdAssignment._id;
      request.status = "provider_requested";
      // Deprecated response mirrors retained during Stage 1.
      request.selectedProviderId = provider._id || provider;
      request.assignedAt = now;
      request.providerDistanceKm = recommendation.distanceKm ?? null;
      request.rejectedAt = null;
      request.rejectionReason = "";
      await saveDocument(request, session);
      return createdAssignment;
    });
  } catch (error) {
    Object.assign(request, original);
    if (createdAssignment?._id) {
      try {
        await RequestAssignment.deleteOne({ _id: createdAssignment._id });
      } catch (rollbackError) {
        error.partialWrite = { assignmentId: createdAssignment._id, rollbackFailed: true };
      }
    }
    throw error;
  }

  await createRequestEvent({
    breakdownRequestId: request._id,
    requestAssignmentId: createdAssignment._id,
    actorId: actor?._id,
    actorRole: actor?.role || "driver",
    eventType: "provider_selected",
    fromStatus: original.status,
    toStatus: "provider_requested",
    message: "Driver selected a provider."
  });
  return createdAssignment;
}

async function acceptAssignment({ request, providerId, estimatedArrivalMinutes, actor }) {
  const assignment = await ensureCurrentAssignment(request);
  if (!assignment) throw new Error("No provider has been selected for this request");
  if (!sameId(assignment.providerId, providerId)) {
    const error = new Error("Only the selected provider can manage this request");
    error.statusCode = 403;
    throw error;
  }
  if (assignment.status !== "requested") {
    const error = new Error("Only a newly requested provider assignment can be accepted");
    error.statusCode = 409;
    throw error;
  }
  const now = new Date();
  await runWithOptionalTransaction(async (session) => {
    await persistPairedDocuments({
      assignment,
      request,
      session,
      assignmentFields: ["status", "acceptedAt", "estimatedArrivalMinutes"],
      requestFields: ["currentAssignmentId", "status", "acceptedAt", "estimatedArrivalMinutes"],
      mutate() {
        assignment.status = "accepted";
        assignment.acceptedAt = now;
        if (estimatedArrivalMinutes !== undefined) {
          assignment.estimatedArrivalMinutes = Number(estimatedArrivalMinutes);
        }
        request.currentAssignmentId = assignment._id;
        request.status = "accepted";
        request.acceptedAt = now;
        if (estimatedArrivalMinutes !== undefined) {
          request.estimatedArrivalMinutes = Number(estimatedArrivalMinutes);
        }
      }
    });
  });
  await createRequestEvent({
    breakdownRequestId: request._id,
    requestAssignmentId: assignment._id,
    actorId: actor?._id,
    actorRole: actor?.role || "provider",
    eventType: "provider_accepted",
    fromStatus: "provider_requested",
    toStatus: "accepted",
    message: "Provider accepted the request."
  });
  return assignment;
}

async function rejectAssignment({ request, providerId, reason, actor }) {
  const assignment = await ensureCurrentAssignment(request);
  if (!assignment) throw new Error("No provider has been selected for this request");
  if (!sameId(assignment.providerId, providerId)) {
    const error = new Error("Only the selected provider can manage this request");
    error.statusCode = 403;
    throw error;
  }
  if (assignment.status !== "requested") {
    const error = new Error("Only a pending provider request can be rejected");
    error.statusCode = 409;
    throw error;
  }
  const now = new Date();
  const rejectionReason = String(reason || "").trim().slice(0, 300);
  await runWithOptionalTransaction(async (session) => {
    await persistPairedDocuments({
      assignment,
      request,
      session,
      assignmentFields: ["status", "rejectedAt", "rejectionReason"],
      requestFields: ["rejectedProviderIds", "currentAssignmentId", "status", "rejectedAt", "rejectionReason", "selectedProviderId", "assignedAt", "providerDistanceKm"],
      mutate() {
        assignment.status = "rejected";
        assignment.rejectedAt = now;
        assignment.rejectionReason = rejectionReason;
        if (!(request.rejectedProviderIds || []).some((id) => sameId(id, providerId))) {
          request.rejectedProviderIds.push(providerId);
        }
        request.currentAssignmentId = null;
        request.status = "provider_rejected";
        request.rejectedAt = now;
        request.rejectionReason = rejectionReason;
        request.selectedProviderId = null;
        request.assignedAt = null;
        request.providerDistanceKm = null;
      }
    });
  });
  await createRequestEvent({
    breakdownRequestId: request._id,
    requestAssignmentId: assignment._id,
    actorId: actor?._id,
    actorRole: actor?.role || "provider",
    eventType: "provider_rejected",
    fromStatus: "provider_requested",
    toStatus: "provider_rejected",
    message: "Provider declined the request."
  });
  return assignment;
}

async function updateAssignmentStatus({ request, providerId, status, finalCost, completionNote, actor }) {
  const normalizedStatus = status === "on_the_way" ? "provider_en_route" : status;
  const assignment = await ensureCurrentAssignment(request);
  if (!assignment) throw new Error("No provider has been selected for this request");
  if (!sameId(assignment.providerId, providerId)) {
    const error = new Error("Only the selected provider can manage this request");
    error.statusCode = 403;
    throw error;
  }
  const allowed = ASSIGNMENT_TRANSITIONS[assignment.status] || [];
  if (!allowed.includes(normalizedStatus)) {
    const error = new Error(`Request cannot move from ${assignment.status} to ${normalizedStatus}`);
    error.statusCode = 409;
    throw error;
  }
  const previousStatus = request.status;
  const now = new Date();
  await runWithOptionalTransaction(async (session) => {
    await persistPairedDocuments({
      assignment,
      request,
      session,
      assignmentFields: ["status", STATUS_TIMESTAMPS[normalizedStatus]],
      requestFields: ["currentAssignmentId", "status", "enRouteAt", "arrivedAt", "workStartedAt", "completedAt", "finalCost", "completionNote"],
      mutate() {
        assignment.status = normalizedStatus;
        assignment[STATUS_TIMESTAMPS[normalizedStatus]] = now;
        request.currentAssignmentId = assignment._id;
        request.status = normalizedStatus;
        if (normalizedStatus === "provider_en_route") request.enRouteAt = now;
        if (normalizedStatus === "arrived") request.arrivedAt = now;
        if (normalizedStatus === "in_progress") request.workStartedAt = now;
        if (normalizedStatus === "completed") {
          request.completedAt = now;
          request.finalCost = Number(finalCost);
          request.completionNote = String(completionNote || "").trim();
        }
      }
    });
  });
  const eventTypes = {
    provider_en_route: "provider_en_route",
    arrived: "provider_arrived",
    in_progress: "repair_started",
    completed: "repair_completed"
  };
  await createRequestEvent({
    breakdownRequestId: request._id,
    requestAssignmentId: assignment._id,
    actorId: actor?._id,
    actorRole: actor?.role || "provider",
    eventType: eventTypes[normalizedStatus],
    fromStatus: previousStatus,
    toStatus: normalizedStatus,
    message: "Request status updated by the assigned provider."
  });
  return assignment;
}

async function cancelAssignment({ request, reason, actor }) {
  const assignment = await ensureCurrentAssignment(request);
  const previousStatus = request.status;
  const now = new Date();
  await runWithOptionalTransaction(async (session) => {
    if (assignment && !["rejected", "completed", "cancelled"].includes(assignment.status)) {
      await persistPairedDocuments({
        assignment,
        request,
        session,
        assignmentFields: ["status", "cancelledAt"],
        requestFields: ["status", "cancelledAt", "cancellationReason"],
        mutate() {
          assignment.status = "cancelled";
          assignment.cancelledAt = now;
          request.status = "cancelled";
          request.cancelledAt = now;
          request.cancellationReason = String(reason || "").trim().slice(0, 300);
        }
      });
    } else {
      request.status = "cancelled";
      request.cancelledAt = now;
      request.cancellationReason = String(reason || "").trim().slice(0, 300);
      await saveDocument(request, session);
    }
  });
  await createRequestEvent({
    breakdownRequestId: request._id,
    requestAssignmentId: assignment?._id,
    actorId: actor?._id,
    actorRole: actor?.role || "driver",
    eventType: "request_cancelled",
    fromStatus: previousStatus,
    toStatus: "cancelled",
    message: "Driver cancelled the request."
  });
  return assignment;
}

async function getRejectedProviderIds(request) {
  const legacyIds = (request?.rejectedProviderIds || []).map((id) => id?._id || id);
  if (!request?._id) return legacyIds;
  const normalizedIds = await RequestAssignment.distinct("providerId", {
    breakdownRequestId: request._id,
    status: "rejected"
  });
  return [...new Map([...legacyIds, ...normalizedIds].map((id) => [String(id), id])).values()];
}

module.exports = {
  ASSIGNMENT_TRANSITIONS,
  REQUEST_TO_ASSIGNMENT_STATUS,
  acceptAssignment,
  cancelAssignment,
  createAssignment,
  ensureCurrentAssignment,
  getCurrentAssignment,
  getRejectedProviderIds,
  rejectAssignment,
  sameId,
  updateAssignmentStatus
};
