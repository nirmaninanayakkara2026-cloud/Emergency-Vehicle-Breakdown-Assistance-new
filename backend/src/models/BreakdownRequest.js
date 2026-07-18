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
      required: [true, "Address is required"],
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

const breakdownRequestSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Driver is required"]
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
      required: [true, "Problem description is required"],
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
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUSES,
        message: "Request status is not supported"
      },
      default: "pending"
    },
    estimatedCost: estimatedCostSchema
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
