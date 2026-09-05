const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    breakdownRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BreakdownRequest",
      required: true
    },
    requestAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RequestAssignment",
      required: true
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProviderProfile",
      required: true
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 500 }
  },
  {
    collection: "reviews",
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

reviewSchema.index({ breakdownRequestId: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);
