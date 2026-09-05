require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const BreakdownRequest = require("../src/models/BreakdownRequest");
const RequestAssignment = require("../src/models/RequestAssignment");
const Review = require("../src/models/Review");
const { REQUEST_TO_ASSIGNMENT_STATUS } = require("../src/services/requestAssignmentService");

function compact(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

function assignmentPayload(request, providerId, status, rejectedHistory = false) {
  const requestedAt = rejectedHistory ? undefined : (request.assignedAt || undefined);
  return compact({
    breakdownRequestId: request._id,
    providerId,
    status,
    recommendationSnapshot: {
      distanceKm: rejectedHistory ? null : (request.providerDistanceKm ?? null)
    },
    estimatedArrivalMinutes: rejectedHistory ? null : (request.estimatedArrivalMinutes ?? null),
    rejectionReason: status === "rejected" && !rejectedHistory ? (request.rejectionReason || "") : "",
    requestedAt,
    acceptedAt: status === "accepted" || ["provider_en_route", "arrived", "in_progress", "completed"].includes(status)
      ? request.acceptedAt || undefined
      : undefined,
    rejectedAt: status === "rejected" && !rejectedHistory ? request.rejectedAt || undefined : undefined,
    enRouteAt: ["provider_en_route", "arrived", "in_progress", "completed"].includes(status)
      ? request.enRouteAt || undefined
      : undefined,
    arrivedAt: ["arrived", "in_progress", "completed"].includes(status)
      ? request.arrivedAt || undefined
      : undefined,
    inProgressAt: ["in_progress", "completed"].includes(status)
      ? request.workStartedAt || undefined
      : undefined,
    completedAt: status === "completed" ? request.completedAt || undefined : undefined,
    cancelledAt: status === "cancelled" ? request.cancelledAt || undefined : undefined
  });
}

async function createAssignmentIfMissing(models, payload, counters) {
  const statusFilter = payload.status === "rejected"
    ? "rejected"
    : { $ne: "rejected" };
  const existing = await models.RequestAssignment.findOne({
    breakdownRequestId: payload.breakdownRequestId,
    providerId: payload.providerId,
    status: statusFilter
  });
  if (existing) {
    counters.assignmentsSkipped += 1;
    return existing;
  }
  const assignment = await models.RequestAssignment.create(payload);
  counters.assignmentsCreated += 1;
  return assignment;
}

async function migrateRequest(request, models, counters, logger) {
  let currentAssignment = null;
  if (request.selectedProviderId) {
    const status = REQUEST_TO_ASSIGNMENT_STATUS[request.status] || "requested";
    currentAssignment = await createAssignmentIfMissing(
      models,
      assignmentPayload(request, request.selectedProviderId, status),
      counters
    );
    if (!request.assignedAt) {
      counters.warnings += 1;
      logger.warn(`Request ${request._id}: selected provider has no reliable requestedAt timestamp.`);
    }
    if (!request.currentAssignmentId || String(request.currentAssignmentId) !== String(currentAssignment._id)) {
      request.currentAssignmentId = currentAssignment._id;
      await request.save();
    }
  }

  for (const rejectedProviderId of request.rejectedProviderIds || []) {
    await createAssignmentIfMissing(
      models,
      assignmentPayload(request, rejectedProviderId, "rejected", true),
      counters
    );
    counters.warnings += 1;
    logger.warn(`Request ${request._id}: rejected provider history has no reliable per-provider timestamp.`);
  }

  if (request.review) {
    const existingReview = await models.Review.findOne({ breakdownRequestId: request._id });
    if (existingReview) {
      counters.reviewsSkipped += 1;
      return;
    }
    const reviewProviderId = currentAssignment?.providerId || request.selectedProviderId;
    if (!currentAssignment || !reviewProviderId || !request.driverId) {
      counters.warnings += 1;
      logger.warn(`Request ${request._id}: embedded review could not be normalized safely.`);
      return;
    }
    await models.Review.create(compact({
      breakdownRequestId: request._id,
      requestAssignmentId: currentAssignment._id,
      providerId: reviewProviderId,
      driverId: request.driverId,
      rating: request.review.rating,
      comment: request.review.comment || "",
      createdAt: request.review.submittedAt || undefined,
      updatedAt: request.review.submittedAt || undefined
    }));
    counters.reviewsCreated += 1;
  }
}

async function migrateNormalizedCollections(options = {}) {
  const models = options.models || { BreakdownRequest, RequestAssignment, Review };
  const logger = options.logger || console;
  const counters = {
    scanned: 0,
    assignmentsCreated: 0,
    assignmentsSkipped: 0,
    reviewsCreated: 0,
    reviewsSkipped: 0,
    warnings: 0,
    errors: 0
  };

  const cursor = models.BreakdownRequest.find({}).cursor();
  for await (const request of cursor) {
    counters.scanned += 1;
    try {
      await migrateRequest(request, models, counters, logger);
    } catch (error) {
      counters.errors += 1;
      logger.error(`Request ${request._id}: ${error.message}`);
    }
  }

  logger.log(`Migration scanned: ${counters.scanned}`);
  logger.log(`Assignments created: ${counters.assignmentsCreated}`);
  logger.log(`Assignments skipped: ${counters.assignmentsSkipped}`);
  logger.log(`Reviews created: ${counters.reviewsCreated}`);
  logger.log(`Reviews skipped: ${counters.reviewsSkipped}`);
  logger.log(`Warnings: ${counters.warnings}`);
  logger.log(`Errors: ${counters.errors}`);
  return counters;
}

async function main() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MONGO_URI is required to run the normalization migration");
  }
  try {
    await migrateNormalizedCollections();
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Normalization migration failed:", error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  assignmentPayload,
  migrateNormalizedCollections,
  migrateRequest
};
