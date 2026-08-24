const mongoose = require("mongoose");
const ProviderProfile = require("../models/ProviderProfile");
const BreakdownRequest = require("../models/BreakdownRequest");
const {
  getRecommendationsForRequest,
  toPublicRecommendationResult
} = require("../services/providerRecommendationService");
const { PROVIDER_ROLES } = require("../utils/domainConstants");
const { validateProviderProfileInput } = require("../utils/providerValidation");

function isProviderRole(role) {
  return PROVIDER_ROLES.includes(role);
}

function buildProviderPayload(body) {
  const allowedFields = [
    "providerType",
    "businessName",
    "phone",
    "specializations",
    "serviceCategories",
    "supportedVehicleTypes",
    "location",
    "availabilityStatus",
    "serviceRadiusKm",
    "averageResponseTimeMinutes",
    "estimatedPriceRange",
    "openingHours"
  ];

  return allowedFields.reduce((payload, field) => {
    if (body[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});
}

async function createProviderProfile(req, res, next) {
  try {
    if (!isProviderRole(req.user.role)) {
      res.status(403);
      throw new Error("Only provider users can create provider profiles");
    }

    const errors = validateProviderProfileInput(req.body);
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    if (req.body.providerType !== req.user.role) {
      res.status(400);
      throw new Error("Provider type must match the logged-in user's role");
    }

    const existingProfile = await ProviderProfile.findOne({ userId: req.user._id });
    if (existingProfile) {
      res.status(409);
      throw new Error("Provider profile already exists for this user");
    }

    const profile = await ProviderProfile.create({
      ...buildProviderPayload(req.body),
      userId: req.user._id
    });

    return res.status(201).json({
      success: true,
      message: "Provider profile created successfully",
      data: { profile }
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyProviderProfile(req, res, next) {
  try {
    const profile = await ProviderProfile.findOne({ userId: req.user._id });

    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }

    return res.status(200).json({
      success: true,
      message: "Provider profile fetched successfully",
      data: { profile }
    });
  } catch (error) {
    return next(error);
  }
}

async function updateMyProviderProfile(req, res, next) {
  try {
    const errors = validateProviderProfileInput(req.body, true);
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    if (req.body.providerType && req.body.providerType !== req.user.role) {
      res.status(400);
      throw new Error("Provider type must match the logged-in user's role");
    }

    const profile = await ProviderProfile.findOneAndUpdate(
      { userId: req.user._id },
      buildProviderPayload(req.body),
      { new: true, runValidators: true }
    );

    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }

    return res.status(200).json({
      success: true,
      message: "Provider profile updated successfully",
      data: { profile }
    });
  } catch (error) {
    return next(error);
  }
}

async function updateAvailability(req, res, next) {
  try {
    const errors = validateProviderProfileInput(
      { availabilityStatus: req.body.availabilityStatus },
      true
    );
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const profile = await ProviderProfile.findOneAndUpdate(
      { userId: req.user._id },
      { availabilityStatus: req.body.availabilityStatus },
      { new: true, runValidators: true }
    );

    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      data: { profile }
    });
  } catch (error) {
    return next(error);
  }
}

async function getProviders(req, res, next) {
  try {
    const { providerType, vehicleType, availabilityStatus } = req.query;
    const filter = { isApproved: true, isActive: { $ne: false } };

    if (providerType) filter.providerType = providerType;
    if (availabilityStatus) filter.availabilityStatus = availabilityStatus;
    if (vehicleType) filter.supportedVehicleTypes = vehicleType;

    const providers = await ProviderProfile.find(filter).sort({ averageRating: -1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Approved providers fetched successfully",
      data: { providers }
    });
  } catch (error) {
    return next(error);
  }
}

async function getProviderRecommendations(req, res, next) {
  try {
    const { requestId } = req.query;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      res.status(400);
      throw new Error("A valid requestId query parameter is required");
    }
    const request = await BreakdownRequest.findById(requestId);
    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }
    if (String(request.driverId) !== String(req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can view recommendations");
    }
    const result = toPublicRecommendationResult(await getRecommendationsForRequest(request));
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return next(error);
  }
}

async function getProviderById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Provider id is invalid");
    }

    const provider = await ProviderProfile.findOne({
      _id: req.params.id,
      isApproved: true,
      isActive: { $ne: false }
    });

    if (!provider) {
      res.status(404);
      throw new Error("Approved provider not found");
    }

    return res.status(200).json({
      success: true,
      message: "Provider fetched successfully",
      data: { provider }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProviderProfile,
  getMyProviderProfile,
  getProviderRecommendations,
  getProviderById,
  getProviders,
  updateAvailability,
  updateMyProviderProfile
};
