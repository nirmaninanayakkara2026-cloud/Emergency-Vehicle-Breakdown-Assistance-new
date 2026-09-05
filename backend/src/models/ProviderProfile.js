const mongoose = require("mongoose");
const {
  AVAILABILITY_STATUSES,
  PROVIDER_TYPES,
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
      required: [true, "Address is required"],
      trim: true
    }
  },
  { _id: false }
);

const estimatedPriceRangeSchema = new mongoose.Schema(
  {
    minimum: {
      type: Number,
      min: [0, "Minimum price cannot be negative"]
    },
    maximum: {
      type: Number,
      min: [0, "Maximum price cannot be negative"]
    }
  },
  { _id: false }
);

const approvalHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["pending", "approved", "rejected", "suspended"], required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    changedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const providerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      unique: true
    },
    providerType: {
      type: String,
      enum: {
        values: PROVIDER_TYPES,
        message: "Provider type is not supported"
      },
      required: [true, "Provider type is required"]
    },
    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true
    },
    specializations: {
      type: [String],
      default: []
    },
    serviceCategories: {
      type: [String],
      default: []
    },
    supportedVehicleTypes: {
      type: [
        {
          type: String,
          enum: {
            values: VEHICLE_TYPES,
            message: "Vehicle type is not supported"
          }
        }
      ],
      default: []
    },
    location: {
      type: locationSchema,
      required: [true, "Location is required"]
    },
    availabilityStatus: {
      type: String,
      enum: {
        values: AVAILABILITY_STATUSES,
        message: "Availability status is not supported"
      },
      default: "offline"
    },
    serviceRadiusKm: {
      type: Number,
      required() { return this.providerType !== "spare_parts_shop"; },
      min: [0, "Service radius cannot be negative"]
    },
    averageRating: {
      type: Number,
      default: 0
    },
    totalReviews: {
      type: Number,
      default: 0
    },
    averageResponseTimeMinutes: {
      type: Number,
      min: [0, "Average response time cannot be negative"]
    },
    estimatedPriceRange: estimatedPriceRangeSchema,
    completedJobs: {
      type: Number,
      default: 0
    },
    openingHours: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ""
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      required: true
    },
    rejectionReason: { type: String, trim: true, maxlength: 500, default: "" },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    suspensionReason: { type: String, trim: true, maxlength: 500, default: "" },
    approvalHistory: { type: [approvalHistorySchema], default: [] },
    isApproved: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
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

providerProfileSchema.index({ approvalStatus: 1, providerType: 1, createdAt: -1 });

module.exports = mongoose.model("ProviderProfile", providerProfileSchema);
