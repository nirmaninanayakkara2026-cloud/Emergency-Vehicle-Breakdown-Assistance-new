const mongoose = require("mongoose");

const ASSIGNMENT_STATUSES = [
  "requested",
  "accepted",
  "rejected",
  "provider_en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled"
];

const recommendationSnapshotSchema = new mongoose.Schema(
  {
    distanceKm: { type: Number, min: 0, default: null },
    rating: { type: Number, min: 0, max: 5, default: null },
    responseTime: { type: Number, min: 0, default: null },
    serviceMatch: { type: String, default: "" },
    recommendationScore: { type: Number, default: null }
  },
  { _id: false }
);

const requestAssignmentSchema = new mongoose.Schema(
  {
    breakdownRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BreakdownRequest",
      required: true
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true
    },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: "requested",
      required: true
    },
    recommendationSnapshot: {
      type: recommendationSnapshotSchema,
      default: () => ({})
    },
    estimatedArrivalMinutes: { type: Number, min: 1, max: 1440, default: null },
    rejectionReason: { type: String, trim: true, maxlength: 300, default: "" },
    requestedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    enRouteAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    inProgressAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null }
  },
  {
    collection: "requestAssignments",
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

requestAssignmentSchema.index({ breakdownRequestId: 1, status: 1 });
requestAssignmentSchema.index({ providerId: 1, status: 1 });
requestAssignmentSchema.index(
  { breakdownRequestId: 1, providerId: 1, requestedAt: 1 },
  { name: "assignment_migration_dedupe" }
);

module.exports = mongoose.model("RequestAssignment", requestAssignmentSchema);
module.exports.ASSIGNMENT_STATUSES = ASSIGNMENT_STATUSES;
