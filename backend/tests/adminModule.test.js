const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const AdminAction = require("../src/models/AdminAction");
const ProviderProfile = require("../src/models/ProviderProfile");
const { User } = require("../src/models/User");
const admin = require("../src/controllers/adminController");
const providerController = require("../src/controllers/providerController");
const { requireAdmin } = require("../src/middleware/authMiddleware");
const {
  rankProviders,
} = require("../src/services/providerRecommendationService");

const adminId = new mongoose.Types.ObjectId();
const providerId = new mongoose.Types.ObjectId();
const providerUserId = new mongoose.Types.ObjectId();

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

function profile(overrides = {}) {
  return {
    _id: providerId,
    userId: {
      _id: providerUserId,
      name: "Provider Owner",
      email: "owner@example.com",
      phone: "0711111111",
      role: "mechanic",
      isActive: true,
    },
    providerType: "mechanic",
    businessName: "Trusted Service",
    phone: "0711111111",
    specializations: ["engine_mechanic"],
    serviceCategories: ["engine_mechanic"],
    supportedVehicleTypes: ["car"],
    location: { latitude: 6.9271, longitude: 79.8612, address: "Colombo" },
    serviceRadiusKm: 20,
    availabilityStatus: "online",
    approvalStatus: "pending",
    isApproved: false,
    isActive: true,
    averageRating: 4.5,
    totalReviews: 2,
    completedJobs: 3,
    approvalHistory: [],
    async save() {
      this.saved = true;
    },
    ...overrides,
  };
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

const recommendationInput = {
  requiredServiceType: "engine_mechanic",
  latitude: 6.9271,
  longitude: 79.8612,
  vehicleType: "car",
  breakdownType: "engine_problem",
};

test("admin authorization returns 401 without authentication and 403 for non-admin", () => {
  let error;
  const unauthenticated = response();
  requireAdmin({}, unauthenticated, (value) => {
    error = value;
  });
  assert.equal(unauthenticated.statusCode, 401);
  assert.match(error.message, /Authentication/);
  const forbidden = response();
  requireAdmin({ user: { role: "driver" } }, forbidden, (value) => {
    error = value;
  });
  assert.equal(forbidden.statusCode, 403);
  assert.match(error.message, /Administrator/);
  let passed = false;
  requireAdmin({ user: { role: "admin" } }, response(), () => {
    passed = true;
  });
  assert.equal(passed, true);
});

test("admin lists pending providers", async () => {
  const originalFind = ProviderProfile.find;
  ProviderProfile.find = (filter) => {
    assert.equal(filter.approvalStatus, "pending");
    return query([profile()]);
  };
  try {
    const { res, error } = await invoke(admin.listProviders, {
      query: { status: "pending" },
      user: { _id: adminId, role: "admin" },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.data.providers.length, 1);
    assert.equal(res.body.data.providers[0].approvalStatus, "pending");
  } finally {
    ProviderProfile.find = originalFind;
  }
});

test("admin approval makes a provider eligible and writes an audit action", async () => {
  const item = profile();
  const originalFind = ProviderProfile.findById;
  const originalCreate = AdminAction.create;
  let audit;
  ProviderProfile.findById = () => query(item);
  AdminAction.create = async (payload) => {
    audit = payload;
    return payload;
  };
  try {
    const { res, error } = await invoke(admin.approveProvider, {
      params: { providerId: String(providerId) },
      body: {},
      user: { _id: adminId, role: "admin" },
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(item.approvalStatus, "approved");
    assert.equal(item.isApproved, true);
    assert.ok(item.approvedAt instanceof Date);
    assert.equal(String(item.approvedBy), String(adminId));
    assert.equal(audit.actionType, "PROVIDER_APPROVED");
    assert.equal(
      rankProviders([item], recommendationInput).providers.length,
      1,
    );
  } finally {
    ProviderProfile.findById = originalFind;
    AdminAction.create = originalCreate;
  }
});

test("provider rejection requires a reason and records it", async () => {
  const missing = await invoke(admin.rejectProvider, {
    params: { providerId: String(providerId) },
    body: {},
    user: { _id: adminId },
  });
  assert.equal(missing.res.statusCode, 400);
  assert.match(missing.error.message, /reason/i);
  const item = profile();
  const originalFind = ProviderProfile.findById;
  const originalCreate = AdminAction.create;
  ProviderProfile.findById = () => query(item);
  AdminAction.create = async (payload) => payload;
  try {
    const result = await invoke(admin.rejectProvider, {
      params: { providerId: String(providerId) },
      body: { reason: "Location not verified" },
      user: { _id: adminId },
    });
    assert.equal(result.error, undefined);
    assert.equal(item.approvalStatus, "rejected");
    assert.equal(item.rejectionReason, "Location not verified");
    assert.equal(item.availabilityStatus, "offline");
  } finally {
    ProviderProfile.findById = originalFind;
    AdminAction.create = originalCreate;
  }
});

test("rejected provider can resubmit and becomes pending", async () => {
  const item = profile({
    approvalStatus: "rejected",
    rejectionReason: "Missing location",
    rejectedAt: new Date(),
    rejectedBy: adminId,
  });
  const originalFind = ProviderProfile.findOne;
  ProviderProfile.findOne = async () => item;
  try {
    const { res, error } = await invoke(
      providerController.resubmitProviderProfile,
      { user: { _id: providerUserId }, body: {} },
    );
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(item.approvalStatus, "pending");
    assert.equal(item.rejectionReason, "");
    assert.equal(item.approvalHistory[0].reason, "Missing location");
  } finally {
    ProviderProfile.findOne = originalFind;
  }
});

test("suspended providers are hidden and reactivation keeps them offline", async () => {
  const item = profile({ approvalStatus: "approved", isApproved: true });
  const originalFind = ProviderProfile.findById;
  const originalCreate = AdminAction.create;
  ProviderProfile.findById = () => query(item);
  AdminAction.create = async (payload) => payload;
  try {
    const suspended = await invoke(admin.suspendProvider, {
      params: { providerId: String(providerId) },
      body: { reason: "Repeated complaints" },
      user: { _id: adminId },
    });
    assert.equal(suspended.error, undefined);
    assert.equal(item.approvalStatus, "suspended");
    assert.equal(item.availabilityStatus, "offline");
    assert.equal(
      rankProviders([item], recommendationInput).providers.length,
      0,
    );
    const reactivated = await invoke(admin.reactivateProvider, {
      params: { providerId: String(providerId) },
      body: {},
      user: { _id: adminId },
    });
    assert.equal(reactivated.error, undefined);
    assert.equal(item.approvalStatus, "approved");
    assert.equal(item.availabilityStatus, "offline");
  } finally {
    ProviderProfile.findById = originalFind;
    AdminAction.create = originalCreate;
  }
});

test("approval, account activity, and availability independently control recommendation visibility", () => {
  const approved = profile({
    approvalStatus: "approved",
    isApproved: false,
    userId: { isActive: true, isVerified: false },
  });
  assert.equal(
    rankProviders([approved], recommendationInput).providers.length,
    1,
  );
  assert.equal(
    rankProviders(
      [
        profile({
          approvalStatus: "pending",
          isApproved: true,
        }),
      ],
      recommendationInput,
    ).providers.length,
    0,
  );
  assert.equal(
    rankProviders(
      [
        profile({
          approvalStatus: "rejected",
          isApproved: false,
        }),
      ],
      recommendationInput,
    ).providers.length,
    0,
  );
  assert.equal(
    rankProviders(
      [
        profile({
          approvalStatus: "suspended",
          isApproved: false,
        }),
      ],
      recommendationInput,
    ).providers.length,
    0,
  );
  assert.equal(
    rankProviders(
      [
        profile({
          approvalStatus: "approved",
          isApproved: true,
          availabilityStatus: "offline",
        }),
      ],
      recommendationInput,
    ).providers.length,
    0,
  );
  assert.equal(
    rankProviders(
      [
        profile({
          approvalStatus: "approved",
          isApproved: true,
          userId: { isActive: false },
        }),
      ],
      recommendationInput,
    ).providers.length,
    0,
  );
});

test("spare-parts shops use the same approval filter", async () => {
  const originalFind = ProviderProfile.find;
  let captured;
  ProviderProfile.find = (filter) => {
    captured = filter;
    return query([
      profile({
        providerType: "spare_parts_shop",
        approvalStatus: "approved",
        isApproved: true,
      }),
    ]);
  };
  try {
    const { res, error } = await invoke(providerController.getProviders, {
      query: { providerType: "spare_parts_shop", availabilityStatus: "online" },
    });
    assert.equal(error, undefined);
    assert.equal(captured.approvalStatus, "approved");
    assert.equal(captured.providerType, "spare_parts_shop");
    assert.equal(captured.availabilityStatus, "online");
    assert.equal(res.body.data.providers.length, 1);
  } finally {
    ProviderProfile.find = originalFind;
  }
});

test("provider-facing payload allowlist cannot modify approval fields", async () => {
  const item = profile({ approvalStatus: "pending" });
  const originalUpdate = ProviderProfile.findOneAndUpdate;
  let updates;
  ProviderProfile.findOneAndUpdate = async (_filter, payload) => {
    updates = payload;
    return item;
  };
  try {
    const result = await invoke(providerController.updateMyProviderProfile, {
      user: { _id: providerUserId, role: "mechanic" },
      body: {
        businessName: "Updated",
        approvalStatus: "approved",
        approvedBy: providerUserId,
        suspensionReason: "cleared",
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(updates.approvalStatus, undefined);
    assert.equal(updates.approvedBy, undefined);
    assert.equal(updates.suspensionReason, undefined);
    assert.equal(updates.availabilityStatus, undefined);
  } finally {
    ProviderProfile.findOneAndUpdate = originalUpdate;
  }
});

test("admin deactivation preserves user data, forces provider offline, and audits the action", async () => {
  const providerUser = {
    _id: providerUserId,
    role: "mechanic",
    name: "Owner",
    email: "owner@example.com",
    phone: "071",
    isActive: true,
    async save() {
      this.saved = true;
    },
  };
  const originalUserFind = User.findById;
  const originalUpdate = ProviderProfile.updateOne;
  const originalCreate = AdminAction.create;
  let profileUpdate;
  let audit;
  User.findById = async () => providerUser;
  ProviderProfile.updateOne = async (filter, update) => {
    profileUpdate = { filter, update };
  };
  AdminAction.create = async (payload) => {
    audit = payload;
    return payload;
  };
  try {
    const { res, error } = await invoke(admin.deactivateUser, {
      params: { userId: String(providerUserId) },
      body: { reason: "Policy review" },
      user: { _id: adminId, role: "admin" },
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 200);
    assert.equal(providerUser.isActive, false);
    assert.equal(providerUser.saved, true);
    assert.equal(profileUpdate.update.availabilityStatus, "offline");
    assert.equal(audit.actionType, "USER_DEACTIVATED");
    assert.equal(audit.reason, "Policy review");
  } finally {
    User.findById = originalUserFind;
    ProviderProfile.updateOne = originalUpdate;
    AdminAction.create = originalCreate;
  }
});
