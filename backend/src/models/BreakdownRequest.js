const mongoose = require("mongoose");
const {
  BREAKDOWN_TYPES,
  REQUEST_STATUSES,
  URGENCY_LEVELS,
  VEHICLE_TYPES
} = require("../utils/domainConstants");

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: [true, "Latitude is required"]
    },
    longitude: {
      type: Number,
      required: [true, "Longitude is required"]
    },
    address: {
      type: String,
      default: "",
      trim: true
    }
  },
  { _id: false }
);

const estimatedCostSchema = new mongoose.Schema(
  {
    minimum: {
      type: Number,
      min: [0, "Minimum estimated cost cannot be negative"]
    },
    maximum: {
      type: Number,
      min: [0, "Maximum estimated cost cannot be negative"]
    }
  },
  { _id: false }
);

const observedSymptomsSchema = new mongoose.Schema(
  {
    see: { type: [String], default: [] },
    hear: { type: [String], default: [] },
    smell: { type: [String], default: [] },
    feel: { type: [String], default: [] }
  },
  { _id: false }
);

const symptomCaptureSchema = new mongoose.Schema(
  {
    symptoms: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: () => ({})
    },
    observedSymptoms: {
      type: observedSymptomsSchema,
      default: () => ({})
    },
    additionalDescription: {
      type: String,
      default: "",
      trim: true
    },
    guidedCaptureUsed: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const topPredictionSchema = new mongoose.Schema(
  {
    fault: { type: String, required: true },
    probability: { type: Number, required: true, min: 0, max: 1 }
  },
  { _id: false }
);

const aiPredictionSchema = new mongoose.Schema(
  {
    predictedFault: { type: String, default: null },
    faultLabel: { type: String, required: true },
    requiredService: { type: String, required: true },
    confidence: { type: Number, default: null, min: 0, max: 1 },
    confidenceLevel: {
      type: String,
      enum: ["high", "medium", "low", "unavailable"],
      required: true
    },
    predictionMargin: { type: Number, default: null, min: 0, max: 1 },
    isAmbiguous: { type: Boolean, required: true },
    needsMoreInformation: { type: Boolean, required: true },
    topPredictions: { type: [topPredictionSchema], default: [] },
    predictionSource: {
      type: String,
      enum: ["ai_model", "rule_fallback"],
      required: true
    }
  },
  { _id: false }
);

const clarificationQuestionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, required: true, maxlength: 180 },
    options: { type: [String], required: true, validate: [(items) => items.length <= 5] }
  },
  { _id: false }
);

const clarificationAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true, maxlength: 100 },
    answeredAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const serviceCostRangeSchema = new mongoose.Schema(
  {
    min: { type: Number, required: true, min: 0 },
    max: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "LKR" }
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 500 },
    submittedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const breakdownRequestSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver is required"]
    },
    troubleshootingSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TroubleshootingSession",
      default: null
    },
    vehicleType: {
      type: String,
      enum: {
        values: VEHICLE_TYPES,
        message: "Vehicle type is not supported"
      },
      required: [true, "Vehicle type is required"]
    },
    vehicleModel: {
      type: String,
      trim: true
    },
    breakdownType: {
      type: String,
      enum: {
        values: BREAKDOWN_TYPES,
        message: "Breakdown type is not supported"
      },
      required: [true, "Breakdown type is required"]
    },
    urgencyLevel: {
      type: String,
      enum: {
        values: URGENCY_LEVELS,
        message: "Urgency level is not supported"
      },
      required: [true, "Urgency level is required"]
    },
    problemDescription: {
      type: String,
      default: "",
      trim: true
    },
    location: {
      type: locationSchema,
      required: [true, "Location is required"]
    },
    requiredServiceType: {
      type: String,
      required: [true, "Required service type is required"]
    },
    selectedProviderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProviderProfile"
    },
    rejectedProviderIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile" }],
      default: []
    },
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUSES,
        message: "Request status is not supported"
      },
      default: "pending"
    },
    estimatedCost: estimatedCostSchema,
    estimatedCostRange: serviceCostRangeSchema,
    finalCost: { type: Number, min: 0, default: null },
    assignedAt: { type: Date, default: null },
    providerDistanceKm: { type: Number, min: 0, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", trim: true, maxlength: 300 },
    estimatedArrivalMinutes: { type: Number, min: 1, max: 1440, default: null },
    enRouteAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    workStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "", trim: true, maxlength: 300 },
    review: { type: reviewSchema, default: null },
    symptomCapture: {
      type: symptomCaptureSchema,
      default: () => ({ guidedCaptureUsed: false })
    },
    diagnosticInputText: {
      type: String,
      default: ""
    },
    aiPrediction: {
      type: aiPredictionSchema
    },
    aiPredictionHistory: {
      type: [aiPredictionSchema],
      default: []
    },
    clarificationQuestions: {
      type: [clarificationQuestionSchema],
      default: []
    },
    clarificationAnswers: {
      type: [clarificationAnswerSchema],
      default: []
    },
    clarificationAttempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    }
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

module.exports = mongoose.model("BreakdownRequest", breakdownRequestSchema);
