const express = require("express");
const {
  cancelBreakdownRequest,
  createBreakdownRequest,
  getAssignedProviderRequests,
  getBreakdownRequestById,
  getMyBreakdownRequests,
  selectProvider,
  updateBreakdownRequestStatus
} = require("../controllers/breakdownRequestController");
const { authorizeRoles, protect } = require("../middleware/authMiddleware");
const { PROVIDER_ROLES } = require("../utils/domainConstants");

const router = express.Router();

router.post("/", protect, authorizeRoles("driver"), createBreakdownRequest);
router.get("/my", protect, authorizeRoles("driver"), getMyBreakdownRequests);
router.get(
  "/provider/assigned",
  protect,
  authorizeRoles(...PROVIDER_ROLES),
  getAssignedProviderRequests
);
router.get("/:id", protect, getBreakdownRequestById);
router.patch("/:id/select-provider", protect, authorizeRoles("driver"), selectProvider);
router.patch("/:id/status", protect, authorizeRoles(...PROVIDER_ROLES), updateBreakdownRequestStatus);
router.patch("/:id/cancel", protect, authorizeRoles("driver"), cancelBreakdownRequest);

module.exports = router;
