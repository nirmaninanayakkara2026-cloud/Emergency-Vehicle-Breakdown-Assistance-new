const ProviderProfile = require("../models/ProviderProfile");
const { getServiceCostRange } = require("../config/serviceCostRanges");
const { getRejectedProviderIds } = require("./requestAssignmentService");
const { APPROVED_PROVIDER_QUERY, isProviderApproved } = require("../utils/providerApproval");

const SCORE_WEIGHTS = Object.freeze({
  serviceMatch: 40,
  distance: 25,
  rating: 15,
  availability: 10,
  responseTime: 10
});

const SERVICE_ALIASES = {
  general_mechanic: ["general_mechanic", "general"],
  engine_mechanic: ["engine_mechanic", "engine"],
  brake_mechanic: ["brake_mechanic", "brake"],
  battery_electrical_mechanic: ["battery_electrical_mechanic", "battery", "electrical"],
  fuel_system_mechanic: ["fuel_system_mechanic", "fuel"],
  transmission_mechanic: ["transmission_mechanic", "transmission"],
  steering_mechanic: ["steering_mechanic", "steering"],
  tire_mechanic: ["tire_mechanic", "tire", "tyre"],
  roadside_fuel_support: ["roadside_fuel_support", "fuel_support"],
  towing_service: ["towing_service", "towing"]
};

const FALLBACK_PRIORITY = ["garage", "general", "towing"];

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function calculateDistanceKm(start, end) {
  const earthRadiusKm = 6371;
  const latitudeDifference = toRadians(end.latitude - start.latitude);
  const longitudeDifference = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) *
      Math.sin(longitudeDifference / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function providerServices(provider) {
  return [...new Set([
    ...(provider.specializations || []),
    ...(provider.serviceCategories || [])
  ].map((item) => String(item).toLowerCase()))];
}

function getMatchTier(provider, requiredServiceType, breakdownType) {
  const services = providerServices(provider);
  const aliases = SERVICE_ALIASES[requiredServiceType] || [requiredServiceType];
  if (services.some((service) => aliases.includes(service))) return "exact";

  const isGeneral = services.some((service) => ["general", "general_mechanic"].includes(service));
  if (provider.providerType === "garage" && (isGeneral || services.length === 0)) return "garage";
  if (["mechanic", "garage"].includes(provider.providerType) && isGeneral) return "general";

  const towingAppropriate = requiredServiceType === "towing_service" ||
    ["accident", "towing_needed"].includes(breakdownType);
  if (towingAppropriate && provider.providerType === "towing_service" &&
      services.some((service) => ["towing", "towing_service"].includes(service))) {
    return "towing";
  }
  return "unrelated";
}

function serviceMatchScore(tier) {
  return { exact: 40, garage: 25, general: 22, towing: 20 }[tier] || 0;
}

function distanceScore(distanceKm) {
  if (distanceKm <= 2) return 25;
  if (distanceKm <= 5) return 20;
  if (distanceKm <= 10) return 15;
  if (distanceKm <= 20) return 8;
  return 2;
}

function ratingScore(provider) {
  if (!Number(provider.totalReviews)) return 9;
  return Number(((Math.min(5, Math.max(0, Number(provider.averageRating))) / 5) * 15).toFixed(2));
}

function responseTimeScore(minutes) {
  if (!Number.isFinite(Number(minutes))) return 6;
  if (Number(minutes) <= 10) return 10;
  if (Number(minutes) <= 20) return 8;
  if (Number(minutes) <= 30) return 6;
  if (Number(minutes) <= 45) return 4;
  return 2;
}

function scoreProvider(provider, distanceKm, tier) {
  const components = {
    serviceMatchScore: serviceMatchScore(tier),
    distanceScore: distanceScore(distanceKm),
    ratingScore: ratingScore(provider),
    availabilityScore: provider.availabilityStatus === "online" ? 10 : 0,
    responseTimeScore: responseTimeScore(provider.averageResponseTimeMinutes)
  };
  return {
    components,
    total: Number(Object.values(components).reduce((sum, value) => sum + value, 0).toFixed(2))
  };
}

function buildWhyRecommended(provider, distanceKm, tier) {
  const reasons = [];
  if (tier === "exact") reasons.push("Matches the required service");
  else if (tier === "garage") reasons.push("Compatible garage alternative");
  else if (tier === "general") reasons.push("General mechanic alternative");
  else if (tier === "towing") reasons.push("Suitable towing alternative");
  reasons.push(`${distanceKm.toFixed(1)} km away`);
  if (Number(provider.averageRating) >= 4) reasons.push("Highly rated");
  reasons.push("Currently available");
  return reasons;
}

function rankProviders(providers, input) {
  const driverLocation = { latitude: Number(input.latitude), longitude: Number(input.longitude) };
  const rejectedIds = new Set((input.rejectedProviderIds || []).map(String));
  const suitable = providers.map((provider) => {
    const approved = isProviderApproved(provider);
    const accountActive = !(provider.userId && typeof provider.userId === "object") ||
      provider.userId.isActive !== false;
    if (!approved || !accountActive || provider.isActive === false ||
        provider.availabilityStatus !== "online" || rejectedIds.has(String(provider._id))) {
      return null;
    }
    if (provider.supportedVehicleTypes?.length &&
        !provider.supportedVehicleTypes.includes(input.vehicleType)) return null;
    if (!provider.location || !Number.isFinite(Number(provider.location.latitude)) ||
        !Number.isFinite(Number(provider.location.longitude))) return null;

    const distanceKm = calculateDistanceKm(driverLocation, provider.location);
    if (distanceKm > Number(provider.serviceRadiusKm || 0)) return null;
    const tier = getMatchTier(provider, input.requiredServiceType, input.breakdownType);
    if (tier === "unrelated") return null;
    const score = scoreProvider(provider, distanceKm, tier);
    return {
      providerId: provider._id,
      name: provider.businessName,
      businessName: provider.businessName,
      providerType: provider.providerType,
      specializations: provider.specializations || [],
      serviceCategories: provider.serviceCategories || [],
      distanceKm: Number(distanceKm.toFixed(2)),
      rating: Number(provider.averageRating || 0),
      totalReviews: Number(provider.totalReviews || 0),
      averageResponseTime: provider.averageResponseTimeMinutes ?? null,
      responseTimeMinutes: provider.averageResponseTimeMinutes ?? null,
      serviceRadiusKm: provider.serviceRadiusKm,
      availability: provider.availabilityStatus,
      matchType: tier,
      scoreComponents: score.components,
      recommendationScore: score.total,
      whyRecommended: buildWhyRecommended(provider, distanceKm, tier)
    };
  }).filter(Boolean);

  const exact = suitable.filter((provider) => provider.matchType === "exact");
  let selected = exact;
  let fallbackType = null;
  if (!selected.length) {
    fallbackType = FALLBACK_PRIORITY.find((tier) =>
      suitable.some((provider) => provider.matchType === tier)
    ) || null;
    selected = fallbackType
      ? suitable.filter((provider) => provider.matchType === fallbackType)
      : [];
  }
  return {
    providers: selected
      .sort((first, second) => second.recommendationScore - first.recommendationScore || first.distanceKm - second.distanceKm)
      .slice(0, 5),
    fallbackUsed: Boolean(fallbackType),
    fallbackType
  };
}

async function getProviderRecommendations(input) {
  const query = ProviderProfile.find({
    ...APPROVED_PROVIDER_QUERY,
    isActive: { $ne: false },
    availabilityStatus: "online"
  });
  const providers = typeof query.populate === "function"
    ? await query.populate("userId", "isActive")
    : await query;
  const ranked = rankProviders(providers, input);
  return {
    requiredService: input.requiredServiceType,
    estimatedCostRange: getServiceCostRange(input.requiredServiceType),
    ...ranked,
    message: ranked.providers.length
      ? ranked.fallbackUsed
        ? "No specialist is currently available. Showing suitable alternative providers."
        : "Suitable providers found."
      : "No suitable provider is currently available nearby.",
    canIncreaseSearchRadius: ranked.providers.length === 0,
    canRequestTowing: ranked.providers.length === 0
  };
}

async function getRecommendationsForRequest(request) {
  const rejectedProviderIds = await getRejectedProviderIds(request);
  return getProviderRecommendations({
    requiredServiceType: request.requiredServiceType,
    latitude: request.location.latitude,
    longitude: request.location.longitude,
    vehicleType: request.vehicleType,
    breakdownType: request.breakdownType,
    rejectedProviderIds
  });
}

function toPublicRecommendationResult(result) {
  return {
    ...result,
    providers: result.providers.map(({ recommendationScore, scoreComponents, ...provider }) => provider)
  };
}

module.exports = {
  SCORE_WEIGHTS,
  SERVICE_ALIASES,
  calculateDistanceKm,
  distanceScore,
  getMatchTier,
  getProviderRecommendations,
  getRecommendationsForRequest,
  rankProviders,
  ratingScore,
  responseTimeScore,
  scoreProvider,
  toPublicRecommendationResult
};
