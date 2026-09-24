const mongoose = require("mongoose");
const AdminAction = require("../models/AdminAction");
const BreakdownRequest = require("../models/BreakdownRequest");
const ProviderProfile = require("../models/ProviderProfile");
const RequestAssignment = require("../models/RequestAssignment");
const Review = require("../models/Review");
const SparePartItem = require("../models/SparePartItem");
const { User } = require("../models/User");
const { PROVIDER_ROLES } = require("../utils/domainConstants");
const { APPROVED_PROVIDER_QUERY } = require("../utils/providerApproval");

const ACTIVE_REQUEST_STATUSES = [
  "pending", "recommended", "created", "awaiting_clarification", "provider_selection",
  "provider_requested", "provider_rejected", "accepted", "on_the_way", "provider_en_route", "arrived", "in_progress"
];

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function publicUser(user) {
  if (!user) return null;
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

function providerSummary(profile) {
  const user = profile.userId && typeof profile.userId === "object" ? profile.userId : null;
  return {
    providerId: profile._id,
    userId: user?._id || profile.userId,
    name: user?.name || profile.businessName,
    email: user?.email,
    phone: user?.phone || profile.phone,
    providerType: profile.providerType,
    businessName: profile.businessName,
    specializations: profile.specializations || [],
    approvalStatus: profile.approvalStatus,
    availabilityStatus: profile.availabilityStatus,
    accountIsActive: user?.isActive !== false,
    rating: Number(profile.averageRating || 0),
    location: profile.location,
    createdAt: profile.createdAt
  };
}
// The following function is used to create an admin action record in the database.
async function createAdminAction(adminId, actionType, targetType, targetId, reason = "", metadata = {}) {
  return AdminAction.create({ adminId, actionType, targetType, targetId, reason, metadata });
}

async function findProvider(providerId) {
  if (!mongoose.Types.ObjectId.isValid(providerId)) return null;
  const query = ProviderProfile.findById(providerId);
  return typeof query.populate === "function"
    ? query.populate("userId", "name email phone role isActive createdAt")
    : query;
}

async function getDashboard(req, res, next) {
  try {
    const today = startOfDay();
    const [
      totalUsers, totalDrivers, totalProviders, pendingProviders, approvedProviders,
      suspendedProviders, sparePartsShops, activeBreakdownRequests, completedRequests,
      requestsToday, completedToday
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "driver" }),
      ProviderProfile.countDocuments({}),
      ProviderProfile.countDocuments({ approvalStatus: "pending" }),
      ProviderProfile.countDocuments(APPROVED_PROVIDER_QUERY),
      ProviderProfile.countDocuments({ approvalStatus: "suspended" }),
      ProviderProfile.countDocuments({ providerType: "spare_parts_shop" }),
      BreakdownRequest.countDocuments({ status: { $in: ACTIVE_REQUEST_STATUSES } }),
      BreakdownRequest.countDocuments({ status: "completed" }),
      BreakdownRequest.countDocuments({ createdAt: { $gte: today } }),
      BreakdownRequest.countDocuments({ status: "completed", completedAt: { $gte: today } })
    ]);
    return res.status(200).json({
      success: true,
      data: {
        totalUsers, totalDrivers, totalProviders, pendingProviders, approvedProviders,
        suspendedProviders, sparePartsShops, activeBreakdownRequests, completedRequests,
        requestsToday, completedToday
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function listProviders(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.approvalStatus = req.query.status;
    if (req.query.providerType) filter.providerType = req.query.providerType;
    const query = ProviderProfile.find(filter).sort({ createdAt: -1 });
    const profiles = typeof query.populate === "function"
      ? await query.populate("userId", "name email phone role isActive createdAt")
      : await query;
    const search = String(req.query.search || "").trim().toLowerCase();
    const providers = profiles
      .filter((profile) => {
        if (!search) return true;
        const user = profile.userId && typeof profile.userId === "object" ? profile.userId : {};
        return [profile.businessName, profile.phone, user.name, user.email, user.phone]
          .some((value) => String(value || "").toLowerCase().includes(search));
      })
      .map(providerSummary);
    return res.status(200).json({ success: true, data: { providers } });
  } catch (error) {
    return next(error);
  }
}

async function getProviderDetails(req, res, next) {
  try {
    const profile = await findProvider(req.params.providerId);
    if (!profile) {
      res.status(404);
      throw new Error("Provider profile not found");
    }
    const inventoryItemCount = profile.providerType === "spare_parts_shop"
      ? await SparePartItem.countDocuments({ shopId: profile._id })
      : 0;
    return res.status(200).json({
      success: true,
      data: {
        provider: {
          ...providerSummary(profile),
          account: publicUser(profile.userId),
          profile: {
            businessName: profile.businessName,
            providerType: profile.providerType,
            specializations: profile.specializations || [],
            serviceCategories: profile.serviceCategories || [],
            supportedVehicleTypes: profile.supportedVehicleTypes || [],
            serviceRadiusKm: profile.serviceRadiusKm,
            location: profile.location,
            availabilityStatus: profile.availabilityStatus,
            approvalStatus: profile.approvalStatus,
            rejectionReason: profile.rejectionReason,
            suspensionReason: profile.suspensionReason,
            averageRating: profile.averageRating,
            totalReviews: profile.totalReviews,
            completedJobs: profile.completedJobs,
            openingHours: profile.openingHours,
            description: profile.description,
            inventoryItemCount,
            createdAt: profile.createdAt
          }
        }
      }
    });
  } catch (error) {
    return next(error);
  }
}

function recordApprovalHistory(profile, status, reason, adminId, changedAt) {
  profile.approvalHistory.push({ status, reason, changedBy: adminId, changedAt });
}

async function approveProvider(req, res, next) {
  try {
    const profile = await findProvider(req.params.providerId);
    if (!profile) { res.status(404); throw new Error("Provider profile not found"); }
    if (profile.approvalStatus === "suspended") {
      res.status(409);
      throw new Error("Use the reactivate action for a suspended provider");
    }
    if (!["pending", "rejected", "approved"].includes(profile.approvalStatus)) {
      res.status(409);
      throw new Error("Provider is not awaiting an approval decision");
    }
    const now = new Date();
    profile.approvalStatus = "approved";
    profile.isApproved = true;
    profile.approvedAt = now;
    profile.approvedBy = req.user._id;
    profile.rejectionReason = "";
    profile.rejectedAt = null;
    profile.rejectedBy = null;
    profile.suspensionReason = "";
    profile.suspendedAt = null;
    profile.suspendedBy = null;
    recordApprovalHistory(profile, "approved", "", req.user._id, now);
    await profile.save();
    await createAdminAction(req.user._id, "PROVIDER_APPROVED", "ProviderProfile", profile._id, "", { providerType: profile.providerType });
    return res.status(200).json({ success: true, data: { provider: providerSummary(profile) } });
  } catch (error) { return next(error); }
}

async function rejectProvider(req, res, next) {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) { res.status(400); throw new Error("Rejection reason is required"); }
    const profile = await findProvider(req.params.providerId);
    if (!profile) { res.status(404); throw new Error("Provider profile not found"); }
    if (profile.approvalStatus !== "pending") {
      res.status(409);
      throw new Error("Only a pending provider can be rejected");
    }
    const now = new Date();
    profile.approvalStatus = "rejected";
    profile.isApproved = false;
    profile.availabilityStatus = "offline";
    profile.rejectionReason = reason;
    profile.rejectedAt = now;
    profile.rejectedBy = req.user._id;
    profile.approvedAt = null;
    profile.approvedBy = null;
    recordApprovalHistory(profile, "rejected", reason, req.user._id, now);
    await profile.save();
    await createAdminAction(req.user._id, "PROVIDER_REJECTED", "ProviderProfile", profile._id, reason, { providerType: profile.providerType });
    return res.status(200).json({ success: true, data: { provider: providerSummary(profile) } });
  } catch (error) { return next(error); }
}

async function suspendProvider(req, res, next) {
  try {
    const reason = String(req.body.reason || "").trim();
    if (!reason) { res.status(400); throw new Error("Suspension reason is required"); }
    const profile = await findProvider(req.params.providerId);
    if (!profile) { res.status(404); throw new Error("Provider profile not found"); }
    if (profile.approvalStatus !== "approved") {
      res.status(409);
      throw new Error("Only an approved provider can be suspended");
    }
    const now = new Date();
    profile.approvalStatus = "suspended";
    profile.isApproved = false;
    profile.availabilityStatus = "offline";
    profile.suspensionReason = reason;
    profile.suspendedAt = now;
    profile.suspendedBy = req.user._id;
    recordApprovalHistory(profile, "suspended", reason, req.user._id, now);
    await profile.save();
    await createAdminAction(req.user._id, "PROVIDER_SUSPENDED", "ProviderProfile", profile._id, reason, { providerType: profile.providerType });
    return res.status(200).json({ success: true, data: { provider: providerSummary(profile) } });
  } catch (error) { return next(error); }
}

async function reactivateProvider(req, res, next) {
  try {
    const profile = await findProvider(req.params.providerId);
    if (!profile) { res.status(404); throw new Error("Provider profile not found"); }
    if (profile.approvalStatus !== "suspended") {
      res.status(409);
      throw new Error("Only a suspended provider can be reactivated");
    }
    const now = new Date();
    profile.approvalStatus = "approved";
    profile.isApproved = true;
    profile.approvedAt = now;
    profile.approvedBy = req.user._id;
    profile.suspensionReason = "";
    profile.suspendedAt = null;
    profile.suspendedBy = null;
    profile.availabilityStatus = "offline";
    recordApprovalHistory(profile, "approved", "Reactivated", req.user._id, now);
    await profile.save();
    await createAdminAction(req.user._id, "PROVIDER_REACTIVATED", "ProviderProfile", profile._id, "", { providerType: profile.providerType });
    return res.status(200).json({ success: true, data: { provider: providerSummary(profile) } });
  } catch (error) { return next(error); }
}

async function listDrivers(req, res, next) {
  try {
    const filter = { role: "driver" };
    const search = String(req.query.search || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = ["name", "email", "phone"].map((field) => ({ [field]: new RegExp(escaped, "i") }));
    }
    const drivers = await User.find(filter).sort({ createdAt: -1 });
    const summaries = await Promise.all(drivers.map(async (driver) => ({
      ...publicUser(driver),
      totalRequests: await BreakdownRequest.countDocuments({ driverId: driver._id })
    })));
    return res.status(200).json({ success: true, data: { drivers: summaries } });
  } catch (error) { return next(error); }
}

async function setUserActivity(req, res, next, isActive) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.userId)) { res.status(400); throw new Error("User id is invalid"); }
    if (!isActive && String(req.params.userId) === String(req.user._id)) {
      res.status(409);
      throw new Error("An administrator cannot deactivate their own account");
    }
    const user = await User.findById(req.params.userId);
    if (!user) { res.status(404); throw new Error("User not found"); }
    user.isActive = isActive;
    await user.save();
    if (!isActive && PROVIDER_ROLES.includes(user.role)) {
      await ProviderProfile.updateOne({ userId: user._id }, { availabilityStatus: "offline" });
    }
    const actionType = isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED";
    await createAdminAction(req.user._id, actionType, "User", user._id, String(req.body.reason || "").trim(), { role: user.role });
    return res.status(200).json({ success: true, data: { user: publicUser(user) } });
  } catch (error) { return next(error); }
}

function deactivateUser(req, res, next) { return setUserActivity(req, res, next, false); }
function activateUser(req, res, next) { return setUserActivity(req, res, next, true); }

async function listBreakdownRequests(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.driver && mongoose.Types.ObjectId.isValid(req.query.driver)) filter.driverId = req.query.driver;
    if (req.query.date) {
      const date = new Date(req.query.date);
      if (!Number.isNaN(date.getTime())) filter.createdAt = { $gte: startOfDay(date), $lte: endOfDay(date) };
    }
    if (req.query.provider && mongoose.Types.ObjectId.isValid(req.query.provider)) {
      const requestIds = await RequestAssignment.distinct("breakdownRequestId", { providerId: req.query.provider });
      filter._id = { $in: requestIds };
    }
    const query = BreakdownRequest.find(filter).sort({ createdAt: -1 });
    const requests = typeof query.populate === "function"
      ? await query.populate("driverId", "name email phone")
      : await query;
    const summaries = await Promise.all(requests.map(async (request) => {
      const assignmentQuery = RequestAssignment.findOne({ breakdownRequestId: request._id }).sort({ createdAt: -1 });
      const assignment = typeof assignmentQuery.populate === "function"
        ? await assignmentQuery.populate("providerId", "businessName providerType")
        : await assignmentQuery;
      return {
        requestId: request._id,
        driver: publicUser(request.driverId),
        vehicleType: request.vehicleType,
        breakdownType: request.breakdownType,
        requiredService: request.requiredServiceType,
        status: request.status,
        provider: assignment?.providerId ? {
          providerId: assignment.providerId._id || assignment.providerId,
          businessName: assignment.providerId.businessName,
          providerType: assignment.providerId.providerType
        } : null,
        createdAt: request.createdAt
      };
    }));
    return res.status(200).json({ success: true, data: { requests: summaries } });
  } catch (error) { return next(error); }
}

async function getBreakdownRequestDetails(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) { res.status(400); throw new Error("Breakdown request id is invalid"); }
    const query = BreakdownRequest.findById(req.params.id);
    const request = typeof query.populate === "function"
      ? await query.populate("driverId", "name email phone isActive")
      : await query;
    if (!request) { res.status(404); throw new Error("Breakdown request not found"); }
    const assignmentQuery = RequestAssignment.findOne({ breakdownRequestId: request._id }).sort({ createdAt: -1 });
    const assignment = typeof assignmentQuery.populate === "function"
      ? await assignmentQuery.populate("providerId", "businessName providerType phone approvalStatus")
      : await assignmentQuery;
    const prediction = request.aiPrediction ? {
      predictedFault: request.aiPrediction.predictedFault,
      faultLabel: request.aiPrediction.faultLabel,
      requiredService: request.aiPrediction.requiredService,
      confidenceLevel: request.aiPrediction.confidenceLevel,
      needsMoreInformation: request.aiPrediction.needsMoreInformation,
      predictionSource: request.aiPrediction.predictionSource
    } : null;
    return res.status(200).json({
      success: true,
      data: {
        request: {
          requestId: request._id,
          driver: publicUser(request.driverId),
          vehicleType: request.vehicleType,
          vehicleModel: request.vehicleModel,
          breakdownType: request.breakdownType,
          symptomSummary: request.symptomCapture,
          diagnosticInputText: request.diagnosticInputText,
          aiPrediction: prediction,
          requiredService: request.requiredServiceType,
          provider: assignment?.providerId || null,
          assignmentStatus: assignment?.status || null,
          trackingStatus: request.status,
          estimatedCostRange: request.estimatedCostRange,
          finalCost: request.finalCost,
          createdAt: request.createdAt,
          completedAt: request.completedAt
        }
      }
    });
  } catch (error) { return next(error); }
}

async function listReviews(req, res, next) {
  try {
    const filter = {};
    if (req.query.provider && mongoose.Types.ObjectId.isValid(req.query.provider)) filter.providerId = req.query.provider;
    if (req.query.rating) filter.rating = Number(req.query.rating);
    if (req.query.date) {
      const date = new Date(req.query.date);
      if (!Number.isNaN(date.getTime())) filter.createdAt = { $gte: startOfDay(date), $lte: endOfDay(date) };
    }
    const query = Review.find(filter).sort({ createdAt: -1 });
    const reviews = typeof query.populate === "function"
      ? await query.populate("providerId", "businessName providerType").populate("driverId", "name")
      : await query;
    return res.status(200).json({ success: true, data: { reviews } });
  } catch (error) { return next(error); }
}

module.exports = {
  activateUser,
  approveProvider,
  createAdminAction,
  deactivateUser,
  getBreakdownRequestDetails,
  getDashboard,
  getProviderDetails,
  listBreakdownRequests,
  listDrivers,
  listProviders,
  listReviews,
  reactivateProvider,
  rejectProvider,
  suspendProvider
};
