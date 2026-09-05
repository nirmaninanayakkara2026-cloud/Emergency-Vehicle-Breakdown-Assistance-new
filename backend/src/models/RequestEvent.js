const mongoose = require("mongoose");

const requestEventSchema = new mongoose.Schema(
  {
    breakdownRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BreakdownRequest",
      required: true,
      index: true
    },
    requestAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RequestAssignment",
      default: null
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, trim: true, maxlength: 50, default: "system" },
    eventType: { type: String, required: true, trim: true, maxlength: 80 },
    fromStatus: { type: String, trim: true, maxlength: 50, default: "" },
    toStatus: { type: String, trim: true, maxlength: 50, default: "" },
    message: { type: String, trim: true, maxlength: 300, default: "" }
  },
  {
    collection: "requestEvents",
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

requestEventSchema.index({ breakdownRequestId: 1, createdAt: -1 });

module.exports = mongoose.model("RequestEvent", requestEventSchema);
