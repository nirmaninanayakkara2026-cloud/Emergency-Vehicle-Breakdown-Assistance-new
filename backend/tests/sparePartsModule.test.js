const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const ProviderProfile = require("../src/models/ProviderProfile");
const SparePartItem = require("../src/models/SparePartItem");
const spareParts = require("../src/controllers/sparePartController");
const { validateSparePartInput } = require("../src/utils/sparePartValidation");
const { SPARE_PART_CATEGORIES } = require("../src/config/sparePartCategories");
const { User } = require("../src/models/User");
const { authorizeRoles } = require("../src/middleware/authMiddleware");
const { validateRegisterInput } = require("../src/utils/validation");
const {
  validateProviderProfileInput,
} = require("../src/utils/providerValidation");

const userId = new mongoose.Types.ObjectId();
const shopId = new mongoose.Types.ObjectId();
const itemId = new mongoose.Types.ObjectId();
function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return body;
    },
  };
}
async function invoke(handler, req) {
  const res = response();
  let error;
  await handler(req, res, (value) => {
    error = value;
  });
  return { res, error };
}
function query(value) {
  return {
    sort() {
      return this;
    },
    populate() {
      return this;
    },
    then(resolve) {
      return Promise.resolve(resolve(value));
    },
  };
}
function shop(overrides = {}) {
  return {
    _id: shopId,
    userId: { isActive: true, isVerified: false },
    providerType: "spare_parts_shop",
    businessName: "Battery Hub",
    phone: "0710000000",
    location: { latitude: 6.9271, longitude: 79.8612, address: "Colombo" },
    approvalStatus: "approved",
    isApproved: true,
    isActive: true,
    availabilityStatus: "online",
    averageRating: 4.5,
    totalReviews: 4,
    ...overrides,
  };
}
function item(overrides = {}) {
  return {
    _id: itemId,
    shopId,
    name: "12V Battery",
    category: "Battery",
    brand: "Amaron",
    partNumber: "A-12",
    compatibleVehicles: ["Toyota Aqua"],
    price: 25000,
    quantity: 4,
    isAvailable: true,
    async save() {
      this.saved = true;
    },
    async deleteOne() {
      this.deleted = true;
    },
    ...overrides,
  };
}

test("spare-part model uses normalized shop relationship and required indexes", () => {
  assert.equal(
    SparePartItem.schema.path("shopId").options.ref,
    "ProviderProfile",
  );
  assert.equal(
    SparePartItem.schema.path("category").options.enum.length,
    SPARE_PART_CATEGORIES.length,
  );
  const indexes = SparePartItem.schema
    .indexes()
    .map(([keys]) => JSON.stringify(keys));
  assert.ok(indexes.includes(JSON.stringify({ shopId: 1 })));
  assert.ok(indexes.includes(JSON.stringify({ shopId: 1, category: 1 })));
});

test("shop role is supported and new shop profiles default to pending", () => {
  assert.ok(User.schema.path("role").enumValues.includes("spare_parts_shop"));
  const pending = new ProviderProfile({
    userId,
    providerType: "spare_parts_shop",
    businessName: "Battery Hub",
    phone: "071",
    location: { latitude: 6.9, longitude: 79.8, address: "Colombo" },
  });
  assert.equal(pending.approvalStatus, "pending");
  assert.equal(pending.isApproved, false);
  assert.equal(pending.availabilityStatus, "offline");
  assert.equal(pending.validateSync(), undefined);
  const mechanic = new ProviderProfile({
    userId: new mongoose.Types.ObjectId(),
    providerType: "mechanic",
    businessName: "Roadside",
    phone: "072",
    location: { latitude: 6.9, longitude: 79.8, address: "Colombo" },
  });
  assert.match(
    mechanic.validateSync().errors.serviceRadiusKm.message,
    /required/i,
  );
  assert.deepEqual(
    validateProviderProfileInput({
      providerType: "spare_parts_shop",
      businessName: "Shop",
      phone: "071",
      location: { latitude: 6.9, longitude: 79.8, address: "Colombo" },
      serviceRadiusKm: "not-used",
    }),
    [],
  );
});

test("public registration accepts shop owners but cannot create admins", () => {
  const input = {
    name: "Owner",
    email: "owner@example.com",
    phone: "071",
    password: "secret1",
  };
  assert.deepEqual(
    validateRegisterInput({ ...input, role: "spare_parts_shop" }),
    [],
  );
  assert.match(
    validateRegisterInput({ ...input, role: "admin" }).join(" "),
    /Role must be one of/,
  );
});

test("inventory validation rejects negative quantities and unknown categories", () => {
  const errors = validateSparePartInput({
    name: "Battery",
    category: "Unknown",
    quantity: -1,
  });
  assert.match(errors.join(" "), /Category/);
  assert.match(errors.join(" "), /non-negative/);
  assert.deepEqual(
    validateSparePartInput({
      name: "Battery",
      category: "Battery",
      quantity: 0,
      price: 0,
      compatibleVehicles: [],
    }),
    [],
  );
});

test("shop owner can create an inventory item tied to their profile", async () => {
  const oldFind = ProviderProfile.findOne;
  const oldCreate = SparePartItem.create;
  let created;
  ProviderProfile.findOne = async () => shop();
  SparePartItem.create = async (payload) => {
    created = payload;
    return item(payload);
  };
  try {
    const result = await invoke(spareParts.createItem, {
      user: { _id: userId },
      body: {
        name: " 12V Battery ",
        category: "Battery",
        quantity: 2,
        compatibleVehicles: ["car", "car"],
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.res.statusCode, 201);
    assert.equal(String(created.shopId), String(shopId));
    assert.equal(created.name, "12V Battery");
    assert.deepEqual(created.compatibleVehicles, ["car"]);
  } finally {
    ProviderProfile.findOne = oldFind;
    SparePartItem.create = oldCreate;
  }
});

test("quantity cannot go below zero", async () => {
  const oldShop = ProviderProfile.findOne;
  const oldItem = SparePartItem.findById;
  ProviderProfile.findOne = async () => shop();
  SparePartItem.findById = async () => item();
  try {
    const result = await invoke(spareParts.updateQuantity, {
      user: { _id: userId },
      params: { itemId: String(itemId) },
      body: { quantity: -1 },
    });
    assert.equal(result.res.statusCode, 400);
    assert.match(result.error.message, /non-negative/);
  } finally {
    ProviderProfile.findOne = oldShop;
    SparePartItem.findById = oldItem;
  }
});

test("shop owner cannot update another shop's item", async () => {
  const oldShop = ProviderProfile.findOne;
  const oldItem = SparePartItem.findById;
  ProviderProfile.findOne = async () => shop();
  SparePartItem.findById = async () =>
    item({ shopId: new mongoose.Types.ObjectId() });
  try {
    const result = await invoke(spareParts.updateQuantity, {
      user: { _id: userId },
      params: { itemId: String(itemId) },
      body: { quantity: 1 },
    });
    assert.equal(result.res.statusCode, 403);
    assert.match(result.error.message, /another shop/);
  } finally {
    ProviderProfile.findOne = oldShop;
    SparePartItem.findById = oldItem;
  }
});

test("nearby discovery uses only driver-selected radius and eligibility", async () => {
  const oldFind = ProviderProfile.find;
  let filter;
  const near = shop({
    _id: new mongoose.Types.ObjectId(),
    location: { latitude: 6.9541, longitude: 79.8612 },
  });
  const farther = shop({
    _id: new mongoose.Types.ObjectId(),
    location: { latitude: 6.9991, longitude: 79.8612 },
  });
  const offline = shop({
    _id: new mongoose.Types.ObjectId(),
    availabilityStatus: "offline",
    location: { latitude: 6.94, longitude: 79.8612 },
  });
  const pending = shop({
    _id: new mongoose.Types.ObjectId(),
    approvalStatus: "pending",
    isApproved: true,
    location: { latitude: 6.94, longitude: 79.8612 },
  });
  ProviderProfile.find = (value) => {
    filter = value;
    return query([farther, offline, pending, near]);
  };
  try {
    const withinFive = await spareParts.findNearbyShopRecords({
      latitude: 6.9271,
      longitude: 79.8612,
      radius: 5,
    });
    assert.deepEqual(
      withinFive.map((record) => String(record.shop._id)),
      [String(near._id)],
    );
    assert.ok(withinFive[0].distanceKm > 2.9 && withinFive[0].distanceKm < 3.2);
    const withinTen = await spareParts.findNearbyShopRecords({
      latitude: 6.9271,
      longitude: 79.8612,
      radius: 10,
    });
    assert.deepEqual(
      withinTen.map((record) => String(record.shop._id)),
      [String(near._id), String(farther._id)],
    );
    assert.equal(filter.providerType, "spare_parts_shop");
    assert.equal(filter.approvalStatus, "approved");
    assert.equal(filter.availabilityStatus, "online");
    assert.equal(filter.serviceRadiusKm, undefined);
  } finally {
    ProviderProfile.find = oldFind;
  }
});

test("public inventory hides exact quantity while keeping stock status", () => {
  const publicItem = spareParts.publicItem(item({ quantity: 2 }));
  assert.equal(publicItem.stockStatus, "in_stock");
  assert.equal(publicItem.quantity, undefined);
  assert.equal(publicItem.name, "12V Battery");
});

test("part search returns only nearby in-stock matches", async () => {
  const oldProfiles = ProviderProfile.find;
  const oldItems = SparePartItem.find;
  let itemFilter;
  ProviderProfile.find = () => query([shop()]);
  SparePartItem.find = (filter) => {
    itemFilter = filter;
    return query([item()]);
  };
  try {
    const result = await invoke(spareParts.searchParts, {
      query: {
        latitude: "6.9271",
        longitude: "79.8612",
        radius: "10",
        item: "battery",
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.res.body.data.shops.length, 1);
    assert.equal(itemFilter.isAvailable, true);
    assert.deepEqual(itemFilter.quantity, { $gt: 0 });
    assert.equal(
      result.res.body.data.shops[0].matchingItems[0].stockStatus,
      "in_stock",
    );
  } finally {
    ProviderProfile.find = oldProfiles;
    SparePartItem.find = oldItems;
  }
});

test("part search excludes a matching item whose quantity is zero", async () => {
  const oldProfiles = ProviderProfile.find;
  const oldItems = SparePartItem.find;
  ProviderProfile.find = () => query([shop()]);
  SparePartItem.find = () => query([item({ quantity: 0 })]);
  try {
    const result = await invoke(spareParts.searchParts, {
      query: {
        latitude: "6.9271",
        longitude: "79.8612",
        radius: "10",
        item: "battery",
      },
    });
    assert.equal(result.error, undefined);
    assert.deepEqual(result.res.body.data.shops, []);
  } finally {
    ProviderProfile.find = oldProfiles;
    SparePartItem.find = oldItems;
  }
});

test("inventory role guard blocks drivers and permits shop owners", () => {
  const guard = authorizeRoles("spare_parts_shop");
  let nextCalled = false;
  let error;
  const denied = response();
  guard({ user: { role: "driver" } }, denied, (value) => {
    error = value;
  });
  assert.equal(denied.statusCode, 403);
  assert.match(error.message, /permission/);
  guard({ user: { role: "spare_parts_shop" } }, response(), () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
});
