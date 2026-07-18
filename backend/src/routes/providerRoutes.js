const express = require("express");
const {
  createProviderProfile,
  getMyProviderProfile,
  getProviderById,
  getProviders,
  updateAvailability,
  updateMyProviderProfile
} = require("../controllers/providerController");
const { authorizeRoles, protect } = require("../middleware/authMiddleware");
const { PROVIDER_ROLES } = require("../utils/domainConstants");

const router = express.Router();

router.post("/profile", protect, authorizeRoles(...PROVIDER_ROLES), createProviderProfile);
router.get("/profile/me", protect, authorizeRoles(...PROVIDER_ROLES), getMyProviderProfile);
router.patch("/profile/me", protect, authorizeRoles(...PROVIDER_ROLES), updateMyProviderProfile);
router.patch("/availability", protect, authorizeRoles(...PROVIDER_ROLES), updateAvailability);
router.get("/", getProviders);
router.get("/:id", getProviderById);

module.exports = router;
