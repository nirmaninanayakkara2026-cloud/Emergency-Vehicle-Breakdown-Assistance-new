const {
  AVAILABILITY_STATUSES,
  PROVIDER_TYPES,
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

function validateNumber(value, label, required = false) {
  if (value === undefined || value === null || value === "") {
    return required ? `${label} is required` : null;
  }

  if (Number.isNaN(Number(value))) {
    return `${label} must be a number`;
  }

  if (Number(value) < 0) {
    return `${label} cannot be negative`;
  }

  return null;
}

function validateProviderProfileInput(payload, partial = false) {
  const errors = [];
  const {
    providerType,
    businessName,
    phone,
    supportedVehicleTypes,
    location,
    availabilityStatus,
    serviceRadiusKm,
    averageResponseTimeMinutes,
    estimatedPriceRange
  } = payload;

  if (!partial || providerType !== undefined) {
    if (!providerType) errors.push("Provider type is required");
    if (providerType && !PROVIDER_TYPES.includes(providerType)) {
      errors.push(`Provider type must be one of: ${PROVIDER_TYPES.join(", ")}`);
    }
  }

  if (!partial || businessName !== undefined) {
    if (!businessName || !String(businessName).trim()) errors.push("Business name is required");
  }

  if (!partial || phone !== undefined) {
    if (!phone || !String(phone).trim()) errors.push("Phone number is required");
  }

  if (!partial || location !== undefined) {
    if (!hasLocation(location)) errors.push("Location with latitude, longitude, and address is required");
  }

  if (supportedVehicleTypes !== undefined) {
    if (!Array.isArray(supportedVehicleTypes)) {
      errors.push("Supported vehicle types must be an array");
    } else {
      const unsupported = supportedVehicleTypes.filter((item) => !VEHICLE_TYPES.includes(item));
      if (unsupported.length > 0) {
        errors.push(`Unsupported vehicle types: ${unsupported.join(", ")}`);
      }
    }
  }

  if (availabilityStatus !== undefined && !AVAILABILITY_STATUSES.includes(availabilityStatus)) {
    errors.push(`Availability status must be one of: ${AVAILABILITY_STATUSES.join(", ")}`);
  }

  const serviceRadiusError = validateNumber(serviceRadiusKm, "Service radius", !partial);
  if (serviceRadiusError) errors.push(serviceRadiusError);

  const responseTimeError = validateNumber(averageResponseTimeMinutes, "Average response time");
  if (responseTimeError) errors.push(responseTimeError);

  if (estimatedPriceRange) {
    const minimumError = validateNumber(estimatedPriceRange.minimum, "Minimum price");
    const maximumError = validateNumber(estimatedPriceRange.maximum, "Maximum price");
    if (minimumError) errors.push(minimumError);
    if (maximumError) errors.push(maximumError);
    if (
      estimatedPriceRange.minimum !== undefined &&
      estimatedPriceRange.maximum !== undefined &&
      Number(estimatedPriceRange.minimum) > Number(estimatedPriceRange.maximum)
    ) {
      errors.push("Minimum price cannot be greater than maximum price");
    }
  }

  return errors;
}

module.exports = {
  validateProviderProfileInput
};
