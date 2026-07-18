const {
  BREAKDOWN_TYPES,
  PROVIDER_UPDATE_STATUSES,
  URGENCY_LEVELS,
  VEHICLE_TYPES
} = require("./domainConstants");

function hasLocation(location) {
  return (
    location &&
    location.latitude !== undefined &&
    location.longitude !== undefined &&
    location.address &&
    String(location.address).trim()
  );
}

function validateBreakdownRequestInput(payload) {
  const errors = [];
  const {
    vehicleType,
    breakdownType,
    urgencyLevel,
    problemDescription,
    location
  } = payload;

  if (!vehicleType) errors.push("Vehicle type is required");
  if (vehicleType && !VEHICLE_TYPES.includes(vehicleType)) {
    errors.push(`Vehicle type must be one of: ${VEHICLE_TYPES.join(", ")}`);
  }

  if (!breakdownType) errors.push("Breakdown type is required");
  if (breakdownType && !BREAKDOWN_TYPES.includes(breakdownType)) {
    errors.push(`Breakdown type must be one of: ${BREAKDOWN_TYPES.join(", ")}`);
  }

  if (!urgencyLevel) errors.push("Urgency level is required");
  if (urgencyLevel && !URGENCY_LEVELS.includes(urgencyLevel)) {
    errors.push(`Urgency level must be one of: ${URGENCY_LEVELS.join(", ")}`);
  }

  if (!problemDescription || !String(problemDescription).trim()) {
    errors.push("Problem description is required");
  }

  if (!hasLocation(location)) {
    errors.push("Location with latitude, longitude, and address is required");
  }

  return errors;
}

function validateStatusUpdateInput(status) {
  const errors = [];

  if (!status) {
    errors.push("Status is required");
  } else if (!PROVIDER_UPDATE_STATUSES.includes(status)) {
    errors.push(`Status must be one of: ${PROVIDER_UPDATE_STATUSES.join(", ")}`);
  }

  return errors;
}

module.exports = {
  validateBreakdownRequestInput,
  validateStatusUpdateInput
};
