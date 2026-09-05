const mongoose = require("mongoose");
const ProviderProfile = require("../models/ProviderProfile");
const BreakdownRequest = require("../models/BreakdownRequest");
const {
  getRecommendationsForRequest,
  toPublicRecommendationResult
} = require("../services/providerRecommendationService");
const { PROVIDER_ROLES } = require("../utils/domainConstants");
const { validateProviderProfileInput } = require("../utils/providerValidation");
const { APPROVED_PROVIDER_QUERY, isProviderApproved } = require("../utils/providerApproval");

function isProviderRole(role) {
  return PROVIDER_ROLES.includes(role);
}

function buildProviderPayload(body, providerType = body.providerType) {
  const allowedFields = [
    "providerType",
    "businessName",
    "phone",
    "specializations",
    "serviceCategories",
    "supportedVehicleTypes",
    "location",
    "serviceRadiusKm",
    "averageResponseTimeMinutes",
    "estimatedPriceRange",
    "openingHours",
    "description"
  ];

  const payload = allowedFields.reduce((result, field) => {
    if (body[field] !== undefined) result[field] = body[field];
    return result;
  }, {});
  if (providerType === "spare_parts_shop") delete payload.serviceRadiusKm;
  return payload;
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
      ...buildProviderPayload(req.body, req.user.role),
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
    const errors = validateProviderProfileInput({ ...req.body, providerType: req.user.role }, true);
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
      buildProviderPayload(req.body, req.user.role),
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
    const availabilityStatus = req.body.availabilityStatus === "available"
      ? "online"
      : req.body.availabilityStatus;
    const errors = validateProviderProfileInput(
      { availabilityStatus },
      true
    );
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const profile = await ProviderProfile.findOne({ userId: req.user._id });
    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }
    if (!isProviderApproved(profile) && availabilityStatus === "online") {
      res.status(403);
      throw new Error("Only approved providers can go online");
    }
    profile.availabilityStatus = availabilityStatus;
    await profile.save();

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
    const { providerType, vehicleType } = req.query;
    const filter = {
      ...APPROVED_PROVIDER_QUERY,
      isActive: { $ne: false },
      availabilityStatus: "online"
    };

    if (providerType) filter.providerType = providerType;
    if (vehicleType) filter.supportedVehicleTypes = vehicleType;

    const query = ProviderProfile.find(filter).sort({ averageRating: -1, createdAt: -1 });
    const populated = typeof query.populate === "function"
      ? await query.populate("userId", "isActive")
      : await query;
    const providers = populated.filter((profile) => profile.userId?.isActive !== false);

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

    const query = ProviderProfile.findOne({
      _id: req.params.id,
      ...APPROVED_PROVIDER_QUERY,
      isActive: { $ne: false }
    });
    const provider = typeof query.populate === "function"
      ? await query.populate("userId", "isActive")
      : await query;

    if (!provider || provider.userId?.isActive === false) {
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

async function resubmitProviderProfile(req, res, next) {
  try {
    const profile = await ProviderProfile.findOne({ userId: req.user._id });
    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }
    if (profile.approvalStatus !== "rejected") {
      res.status(409);
      throw new Error("Only a rejected provider profile can be resubmitted");
    }
    const lastHistory = profile.approvalHistory[profile.approvalHistory.length - 1];
    if (!lastHistory || lastHistory.status !== "rejected" || lastHistory.reason !== profile.rejectionReason) {
      profile.approvalHistory.push({
        status: "rejected",
        reason: profile.rejectionReason,
        changedBy: profile.rejectedBy,
        changedAt: profile.rejectedAt || new Date()
      });
    }
    profile.approvalStatus = "pending";
    profile.isApproved = false;
    profile.availabilityStatus = "offline";
    profile.rejectionReason = "";
    profile.rejectedAt = null;
    profile.rejectedBy = null;
    await profile.save();
    return res.status(200).json({
      success: true,
      message: "Provider profile resubmitted for review",
      data: { profile }
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
  resubmitProviderProfile,
  updateAvailability,
  updateMyProviderProfile
};
