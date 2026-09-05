const mongoose = require("mongoose");
const { VEHICLE_TYPES } = require("../utils/domainConstants");

const SESSION_STATUSES = [
  "created",
  "awaiting_safety_confirmation",
  "in_progress",
  "awaiting_resolution_confirmation",
  "resolved",
  "professional_help_required",
  "cancelled"
];

const completedStepSchema = new mongoose.Schema(
  {
    stepId: { type: String, required: true },
    instruction: { type: String, default: "" },
    instructionConfirmed: { type: Boolean, required: true, default: true },
    selectedResult: { type: String, required: true },
    resultLabel: { type: String, default: "" },
    completedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const predictedFaultSchema = new mongoose.Schema(
  {
    fault: { type: String, default: null },
    label: { type: String, default: "Fault classification unavailable" },
    confidence: { type: Number, default: null },
    confidenceLevel: { type: String, default: "unavailable" },
    needsMoreInformation: { type: Boolean, default: true }
  },
  { _id: false }
);

const troubleshootingSessionSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    breakdownRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BreakdownRequest",
      default: null
    },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    breakdownType: { type: String, required: true, trim: true, maxlength: 100 },
    symptomCapture: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    diagnosticInputText: { type: String, required: true, maxlength: 3000 },
    predictedFault: { type: predictedFaultSchema, required: true },
    guideId: { type: String, default: null },
    guideTitle: { type: String, default: "" },
    riskLevel: { type: String, enum: ["LOW", "CAUTION", "HIGH"], default: null },
    status: { type: String, enum: SESSION_STATUSES, default: "created", index: true },
    currentStepId: { type: String, default: null },
    currentStep: { type: mongoose.Schema.Types.Mixed, default: null },
    currentPhase: {
      type: String,
      enum: ["instruction", "result", "completed"],
      default: "instruction"
    },
    currentInstructionConfirmedAt: { type: Date, default: null },
    completedSteps: { type: [completedStepSchema], default: [] },
    safetyConfirmed: { type: Boolean, default: false },
    recommendedService: { type: String, default: "general_mechanic" },
    safetyWarning: { type: String, default: "" },
    beforeYouBegin: { type: [String], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

troubleshootingSessionSchema.index({ driverId: 1, createdAt: -1 });

module.exports = mongoose.model("TroubleshootingSession", troubleshootingSessionSchema);
module.exports.SESSION_STATUSES = SESSION_STATUSES;
