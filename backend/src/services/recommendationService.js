const ProviderProfile = require("../models/ProviderProfile");

const SERVICE_SPECIALIZATION_MAP = {
  tire_mechanic: ["tire"],
  battery_electrical_mechanic: ["battery", "electrical"],
  engine_mechanic: ["engine"],
  brake_mechanic: ["brake"],
  roadside_fuel_support: ["fuel_support"],
  towing_service: ["towing"],
  general_mechanic: ["general"]
};

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(start, end) {
  const earthRadiusKm = 6371;
  const latitudeDifference = toRadians(end.latitude - start.latitude);
  const longitudeDifference = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);

  const a =
    Math.sin(latitudeDifference / 2) * Math.sin(latitudeDifference / 2) +
    Math.cos(startLatitude) *
      Math.cos(endLatitude) *
      Math.sin(longitudeDifference / 2) *
      Math.sin(longitudeDifference / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function getMatchingSpecializations(requiredServiceType) {
  return SERVICE_SPECIALIZATION_MAP[requiredServiceType] || SERVICE_SPECIALIZATION_MAP.general;
}

function calculateRecommendationScore(provider, distanceKm, matchingSpecializations) {
  const hasSpecializationMatch = provider.specializations.some((item) =>
    matchingSpecializations.includes(item)
  );
  const specializationScore = hasSpecializationMatch ? 40 : 0;
  const ratingScore = Math.min(Number(provider.averageRating || 0), 5) * 4;
  const distanceScore = Math.max(
    0,
    (1 - distanceKm / Number(provider.serviceRadiusKm || 1)) * 20
  );
  const responseTime = Number(provider.averageResponseTimeMinutes || 60);
  const responseScore = Math.max(0, (1 - responseTime / 60) * 10);
  const availabilityScore = provider.availabilityStatus === "available" ? 10 : 0;

  return Number(
    (
      specializationScore +
      ratingScore +
      distanceScore +
      responseScore +
      availabilityScore
    ).toFixed(2)
  );
}

async function getRecommendationsForRequest(request) {
  const matchingSpecializations = getMatchingSpecializations(request.requiredServiceType);
  const driverLocation = {
    latitude: request.location.latitude,
    longitude: request.location.longitude
  };

  const providers = await ProviderProfile.find({
    isApproved: true,
    availabilityStatus: "available",
    supportedVehicleTypes: request.vehicleType,
    specializations: { $in: matchingSpecializations }
  });

  return providers
    .map((provider) => {
      const distanceKm = calculateDistanceKm(driverLocation, provider.location);

      if (distanceKm > Number(provider.serviceRadiusKm || 0)) {
        return null;
      }

      return {
        providerId: provider._id,
        businessName: provider.businessName,
        providerType: provider.providerType,
        specializations: provider.specializations,
        distanceKm: Number(distanceKm.toFixed(2)),
        rating: provider.averageRating,
        responseTimeMinutes: provider.averageResponseTimeMinutes,
        estimatedPriceRange: provider.estimatedPriceRange,
        recommendationScore: calculateRecommendationScore(
          provider,
          distanceKm,
          matchingSpecializations
        ),
        availability: provider.availabilityStatus
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 5);
}

module.exports = {
  SERVICE_SPECIALIZATION_MAP,
  calculateDistanceKm,
  getRecommendationsForRequest
};
