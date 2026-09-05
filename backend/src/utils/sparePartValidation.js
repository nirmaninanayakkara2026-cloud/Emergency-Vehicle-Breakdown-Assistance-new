const { SPARE_PART_CATEGORIES } = require("../config/sparePartCategories");

function validateSparePartInput(payload, partial = false) {
  const errors = [];
  if (!partial || payload.name !== undefined) {
    if (!payload.name || !String(payload.name).trim()) errors.push("Item name is required");
  }
  if (!partial || payload.category !== undefined) {
    if (!SPARE_PART_CATEGORIES.includes(payload.category)) {
      errors.push(`Category must be one of: ${SPARE_PART_CATEGORIES.join(", ")}`);
    }
  }
  if (!partial || payload.quantity !== undefined) {
    const quantity = Number(payload.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) errors.push("Quantity must be a non-negative integer");
  }
  if (payload.price !== undefined && payload.price !== null && payload.price !== "") {
    if (!Number.isFinite(Number(payload.price)) || Number(payload.price) < 0) errors.push("Price must be a non-negative number");
  }
  if (payload.compatibleVehicles !== undefined && !Array.isArray(payload.compatibleVehicles)) {
    errors.push("Compatible vehicles must be an array");
  }
  if (payload.isAvailable !== undefined && typeof payload.isAvailable !== "boolean") {
    errors.push("Availability must be true or false");
  }
  return errors;
}

module.exports = { validateSparePartInput };
