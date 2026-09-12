const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const BreakdownRequest = require("../src/models/BreakdownRequest");
const ProviderProfile = require("../src/models/ProviderProfile");
const RequestAssignment = require("../src/models/RequestAssignment");
const Review = require("../src/models/Review");
const TroubleshootingSession = require("../src/models/TroubleshootingSession");
const aiDiagnosisService = require("../src/services/aiDiagnosisService");
const recommendation = require("../src/services/providerRecommendationService");
const controller = require("../src/controllers/breakdownRequestController");
const providerController = require("../src/controllers/providerController");

const driverId = new mongoose.Types.ObjectId();
const providerUserId = new mongoose.Types.ObjectId();

function provider(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    providerType: "mechanic",
    businessName: "Provider",
    specializations: ["general_mechanic"],
    serviceCategories: [],
    supportedVehicleTypes: ["car"],
    location: { latitude: 6.9271, longitude: 79.8612 },
    availabilityStatus: "online",
    serviceRadiusKm: 25,
    averageRating: 4,
    totalReviews: 10,
    averageResponseTimeMinutes: 20,
    approvalStatus: "approved",
    isApproved: true,
    isActive: true,
    ...overrides,
  };
}

function request(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    driverId,
    vehicleType: "car",
    breakdownType: "battery_issue",
    requiredServiceType: "battery_electrical_mechanic",
    location: { latitude: 6.9271, longitude: 79.8612 },
    status: "provider_selection",
    selectedProviderId: null,
    rejectedProviderIds: [],
    async save() {
      this.saved = true;
    },
    ...overrides,
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

function queryFor(value) {
  return {
    populate() {
      return this;
    },
    then(resolve) {
      return Promise.resolve(resolve(value));
    },
  };
}

test("electrical specialist ranks ahead using transparent components", () => {
  const nearby = provider({
    businessName: "Nearby Electrical",
    specializations: ["battery_electrical_mechanic"],
    location: { latitude: 6.93, longitude: 79.8612 },
  });
  const farther = provider({
    businessName: "Farther Electrical",
    specializations: ["electrical"],
    location: { latitude: 6.98, longitude: 79.8612 },
    averageRating: 5,
  });
  const result = recommendation.rankProviders([farther, nearby], {
    requiredServiceType: "battery_electrical_mechanic",
    latitude: 6.9271,
    longitude: 79.8612,
    vehicleType: "car",
    breakdownType: "battery_issue",
  });
  assert.equal(result.providers[0].businessName, "Nearby Electrical");
  assert.equal(result.providers[0].scoreComponents.serviceMatchScore, 40);
  assert.equal(result.fallbackUsed, false);
  const publicResult = recommendation.toPublicRecommendationResult(result);
  assert.equal(publicResult.providers[0].recommendationScore, undefined);
  assert.equal(publicResult.providers[0].scoreComponents, undefined);
});

test("brake specialist is preferred over general provider", () => {
  const brake = provider({ specializations: ["brake_mechanic"] });
  const general = provider({
    specializations: ["general_mechanic"],
    averageRating: 5,
  });
  const result = recommendation.rankProviders([general, brake], {
    requiredServiceType: "brake_mechanic",
    latitude: 6.9271,
    longitude: 79.8612,
    vehicleType: "car",
    breakdownType: "brake_problem",
  });
  assert.deepEqual(
    result.providers.map((item) => String(item.providerId)),
    [String(brake._id)],
  );
});

test("general mechanic is clearly marked as fallback when specialist is absent", () => {
  const general = provider({ specializations: ["general_mechanic"] });
  const result = recommendation.rankProviders([general], {
    requiredServiceType: "engine_mechanic",
    latitude: 6.9271,
    longitude: 79.8612,
    vehicleType: "car",
    breakdownType: "engine_overheating",
  });
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.fallbackType, "general");
  assert.equal(result.providers[0].matchType, "general");
});

test("outside-radius, unapproved, inactive, and unavailable providers are excluded", () => {
  const candidates = [
    provider({
      specializations: ["engine_mechanic"],
      location: { latitude: 7.5, longitude: 79.8612 },
      serviceRadiusKm: 2,
    }),
    provider({
      specializations: ["engine_mechanic"],
      approvalStatus: "pending",
      isApproved: false,
    }),
    provider({ specializations: ["engine_mechanic"], isActive: false }),
    provider({
      specializations: ["engine_mechanic"],
      availabilityStatus: "busy",
    }),
  ];
  const result = recommendation.rankProviders(candidates, {
    requiredServiceType: "engine_mechanic",
    latitude: 6.9271,
    longitude: 79.8612,
    vehicleType: "car",
    breakdownType: "engine_overheating",
  });
  assert.equal(result.providers.length, 0);
});

test("rejected provider is not recommended again", () => {
  const rejected = provider({ specializations: ["brake_mechanic"] });
  const result = recommendation.rankProviders([rejected], {
    requiredServiceType: "brake_mechanic",
    latitude: 6.9271,
    longitude: 79.8612,
    vehicleType: "car",
    breakdownType: "brake_problem",
    rejectedProviderIds: [rejected._id],
  });
  assert.equal(result.providers.length, 0);
});

test("no-provider response is non-failing and offers retry", async () => {
  const originalFind = ProviderProfile.find;
  ProviderProfile.find = async () => [];
  try {
    const result = await recommendation.getProviderRecommendations({
      requiredServiceType: "engine_mechanic",
      latitude: 6.9271,
      longitude: 79.8612,
      vehicleType: "car",
      breakdownType: "engine_overheating",
    });
    assert.deepEqual(result.providers, []);
    assert.equal(result.canIncreaseSearchRadius, true);
  } finally {
    ProviderProfile.find = originalFind;
  }
});

test("recommendation endpoint rejects a driver who does not own the request", async () => {
  const originalFind = BreakdownRequest.findById;
  BreakdownRequest.findById = async () =>
    request({ driverId: new mongoose.Types.ObjectId() });
  try {
    const { res, error } = await invoke(
      providerController.getProviderRecommendations,
      {
        query: { requestId: String(new mongoose.Types.ObjectId()) },
        user: { _id: driverId },
      },
    );
    assert.equal(res.statusCode, 403);
    assert.match(error.message, /Only the driver/);
  } finally {
    BreakdownRequest.findById = originalFind;
  }
});

test("AI 2 escalation uses the owned session recommended service", async () => {
  const troubleshootingId = new mongoose.Types.ObjectId();
  const originalSessionFind = TroubleshootingSession.findById;
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const originalCreate = BreakdownRequest.create;
  let saved;
  TroubleshootingSession.findById = async () => ({
    _id: troubleshootingId,
    driverId,
    recommendedService: "brake_mechanic",
  });
  aiDiagnosisService.diagnoseBreakdown = async () => ({
    predictedFault: "brake_system_fault",
    faultLabel: "Brake System Problem",
    requiredService: "general_mechanic",
    confidence: 0.9,
    confidenceLevel: "high",
    predictionMargin: 0.7,
    isAmbiguous: false,
    needsMoreInformation: false,
    topPredictions: [],
    predictionSource: "ai_model",
  });
  BreakdownRequest.create = async (payload) => {
    saved = payload;
    return payload;
  };
  try {
    const { res, error } = await invoke(controller.createBreakdownRequest, {
      user: { _id: driverId },
      body: {
        troubleshootingSessionId: String(troubleshootingId),
        vehicleType: "car",
        breakdownType: "brake_problem",
        urgencyLevel: "high",
        problemDescription: "Brake warning",
        location: { latitude: 6.9271, longitude: 79.8612 },
      },
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.requiredServiceType, "brake_mechanic");
    assert.equal(
      String(saved.troubleshootingSessionId),
      String(troubleshootingId),
    );
  } finally {
    TroubleshootingSession.findById = originalSessionFind;
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
    BreakdownRequest.create = originalCreate;
  }
});

test("driver selection creates a provider_requested assignment", async () => {
  const chosen = provider({ specializations: ["battery_electrical_mechanic"] });
  const item = request();
  const originalRequestFind = BreakdownRequest.findById;
  const originalProviderFind = ProviderProfile.find;
  const originalProviderFindOne = ProviderProfile.findOne;
  const originalDistinct = RequestAssignment.distinct;
  const originalCreateAssignment = RequestAssignment.create;
  let createdAssignment;
  BreakdownRequest.findById = () => queryFor(item);
  ProviderProfile.find = async () => [chosen];
  ProviderProfile.findOne = async () => chosen;
  RequestAssignment.distinct = async () => [];
  RequestAssignment.create = async (payload) => {
    createdAssignment = {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
      async save() {},
    };
    return createdAssignment;
  };
  try {
    const { res, error } = await invoke(controller.selectProvider, {
      params: { id: String(item._id) },
      user: { _id: driverId },
      body: { providerId: String(chosen._id) },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.data.request.status, "provider_requested");
    assert.equal(String(item.selectedProviderId), String(chosen._id));
    assert.equal(
      String(item.currentAssignmentId),
      String(createdAssignment._id),
    );
    assert.equal(createdAssignment.status, "requested");
    assert.ok(item.assignedAt);
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.find = originalProviderFind;
    ProviderProfile.findOne = originalProviderFindOne;
    RequestAssignment.distinct = originalDistinct;
    RequestAssignment.create = originalCreateAssignment;
  }
});

test("wrong provider cannot accept an assigned request", async () => {
  const selectedId = new mongoose.Types.ObjectId();
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: selectedId,
    status: "requested",
    async save() {},
  };
  const item = request({
    status: "provider_requested",
    selectedProviderId: selectedId,
    currentAssignmentId: assignment,
  });
  const originalRequestFind = BreakdownRequest.findById;
  const originalFindOne = ProviderProfile.findOne;
  BreakdownRequest.findById = async () => item;
  ProviderProfile.findOne = async () =>
    provider({ _id: new mongoose.Types.ObjectId() });
  try {
    const { res, error } = await invoke(controller.acceptBreakdownRequest, {
      params: { id: String(item._id) },
      user: { _id: providerUserId },
      body: { estimatedArrivalMinutes: 20 },
    });
    assert.equal(res.statusCode, 403);
    assert.match(error.message, /selected provider/);
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.findOne = originalFindOne;
  }
});

test("selected provider accepts and progresses through the full tracking lifecycle", async () => {
  const selected = provider({
    completedJobs: 0,
    async save() {
      this.saved = true;
    },
  });
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: selected._id,
    status: "requested",
    async save() {
      this.saved = true;
    },
  };
  const item = request({
    status: "provider_requested",
    selectedProviderId: selected._id,
    currentAssignmentId: assignment,
  });
  const originalRequestFind = BreakdownRequest.findById;
  const originalFindOne = ProviderProfile.findOne;
  const originalAssignmentFind = RequestAssignment.findById;
  BreakdownRequest.findById = () => queryFor(item);
  ProviderProfile.findOne = async () => selected;
  RequestAssignment.findById = async () => assignment;
  try {
    let invocation = await invoke(controller.acceptBreakdownRequest, {
      params: { id: String(item._id) },
      user: { _id: providerUserId },
      body: { estimatedArrivalMinutes: 20 },
    });
    assert.equal(invocation.error, undefined);
    assert.equal(item.status, "accepted");
    assert.equal(assignment.status, "accepted");
    assert.equal(item.estimatedArrivalMinutes, 20);

    for (const status of [
      "provider_en_route",
      "arrived",
      "in_progress",
      "completed",
    ]) {
      invocation = await invoke(controller.updateBreakdownRequestStatus, {
        params: { id: String(item._id) },
        user: { _id: providerUserId },
        body: {
          status,
          ...(status === "completed"
            ? {
                finalCost: 5500,
                completionNote: "Battery starting issue resolved.",
              }
            : {}),
        },
      });
      assert.equal(invocation.error, undefined);
      assert.equal(item.status, status);
      assert.equal(assignment.status, status);
    }
    assert.equal(item.finalCost, 5500);
    assert.equal(item.completionNote, "Battery starting issue resolved.");
    assert.ok(item.completedAt instanceof Date);
    assert.ok(assignment.completedAt instanceof Date);
    assert.equal(selected.completedJobs, 1);
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.findOne = originalFindOne;
    RequestAssignment.findById = originalAssignmentFind;
  }
});

test("completion requires a valid final service price", async () => {
  const selected = provider({ completedJobs: 0, async save() {} });
  const originalRequestFind = BreakdownRequest.findById;
  const originalFindOne = ProviderProfile.findOne;
  ProviderProfile.findOne = async () => selected;
  try {
    for (const [finalCost, expected] of [
      [undefined, /required/],
      [-100, /valid non-negative/],
      ["abc", /valid non-negative/],
      [false, /valid non-negative/],
    ]) {
      const assignment = {
        _id: new mongoose.Types.ObjectId(),
        providerId: selected._id,
        status: "in_progress",
        async save() {},
      };
      const item = request({
        status: "in_progress",
        selectedProviderId: selected._id,
        currentAssignmentId: assignment,
        async save() {},
      });
      BreakdownRequest.findById = async () => item;
      const result = await invoke(controller.updateBreakdownRequestStatus, {
        params: { id: String(item._id) },
        user: { _id: providerUserId },
        body: { status: "completed", finalCost },
      });
      assert.equal(result.res.statusCode, 400);
      assert.match(result.error.message, expected);
      assert.equal(item.status, "in_progress");
      assert.equal(item.finalCost, undefined);
    }
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.findOne = originalFindOne;
  }
});

test("provider rejection clears assignment and records exclusion", async () => {
  const selected = provider();
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: selected._id,
    status: "requested",
    async save() {},
  };
  const item = request({
    status: "provider_requested",
    selectedProviderId: selected._id,
    currentAssignmentId: assignment,
  });
  const originalRequestFind = BreakdownRequest.findById;
  const originalFindOne = ProviderProfile.findOne;
  BreakdownRequest.findById = async () => item;
  ProviderProfile.findOne = async () => selected;
  try {
    const { res, error } = await invoke(controller.rejectBreakdownRequest, {
      params: { id: String(item._id) },
      user: { _id: providerUserId },
      body: { reason: "Busy" },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.data.request.status, "provider_rejected");
    assert.equal(item.selectedProviderId, null);
    assert.equal(item.currentAssignmentId, null);
    assert.equal(assignment.status, "rejected");
    assert.equal(String(item.rejectedProviderIds[0]), String(selected._id));
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.findOne = originalFindOne;
  }
});

test("invalid provider status jump is rejected", async () => {
  const selected = provider({ async save() {} });
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: selected._id,
    status: "accepted",
    async save() {},
  };
  const item = request({
    status: "accepted",
    selectedProviderId: selected._id,
    currentAssignmentId: assignment,
  });
  const originalRequestFind = BreakdownRequest.findById;
  const originalFindOne = ProviderProfile.findOne;
  BreakdownRequest.findById = async () => item;
  ProviderProfile.findOne = async () => selected;
  try {
    const { res, error } = await invoke(
      controller.updateBreakdownRequestStatus,
      {
        params: { id: String(item._id) },
        user: { _id: providerUserId },
        body: { status: "completed" },
      },
    );
    assert.equal(res.statusCode, 409);
    assert.match(error.message, /cannot move/);
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.findOne = originalFindOne;
  }
});

test("completed request review updates provider average once", async () => {
  const selected = provider({
    averageRating: 4,
    totalReviews: 2,
    async save() {
      this.saved = true;
    },
  });
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: selected._id,
    status: "completed",
    async save() {},
  };
  const item = request({
    status: "completed",
    selectedProviderId: selected._id,
    currentAssignmentId: assignment,
    review: null,
  });
  const originalRequestFind = BreakdownRequest.findById;
  const originalProviderFind = ProviderProfile.findById;
  const originalReviewFind = Review.findOne;
  const originalReviewCreate = Review.create;
  let storedReview;
  BreakdownRequest.findById = async () => item;
  ProviderProfile.findById = async () => selected;
  Review.findOne = async () => null;
  Review.create = async (payload) => {
    storedReview = { _id: new mongoose.Types.ObjectId(), ...payload };
    return storedReview;
  };
  try {
    const { res, error } = await invoke(controller.reviewBreakdownRequest, {
      params: { id: String(item._id) },
      user: { _id: driverId },
      body: { rating: 5, comment: "Helpful" },
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(selected.totalReviews, 3);
    assert.equal(selected.averageRating, 4.33);
    assert.equal(item.review.rating, 5);
    assert.equal(
      String(storedReview.requestAssignmentId),
      String(assignment._id),
    );
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    ProviderProfile.findById = originalProviderFind;
    Review.findOne = originalReviewFind;
    Review.create = originalReviewCreate;
  }
});

test("review validation rejects incomplete jobs and ratings outside 1 to 5", async () => {
  const assignment = {
    _id: new mongoose.Types.ObjectId(),
    providerId: new mongoose.Types.ObjectId(),
    status: "completed",
  };
  const originalRequestFind = BreakdownRequest.findById;
  const originalReviewFind = Review.findOne;
  try {
    BreakdownRequest.findById = async () => request({ status: "in_progress" });
    let result = await invoke(controller.reviewBreakdownRequest, {
      params: { id: String(new mongoose.Types.ObjectId()) },
      user: { _id: driverId },
      body: { rating: 5 },
    });
    assert.equal(result.res.statusCode, 409);
    assert.match(result.error.message, /only be submitted after/);
    Review.findOne = async () => null;
    for (const rating of [0, 6]) {
      BreakdownRequest.findById = async () =>
        request({
          status: "completed",
          currentAssignmentId: assignment,
          review: null,
        });
      result = await invoke(controller.reviewBreakdownRequest, {
        params: { id: String(new mongoose.Types.ObjectId()) },
        user: { _id: driverId },
        body: { rating },
      });
      assert.equal(result.res.statusCode, 400);
      assert.match(result.error.message, /1 to 5/);
    }
  } finally {
    BreakdownRequest.findById = originalRequestFind;
    Review.findOne = originalReviewFind;
  }
});
