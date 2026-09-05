const express = require("express");
const { resubmitProviderProfile } = require("../controllers/providerController");
const { authorizeRoles, protect } = require("../middleware/authMiddleware");
const { PROVIDER_ROLES } = require("../utils/domainConstants");

const router = express.Router();
router.post("/resubmit", protect, authorizeRoles(...PROVIDER_ROLES), resubmitProviderProfile);

module.exports = router;
