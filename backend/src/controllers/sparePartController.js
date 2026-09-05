const mongoose = require("mongoose");
const ProviderProfile = require("../models/ProviderProfile");
const SparePartItem = require("../models/SparePartItem");
const { calculateDistanceKm } = require("../services/providerRecommendationService");
const { APPROVED_PROVIDER_QUERY, isProviderApproved } = require("../utils/providerApproval");
const { validateSparePartInput } = require("../utils/sparePartValidation");

const ITEM_FIELDS = [
  "name", "category", "brand", "partNumber", "compatibleVehicles",
  "price", "quantity", "description", "isAvailable"
];

function cleanItemPayload(body) {
  return ITEM_FIELDS.reduce((payload, field) => {
    if (body[field] !== undefined) payload[field] = body[field];
    return payload;
  }, {});
}

function normalizeItemPayload(payload) {
  const normalized = { ...payload };
  if (normalized.name !== undefined) normalized.name = String(normalized.name).trim();
  if (normalized.brand !== undefined) normalized.brand = String(normalized.brand).trim();
  if (normalized.partNumber !== undefined) normalized.partNumber = String(normalized.partNumber).trim();
  if (normalized.description !== undefined) normalized.description = String(normalized.description).trim();
  if (normalized.compatibleVehicles !== undefined) {
    normalized.compatibleVehicles = [...new Set(normalized.compatibleVehicles.map((value) => String(value).trim()).filter(Boolean))];
  }
  if (normalized.quantity !== undefined) normalized.quantity = Number(normalized.quantity);
  if (normalized.price === "" || normalized.price === null) normalized.price = null;
  else if (normalized.price !== undefined) normalized.price = Number(normalized.price);
  return normalized;
}

async function findOwnedShop(userId) {
  return ProviderProfile.findOne({ userId, providerType: "spare_parts_shop" });
}

async function requireOwnedShop(req, res) {
  const shop = await findOwnedShop(req.user._id);
  if (!shop) {
    res.status(404);
    throw new Error("Spare-parts shop profile not found");
  }
  return shop;
}

async function requireOwnedItem(req, res, shop) {
  if (!mongoose.Types.ObjectId.isValid(req.params.itemId)) {
    res.status(400);
    throw new Error("Spare-part item id is invalid");
  }
  const item = await SparePartItem.findById(req.params.itemId);
  if (!item) {
    res.status(404);
    throw new Error("Spare-part item not found");
  }
  if (String(item.shopId?._id || item.shopId) !== String(shop._id)) {
    res.status(403);
    throw new Error("You cannot manage another shop's inventory");
  }
  return item;
}

async function getMyItems(req, res, next) {
  try {
    const shop = await requireOwnedShop(req, res);
    const items = await SparePartItem.find({ shopId: shop._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: { shop, items } });
  } catch (error) { return next(error); }
}

async function createItem(req, res, next) {
  try {
    const shop = await requireOwnedShop(req, res);
    const payload = cleanItemPayload(req.body);
    const errors = validateSparePartInput(payload);
    if (errors.length) { res.status(400); throw new Error(errors.join(". ")); }
    const item = await SparePartItem.create({ ...normalizeItemPayload(payload), shopId: shop._id });
    return res.status(201).json({ success: true, message: "Spare part added", data: { item } });
  } catch (error) { return next(error); }
}

async function getItem(req, res, next) {
  try {
    const shop = await requireOwnedShop(req, res);
    const item = await requireOwnedItem(req, res, shop);
    return res.status(200).json({ success: true, data: { item } });
  } catch (error) { return next(error); }
}

async function updateItem(req, res, next) {
  try {
    const shop = await requireOwnedShop(req, res);
    const item = await requireOwnedItem(req, res, shop);
    const payload = cleanItemPayload(req.body);
    const errors = validateSparePartInput(payload, true);
    if (errors.length) { res.status(400); throw new Error(errors.join(". ")); }
    Object.assign(item, normalizeItemPayload(payload));
    await item.save();
    return res.status(200).json({ success: true, message: "Spare part updated", data: { item } });
  } catch (error) { return next(error); }
}

async function updateQuantity(req, res, next) {
  try {
    const shop = await requireOwnedShop(req, res);
    const item = await requireOwnedItem(req, res, shop);
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      res.status(400);
      throw new Error("Quantity must be a non-negative integer");
    }
    item.quantity = quantity;
    await item.save();
    return res.status(200).json({ success: true, message: "Quantity updated", data: { item } });
  } catch (error) { return next(error); }
}

async function deleteItem(req, res, next) {
  try {
    const shop = await requireOwnedShop(req, res);
    const item = await requireOwnedItem(req, res, shop);
    await item.deleteOne();
    return res.status(200).json({ success: true, message: "Spare part deleted", data: { itemId: item._id } });
  } catch (error) { return next(error); }
}

function parseNearbyInput(query, res) {
  const latitude = Number(query.latitude);
  const longitude = Number(query.longitude);
  const radius = query.radius === undefined ? 10 : Number(query.radius);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    res.status(400);
    throw new Error("Valid latitude and longitude are required");
  }
  if (!Number.isFinite(radius) || radius <= 0 || radius > 100) {
    res.status(400);
    throw new Error("Radius must be between 0 and 100 km");
  }
  return { latitude, longitude, radius };
}

async function approvedOnlineShopProfiles() {
  const query = ProviderProfile.find({
    providerType: "spare_parts_shop",
    ...APPROVED_PROVIDER_QUERY,
    isActive: { $ne: false },
    availabilityStatus: "online"
  });
  const profiles = typeof query.populate === "function" ? await query.populate("userId", "isActive") : await query;
  return profiles.filter((shop) =>
    isProviderApproved(shop) &&
    shop.isActive !== false &&
    shop.userId?.isActive !== false &&
    shop.availabilityStatus === "online"
  );
}

async function findNearbyShopRecords(input) {
  const shops = await approvedOnlineShopProfiles();
  const nearby = shops.map((shop) => {
    if (!shop.location || !Number.isFinite(Number(shop.location.latitude)) || !Number.isFinite(Number(shop.location.longitude))) return null;
    const distanceKm = calculateDistanceKm(input, shop.location);
    if (distanceKm > input.radius) return null;
    return { shop, distanceKm: Number(distanceKm.toFixed(2)) };
  }).filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
  return nearby;
}

async function publicShopResult(record, matchingItems) {
  const availableItems = matchingItems || await SparePartItem.find({
    shopId: record.shop._id,
    isAvailable: true,
    quantity: { $gt: 0 }
  }).sort({ name: 1 });
  return {
    shopId: record.shop._id,
    businessName: record.shop.businessName,
    address: record.shop.location?.address,
    location: record.shop.location,
    phone: record.shop.phone,
    description: record.shop.description,
    openingHours: record.shop.openingHours,
    availabilityStatus: record.shop.availabilityStatus,
    rating: Number(record.shop.averageRating || 0),
    totalReviews: Number(record.shop.totalReviews || 0),
    distanceKm: record.distanceKm,
    availableItemCount: availableItems.length,
    matchingItems: matchingItems ? matchingItems.map(publicItem) : undefined
  };
}

function publicItem(item) {
  return {
    itemId: item._id,
    name: item.name,
    category: item.category,
    brand: item.brand,
    partNumber: item.partNumber,
    compatibleVehicles: item.compatibleVehicles || [],
    price: item.price,
    description: item.description,
    stockStatus: item.isAvailable && item.quantity > 0 ? "in_stock" : "out_of_stock"
  };
}

async function getNearbyShops(req, res, next) {
  try {
    const input = parseNearbyInput(req.query, res);
    const records = await findNearbyShopRecords(input);
    const shops = await Promise.all(records.map((record) => publicShopResult(record)));
    return res.status(200).json({ success: true, data: { shops, radiusKm: input.radius } });
  } catch (error) { return next(error); }
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function searchParts(req, res, next) {
  try {
    const input = parseNearbyInput(req.query, res);
    const search = String(req.query.item || "").trim();
    if (!search) { res.status(400); throw new Error("A spare-part search term is required"); }
    const records = await findNearbyShopRecords(input);
    const shopIds = records.map((record) => record.shop._id);
    const expression = new RegExp(escapeRegex(search), "i");
    const foundItems = await SparePartItem.find({
      shopId: { $in: shopIds },
      isAvailable: true,
      quantity: { $gt: 0 },
      $or: [
        { name: expression }, { category: expression }, { brand: expression },
        { partNumber: expression }, { compatibleVehicles: expression }
      ]
    }).sort({ price: 1, name: 1 });
    const items = foundItems.filter((item) => item.isAvailable === true && Number(item.quantity) > 0);
    const byShop = new Map();
    items.forEach((item) => {
      const key = String(item.shopId?._id || item.shopId);
      if (!byShop.has(key)) byShop.set(key, []);
      byShop.get(key).push(item);
    });
    let shops = await Promise.all(records
      .filter((record) => byShop.has(String(record.shop._id)))
      .map((record) => publicShopResult(record, byShop.get(String(record.shop._id)))));
    if (req.query.sort === "price") {
      shops = shops.sort((a, b) => (a.matchingItems[0]?.price ?? Infinity) - (b.matchingItems[0]?.price ?? Infinity));
    }
    return res.status(200).json({ success: true, data: { shops, search, radiusKm: input.radius } });
  } catch (error) { return next(error); }
}

async function getPublicShopDetails(req, res, next) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.shopId)) { res.status(400); throw new Error("Shop id is invalid"); }
    const query = ProviderProfile.findOne({
      _id: req.params.shopId,
      providerType: "spare_parts_shop",
      ...APPROVED_PROVIDER_QUERY,
      isActive: { $ne: false },
      availabilityStatus: "online"
    });
    const shop = typeof query.populate === "function" ? await query.populate("userId", "isActive") : await query;
    if (!shop || !isProviderApproved(shop) || shop.isActive === false || shop.userId?.isActive === false || shop.availabilityStatus !== "online") {
      res.status(404);
      throw new Error("Approved online spare-parts shop not found");
    }
    const items = await SparePartItem.find({ shopId: shop._id, isAvailable: true }).sort({ quantity: -1, name: 1 });
    const distanceKm = Number.isFinite(Number(req.query.latitude)) && Number.isFinite(Number(req.query.longitude))
      ? Number(calculateDistanceKm({ latitude: Number(req.query.latitude), longitude: Number(req.query.longitude) }, shop.location).toFixed(2))
      : null;
    return res.status(200).json({
      success: true,
      data: {
        shop: {
          shopId: shop._id, businessName: shop.businessName, address: shop.location?.address,
          location: shop.location, phone: shop.phone, description: shop.description,
          openingHours: shop.openingHours, availabilityStatus: shop.availabilityStatus,
          rating: shop.averageRating, totalReviews: shop.totalReviews, distanceKm
        },
        items: items.map(publicItem)
      }
    });
  } catch (error) { return next(error); }
}

module.exports = {
  createItem, deleteItem, findNearbyShopRecords, getItem, getMyItems,
  getNearbyShops, getPublicShopDetails, publicItem, searchParts,
  updateItem, updateQuantity
};
