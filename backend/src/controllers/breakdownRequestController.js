const mongoose = require("mongoose");
const BreakdownRequest = require("../models/BreakdownRequest");
const ProviderProfile = require("../models/ProviderProfile");
const {
  PROVIDER_ROLES,
  mapBreakdownToServiceType
} = require("../utils/domainConstants");
const {
  validateBreakdownRequestInput,
  validateStatusUpdateInput
} = require("../utils/requestValidation");

function isProviderRole(role) {
  return PROVIDER_ROLES.includes(role);
}

function isSameId(a, b) {
  const first = a && a._id ? a._id : a;
  const second = b && b._id ? b._id : b;
  return String(first) === String(second);
}

async function getProviderProfileForUser(userId) {
  return ProviderProfile.findOne({ userId });
}

async function canUserViewRequest(user, request) {
  if (user.role === "admin") return true;
  if (user.role === "driver" && isSameId(request.driverId, user._id)) return true;

  if (isProviderRole(user.role) && request.selectedProviderId) {
    const profile = await getProviderProfileForUser(user._id);
    return profile && isSameId(request.selectedProviderId, profile._id);
  }

  return false;
}

function populateRequest(query) {
  return query
    .populate("driverId", "name phone email role")
    .populate("selectedProviderId");
}

async function createBreakdownRequest(req, res, next) {
  try {
    const errors = validateBreakdownRequestInput(req.body);
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const requiredServiceType = mapBreakdownToServiceType(req.body.breakdownType);

    const request = await BreakdownRequest.create({
      driverId: req.user._id,
      vehicleType: req.body.vehicleType,
      vehicleModel: req.body.vehicleModel,
      breakdownType: req.body.breakdownType,
      urgencyLevel: req.body.urgencyLevel,
      problemDescription: String(req.body.problemDescription).trim(),
      location: req.body.location,
      requiredServiceType,
      status: "pending",
      estimatedCost: req.body.estimatedCost
    });

    return res.status(201).json({
      success: true,
      message: "Breakdown request created successfully",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyBreakdownRequests(req, res, next) {
  try {
    const requests = await populateRequest(
      BreakdownRequest.find({ driverId: req.user._id }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      message: "Driver breakdown requests fetched successfully",
      data: { requests }
    });
  } catch (error) {
    return next(error);
  }
}

async function getAssignedProviderRequests(req, res, next) {
  try {
    const profile = await getProviderProfileForUser(req.user._id);

    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }

    const requests = await populateRequest(
      BreakdownRequest.find({ selectedProviderId: profile._id }).sort({ createdAt: -1 })
    );

    return res.status(200).json({
      success: true,
      message: "Assigned breakdown requests fetched successfully",
      data: { requests }
    });
  } catch (error) {
    return next(error);
  }
}

async function getBreakdownRequestById(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const request = await populateRequest(BreakdownRequest.findById(req.params.id));

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!(await canUserViewRequest(req.user, request))) {
      res.status(403);
      throw new Error("You do not have permission to view this request");
    }

    return res.status(200).json({
      success: true,
      message: "Breakdown request fetched successfully",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

async function selectProvider(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const { providerId } = req.body;

    if (!providerId || !mongoose.Types.ObjectId.isValid(providerId)) {
      res.status(400);
      throw new Error("Valid providerId is required");
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can select a provider");
    }

    if (request.status === "cancelled" || request.status === "completed") {
      res.status(400);
      throw new Error("Provider cannot be selected for a completed or cancelled request");
    }

    const provider = await ProviderProfile.findOne({
      _id: providerId,
      isApproved: true
    });

    if (!provider) {
      res.status(404);
      throw new Error("Approved provider not found");
    }

    request.selectedProviderId = provider._id;
    request.status = "recommended";
    request.estimatedCost = provider.estimatedPriceRange;
    await request.save();

    const populatedRequest = await populateRequest(BreakdownRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Provider selected successfully",
      data: { request: populatedRequest }
    });
  } catch (error) {
    return next(error);
  }
}

async function updateBreakdownRequestStatus(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const errors = validateStatusUpdateInput(req.body.status);
    if (errors.length > 0) {
      res.status(400);
      throw new Error(errors.join(". "));
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!request.selectedProviderId) {
      res.status(400);
      throw new Error("No provider has been selected for this request");
    }

    const providerProfile = await getProviderProfileForUser(req.user._id);

    if (!providerProfile || !isSameId(request.selectedProviderId, providerProfile._id)) {
      res.status(403);
      throw new Error("Only the selected provider can update this request status");
    }

    if (request.status === "cancelled") {
      res.status(400);
      throw new Error("Cancelled requests cannot be updated");
    }

    request.status = req.body.status;
    await request.save();

    const populatedRequest = await populateRequest(BreakdownRequest.findById(request._id));

    return res.status(200).json({
      success: true,
      message: "Breakdown request status updated successfully",
      data: { request: populatedRequest }
    });
  } catch (error) {
    return next(error);
  }
}

async function cancelBreakdownRequest(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      res.status(400);
      throw new Error("Breakdown request id is invalid");
    }

    const request = await BreakdownRequest.findById(req.params.id);

    if (!request) {
      res.status(404);
      throw new Error("Breakdown request not found");
    }

    if (!isSameId(request.driverId, req.user._id)) {
      res.status(403);
      throw new Error("Only the driver who created the request can cancel it");
    }

    if (request.status === "completed") {
      res.status(400);
      throw new Error("Completed requests cannot be cancelled");
    }

    request.status = "cancelled";
    await request.save();

    return res.status(200).json({
      success: true,
      message: "Breakdown request cancelled successfully",
      data: { request }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  cancelBreakdownRequest,
  createBreakdownRequest,
  getAssignedProviderRequests,
  getBreakdownRequestById,
  getMyBreakdownRequests,
  selectProvider,
  updateBreakdownRequestStatus
};
