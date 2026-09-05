function asObject(value) {
  if (!value) return null;
  return typeof value.toObject === "function" ? value.toObject() : { ...value };
}

function populated(value) {
  return value &&
    typeof value === "object" &&
    !Buffer.isBuffer(value) &&
    value._bsontype !== "ObjectId" &&
    value.constructor?.name !== "ObjectId";
}

function buildBreakdownRequestResponse(breakdownRequest, assignment, provider) {
  const request = asObject(breakdownRequest) || {};
  const normalizedAssignment = asObject(assignment) ||
    (populated(request.currentAssignmentId) &&
      (request.currentAssignmentId.status || request.currentAssignmentId.providerId)
      ? asObject(request.currentAssignmentId)
      : null);
  const assignmentProvider = normalizedAssignment?.providerId;
  const compatibleProvider = provider ||
    (populated(assignmentProvider) ? assignmentProvider : null) ||
    (populated(request.selectedProviderId) ? request.selectedProviderId : null);
  const providerId = compatibleProvider || assignmentProvider || request.selectedProviderId || null;

  return {
    ...request,
    currentAssignmentId: normalizedAssignment?._id || request.currentAssignmentId || null,
    selectedProviderId: providerId,
    providerDistanceKm:
      normalizedAssignment?.recommendationSnapshot?.distanceKm ?? request.providerDistanceKm ?? null,
    estimatedArrivalMinutes:
      normalizedAssignment?.estimatedArrivalMinutes ?? request.estimatedArrivalMinutes ?? null,
    assignedAt: normalizedAssignment?.requestedAt ?? request.assignedAt ?? null,
    acceptedAt: normalizedAssignment?.acceptedAt ?? request.acceptedAt ?? null,
    rejectedAt: normalizedAssignment?.rejectedAt ?? request.rejectedAt ?? null,
    rejectionReason:
      normalizedAssignment?.rejectionReason ?? request.rejectionReason ?? "",
    enRouteAt: normalizedAssignment?.enRouteAt ?? request.enRouteAt ?? null,
    arrivedAt: normalizedAssignment?.arrivedAt ?? request.arrivedAt ?? null,
    workStartedAt: normalizedAssignment?.inProgressAt ?? request.workStartedAt ?? null,
    completedAt: normalizedAssignment?.completedAt ?? request.completedAt ?? null,
    cancelledAt: normalizedAssignment?.cancelledAt ?? request.cancelledAt ?? null
  };
}

module.exports = { buildBreakdownRequestResponse };
