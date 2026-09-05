const mongoose = require("mongoose");

const adminActionSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    actionType: { type: String, required: true, trim: true, maxlength: 80 },
    targetType: { type: String, required: true, trim: true, maxlength: 40 },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, trim: true, maxlength: 500, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: () => ({}) }
  },
  {
    collection: "adminActions",
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

adminActionSchema.index({ adminId: 1, createdAt: -1 });
adminActionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model("AdminAction", adminActionSchema);
