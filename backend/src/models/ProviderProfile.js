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
      required: [true, "Service radius is required"],
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
    isApproved: {
      type: Boolean,
      default: false
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

module.exports = mongoose.model("ProviderProfile", providerProfileSchema);
