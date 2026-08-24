const express = require("express");
const {
  acceptBreakdownRequest,
  cancelBreakdownRequest,
  createBreakdownRequest,
  getAssignedProviderRequests,
  getBreakdownRequestById,
  getBreakdownRequestRecommendations,
  getMyBreakdownRequests,
  requestClarification,
  rejectBreakdownRequest,
  reviewBreakdownRequest,
  selectProvider,
  submitClarificationAnswers,
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
router.get("/:id/recommendations", protect, authorizeRoles("driver"), getBreakdownRequestRecommendations);
router.post("/:id/clarification", protect, authorizeRoles("driver"), requestClarification);
router.post(
  "/:id/clarification-answer",
  protect,
  authorizeRoles("driver"),
  submitClarificationAnswers
);
router.get("/:id", protect, getBreakdownRequestById);
router.post("/:id/select-provider", protect, authorizeRoles("driver"), selectProvider);
router.patch("/:id/select-provider", protect, authorizeRoles("driver"), selectProvider);
router.post("/:id/accept", protect, authorizeRoles(...PROVIDER_ROLES), acceptBreakdownRequest);
router.post("/:id/reject", protect, authorizeRoles(...PROVIDER_ROLES), rejectBreakdownRequest);
router.patch("/:id/status", protect, authorizeRoles(...PROVIDER_ROLES), updateBreakdownRequestStatus);
router.post("/:id/cancel", protect, authorizeRoles("driver"), cancelBreakdownRequest);
router.patch("/:id/cancel", protect, authorizeRoles("driver"), cancelBreakdownRequest);
router.post("/:id/review", protect, authorizeRoles("driver"), reviewBreakdownRequest);

module.exports = router;
