const express = require("express");
const {
  createItem, deleteItem, getItem, getMyItems, getNearbyShops,
  getPublicShopDetails, searchParts, updateItem, updateQuantity
} = require("../controllers/sparePartController");
const { authorizeRoles, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/shops/nearby", protect, authorizeRoles("driver"), getNearbyShops);
router.get("/shops/:shopId", protect, authorizeRoles("driver"), getPublicShopDetails);
router.get("/search", protect, authorizeRoles("driver"), searchParts);

router.get("/my-items", protect, authorizeRoles("spare_parts_shop"), getMyItems);
router.post("/", protect, authorizeRoles("spare_parts_shop"), createItem);
router.get("/:itemId", protect, authorizeRoles("spare_parts_shop"), getItem);
router.patch("/:itemId", protect, authorizeRoles("spare_parts_shop"), updateItem);
router.delete("/:itemId", protect, authorizeRoles("spare_parts_shop"), deleteItem);
router.patch("/:itemId/quantity", protect, authorizeRoles("spare_parts_shop"), updateQuantity);

module.exports = router;
