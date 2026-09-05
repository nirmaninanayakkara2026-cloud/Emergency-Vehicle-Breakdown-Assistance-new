const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const BreakdownRequest = require("../src/models/BreakdownRequest");
const RequestAssignment = require("../src/models/RequestAssignment");
const RequestEvent = require("../src/models/RequestEvent");
const Review = require("../src/models/Review");
const TroubleshootingSession = require("../src/models/TroubleshootingSession");
const controller = require("../src/controllers/breakdownRequestController");
const recommendationService = require("../src/services/providerRecommendationService");
const {
  acceptAssignment,
  cancelAssignment,
  createAssignment,
  getRejectedProviderIds,
  rejectAssignment,
  updateAssignmentStatus,
} = require("../src/services/requestAssignmentService");
const { createRequestEvent } = require("../src/services/requestEventService");
const {
  buildBreakdownRequestResponse,
} = require("../src/utils/breakdownRequestResponse");
const {
  migrateNormalizedCollections,
} = require("../scripts/migrateNormalizedCollections");

function savedDocument(values = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    async save() {
      this.saveCount = Number(this.saveCount || 0) + 1;
    },
    ...values,
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

async function invoke(handler, req) {
  const res = response();
  let error;
  await handler(req, res, (value) => {
    error = value;
  });
  return { res, error };
}

function populatedQuery(value) {
  return {
    populate() {
      return this;
    },
    then(resolve) {
      return Promise.resolve(resolve(value));
    },
  };
}

test("normalized collections and relationship indexes are configured", () => {
  assert.equal(
    RequestAssignment.collection.collectionName,
    "requestAssignments",
  );
  assert.equal(Review.collection.collectionName, "reviews");
  assert.equal(RequestEvent.collection.collectionName, "requestEvents");
  assert.equal(
    BreakdownRequest.schema.path("currentAssignmentId").options.ref,
    "RequestAssignment",
  );
  assert.equal(
    TroubleshootingSession.schema.path("breakdownRequestId").options.ref,
    "BreakdownRequest",
  );

  const assignmentIndexes = RequestAssignment.schema
    .indexes()
    .map(([fields]) => fields);
  assert.ok(
    assignmentIndexes.some(
      (index) => index.breakdownRequestId === 1 && index.status === 1,
    ),
  );
  assert.ok(
    assignmentIndexes.some(
      (index) => index.providerId === 1 && index.status === 1,
    ),
  );
  const reviewIndex = Review.schema
    .indexes()
    .find(([fields]) => fields.breakdownRequestId === 1);
  assert.equal(reviewIndex[1].unique, true);
});

test("selecting a provider creates an authoritative requested assignment and compatibility mirror", async () => {
  const provider = savedDocument();
  const request = savedDocument({
    status: "provider_selection",
    selectedProviderId: null,
    currentAssignmentId: null,
    rejectedProviderIds: [],
  });
  const originalCreate = RequestAssignment.create;
  let stored;
  RequestAssignment.create = async (payload) => {
    stored = savedDocument(payload);
    return stored;
  };
  try {
    const assignment = await createAssignment({
      request,
      provider,
      recommendation: {
        distanceKm: 3.2,
        rating: 4.7,
        averageResponseTime: 18,
        matchType: "exact",
        recommendationScore: 91,
      },
      actor: { _id: new mongoose.Types.ObjectId(), role: "driver" },
    });
    assert.equal(assignment.status, "requested");
    assert.equal(assignment.recommendationSnapshot.distanceKm, 3.2);
    assert.equal(request.status, "provider_requested");
    assert.equal(String(request.currentAssignmentId), String(stored._id));
    assert.equal(String(request.selectedProviderId), String(provider._id));
  } finally {
    RequestAssignment.create = originalCreate;
  }
});

test("provider acceptance updates both assignment and request", async () => {
  const providerId = new mongoose.Types.ObjectId();
  const assignment = savedDocument({ providerId, status: "requested" });
  const request = savedDocument({
    status: "provider_requested",
    currentAssignmentId: assignment,
  });
  await acceptAssignment({ request, providerId, estimatedArrivalMinutes: 25 });
  assert.equal(assignment.status, "accepted");
  assert.equal(assignment.estimatedArrivalMinutes, 25);
  assert.equal(request.status, "accepted");
  assert.equal(request.estimatedArrivalMinutes, 25);
});

test("assignment lifecycle permits only sequential provider status changes", async () => {
  const providerId = new mongoose.Types.ObjectId();
  const assignment = savedDocument({ providerId, status: "accepted" });
  const request = savedDocument({
    status: "accepted",
    currentAssignmentId: assignment,
  });
  const originalFindById = RequestAssignment.findById;
  RequestAssignment.findById = async () => assignment;
  try {
    for (const status of [
      "provider_en_route",
      "arrived",
      "in_progress",
      "completed",
    ]) {
      await updateAssignmentStatus({
        request,
        providerId,
        status,
        finalCost: status === "completed" ? 7200 : undefined,
      });
      assert.equal(assignment.status, status);
      assert.equal(request.status, status);
    }
    assert.equal(request.finalCost, 7200);
    await assert.rejects(
      () => updateAssignmentStatus({ request, providerId, status: "arrived" }),
      /cannot move/,
    );
  } finally {
    RequestAssignment.findById = originalFindById;
  }
});

test("provider rejection records history and reopens the request for selection", async () => {
  const providerId = new mongoose.Types.ObjectId();
  const assignment = savedDocument({ providerId, status: "requested" });
  const request = savedDocument({
    status: "provider_requested",
    currentAssignmentId: assignment,
    selectedProviderId: providerId,
    rejectedProviderIds: [],
  });
  await rejectAssignment({ request, providerId, reason: "Unavailable" });
  assert.equal(assignment.status, "rejected");
  assert.equal(assignment.rejectionReason, "Unavailable");
  assert.equal(request.status, "provider_rejected");
  assert.equal(request.currentAssignmentId, null);
  assert.equal(request.selectedProviderId, null);
  assert.equal(String(request.rejectedProviderIds[0]), String(providerId));
});

test("rejected provider lookup merges normalized and legacy history", async () => {
  const legacyId = new mongoose.Types.ObjectId();
  const normalizedId = new mongoose.Types.ObjectId();
  const originalDistinct = RequestAssignment.distinct;
  RequestAssignment.distinct = async () => [normalizedId, legacyId];
  try {
    const ids = await getRejectedProviderIds({
      _id: new mongoose.Types.ObjectId(),
      rejectedProviderIds: [legacyId],
    });
    assert.deepEqual(ids.map(String), [String(legacyId), String(normalizedId)]);
  } finally {
    RequestAssignment.distinct = originalDistinct;
  }
});

test("normalized rejection history excludes the provider from recommendations", async () => {
  const provider = {
    _id: new mongoose.Types.ObjectId(),
    providerType: "mechanic",
    businessName: "Brake Specialist",
    specializations: ["brake_mechanic"],
    serviceCategories: [],
    supportedVehicleTypes: ["car"],
    location: { latitude: 6.9271, longitude: 79.8612 },
    availabilityStatus: "online",
    serviceRadiusKm: 25,
    averageRating: 4.5,
    totalReviews: 10,
    averageResponseTimeMinutes: 15,
    approvalStatus: "approved",
    isApproved: true,
    isActive: true,
  };
  const originalDistinct = RequestAssignment.distinct;
  const originalProviderFind = require("../src/models/ProviderProfile").find;
  RequestAssignment.distinct = async () => [provider._id];
  require("../src/models/ProviderProfile").find = async () => [provider];
  try {
    const result = await recommendationService.getRecommendationsForRequest({
      _id: new mongoose.Types.ObjectId(),
      requiredServiceType: "brake_mechanic",
      location: { latitude: 6.9271, longitude: 79.8612 },
      vehicleType: "car",
      breakdownType: "brake_problem",
      rejectedProviderIds: [],
    });
    assert.deepEqual(result.providers, []);
  } finally {
    RequestAssignment.distinct = originalDistinct;
    require("../src/models/ProviderProfile").find = originalProviderFind;
  }
});

test("cancelling a request cancels its active assignment", async () => {
  const assignment = savedDocument({
    providerId: new mongoose.Types.ObjectId(),
    status: "accepted",
  });
  const request = savedDocument({
    status: "accepted",
    currentAssignmentId: assignment,
  });
  await cancelAssignment({ request, reason: "No longer needed" });
  assert.equal(assignment.status, "cancelled");
  assert.equal(request.status, "cancelled");
  assert.equal(request.cancellationReason, "No longer needed");
});

test("providers cannot accept or update another provider's assignment", async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const otherId = new mongoose.Types.ObjectId();
  const assignment = savedDocument({
    providerId: ownerId,
    status: "requested",
  });
  const request = savedDocument({
    status: "provider_requested",
    currentAssignmentId: assignment,
  });
  await assert.rejects(
    () => acceptAssignment({ request, providerId: otherId }),
    (error) => error.statusCode === 403,
  );
  assignment.status = "accepted";
  await assert.rejects(
    () =>
      updateAssignmentStatus({
        request,
        providerId: otherId,
        status: "provider_en_route",
      }),
    (error) => error.statusCode === 403,
  );
});

test("a driver cannot access another driver's normalized request", async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const otherDriverId = new mongoose.Types.ObjectId();
  const request = savedDocument({
    driverId: ownerId,
    status: "accepted",
    currentAssignmentId: null,
  });
  const originalFindById = BreakdownRequest.findById;
  BreakdownRequest.findById = () => populatedQuery(request);
  try {
    const { res, error } = await invoke(controller.getBreakdownRequestById, {
      params: { id: String(request._id) },
      user: { _id: otherDriverId, role: "driver" },
    });
    assert.equal(res.statusCode, 403);
    assert.match(error.message, /permission/);
  } finally {
    BreakdownRequest.findById = originalFindById;
  }
});

test("response adapter preserves the existing mobile tracking shape", () => {
  const provider = {
    _id: new mongoose.Types.ObjectId(),
    businessName: "Central Garage",
  };
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: provider._id,
    status: "accepted",
    estimatedArrivalMinutes: 20,
    acceptedAt: new Date("2026-08-24T10:00:00Z"),
    recommendationSnapshot: { distanceKm: 4.25, recommendationScore: 92 },
  };
  const result = buildBreakdownRequestResponse(
    {
      _id: new mongoose.Types.ObjectId(),
      status: "accepted",
      selectedProviderId: null,
    },
    assignment,
    provider,
  );
  assert.equal(result.selectedProviderId.businessName, "Central Garage");
  assert.equal(result.estimatedArrivalMinutes, 20);
  assert.equal(result.providerDistanceKm, 4.25);
  assert.equal(result.acceptedAt.toISOString(), "2026-08-24T10:00:00.000Z");
  assert.equal(result.recommendationSnapshot, undefined);
});

test("duplicate normalized reviews are rejected before aggregates change", async () => {
  const driverId = new mongoose.Types.ObjectId();
  const request = savedDocument({
    driverId,
    status: "completed",
    review: null,
  });
  const originalRequestFind = BreakdownRequest.findById;
  const originalReviewFind = Review.findOne;
  BreakdownRequest.findById = async () => request;
  Review.findOne = async () => ({ _id: new mongoose.Types.ObjectId() });
  try {
    const { res, error } = await invoke(controller.reviewBreakdownRequest, {
      params: { id: String(request._id) },
      user: { _id: driverId, role: "driver" },
      body: { rating: 5, comment: "Great" },
    });
    assert.equal(res.statusCode, 409);
    assert.match(error.message, /already been submitted/);
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    Review.findOne = originalReviewFind;
  }
});

test("non-critical request event failure does not fail the lifecycle write", async () => {
  const originalCreate = RequestEvent.create;
  RequestEvent.create = async () => {
    throw new Error("event store offline");
  };
  try {
    const result = await createRequestEvent(
      {
        breakdownRequestId: new mongoose.Types.ObjectId(),
        eventType: "provider_selected",
      },
      { force: true, silent: true },
    );
    assert.equal(result, null);
  } finally {
    RequestEvent.create = originalCreate;
  }
});

test("normalization migration is idempotent for assignments and reviews", async () => {
  const driverId = new mongoose.Types.ObjectId();
  const selectedProviderId = new mongoose.Types.ObjectId();
  const rejectedProviderId = new mongoose.Types.ObjectId();
  const request = savedDocument({
    driverId,
    selectedProviderId,
    rejectedProviderIds: [rejectedProviderId],
    currentAssignmentId: null,
    status: "completed",
    assignedAt: new Date("2026-08-20T09:00:00Z"),
    acceptedAt: new Date("2026-08-20T09:05:00Z"),
    completedAt: new Date("2026-08-20T10:00:00Z"),
    review: {
      rating: 5,
      comment: "Helpful",
      submittedAt: new Date("2026-08-20T10:10:00Z"),
    },
  });
  const assignments = [];
  const reviews = [];
  const models = {
    BreakdownRequest: {
      find() {
        return {
          cursor() {
            return {
              async *[Symbol.asyncIterator]() {
                yield request;
              },
            };
          },
        };
      },
    },
    RequestAssignment: {
      async findOne(filter) {
        return (
          assignments.find(
            (item) =>
              String(item.breakdownRequestId) ===
                String(filter.breakdownRequestId) &&
              String(item.providerId) === String(filter.providerId) &&
              (typeof filter.status === "string"
                ? item.status === filter.status
                : item.status !== filter.status.$ne),
          ) || null
        );
      },
      async create(payload) {
        const assignment = savedDocument(payload);
        assignments.push(assignment);
        return assignment;
      },
    },
    Review: {
      async findOne(filter) {
        return (
          reviews.find(
            (item) =>
              String(item.breakdownRequestId) ===
              String(filter.breakdownRequestId),
          ) || null
        );
      },
      async create(payload) {
        const review = savedDocument(payload);
        reviews.push(review);
        return review;
      },
    },
  };
  const logger = { log() {}, warn() {}, error() {} };

  const first = await migrateNormalizedCollections({ models, logger });
  const second = await migrateNormalizedCollections({ models, logger });
  assert.equal(first.assignmentsCreated, 2);
  assert.equal(first.reviewsCreated, 1);
  assert.equal(second.assignmentsCreated, 0);
  assert.equal(second.assignmentsSkipped, 2);
  assert.equal(second.reviewsCreated, 0);
  assert.equal(second.reviewsSkipped, 1);
  assert.equal(assignments.length, 2);
  assert.equal(reviews.length, 1);
});
