const express = require("express");
const {
  activateUser,
  approveProvider,
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
} = require("../controllers/adminController");
const { protect, requireAdmin } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect, requireAdmin);

router.get("/dashboard", getDashboard);
router.get("/providers", listProviders);
router.get("/providers/:providerId", getProviderDetails);
router.post("/providers/:providerId/approve", approveProvider);
router.post("/providers/:providerId/reject", rejectProvider);
router.post("/providers/:providerId/suspend", suspendProvider);
router.post("/providers/:providerId/reactivate", reactivateProvider);
router.get("/drivers", listDrivers);
router.post("/users/:userId/deactivate", deactivateUser);
router.post("/users/:userId/activate", activateUser);
router.get("/breakdown-requests", listBreakdownRequests);
router.get("/breakdown-requests/:id", getBreakdownRequestDetails);
router.get("/reviews", listReviews);

module.exports = router;
