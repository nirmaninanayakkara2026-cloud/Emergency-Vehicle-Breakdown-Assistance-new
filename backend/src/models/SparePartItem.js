const mongoose = require("mongoose");
const { SPARE_PART_CATEGORIES } = require("../config/sparePartCategories");

const sparePartItemSchema = new mongoose.Schema(
  {
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: "ProviderProfile", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, enum: SPARE_PART_CATEGORIES, required: true },
    partNumber: { type: String, trim: true, default: "", maxlength: 100 },
    brand: { type: String, trim: true, default: "", maxlength: 100 },
    compatibleVehicles: { type: [String], default: [] },
    price: { type: Number, min: 0, default: null },
    quantity: { type: Number, min: 0, required: true, default: 0 },
    isAvailable: { type: Boolean, default: true },
    description: { type: String, trim: true, default: "", maxlength: 1000 }
  },
  {
    collection: "sparePartItems",
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

sparePartItemSchema.index({ shopId: 1 });
sparePartItemSchema.index({ shopId: 1, category: 1 });
sparePartItemSchema.index({ name: "text", brand: "text", partNumber: "text" });

module.exports = mongoose.model("SparePartItem", sparePartItemSchema);
