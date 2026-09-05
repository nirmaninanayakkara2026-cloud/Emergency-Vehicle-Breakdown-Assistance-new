const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../src");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("admin navigator uses dedicated operational screens", () => {
  const source = read("navigation/AdminNavigator.js");
  for (const screen of ["AdminDashboardScreen", "AdminProvidersScreen", "AdminProviderDetailsScreen", "AdminUsersScreen", "AdminRequestsScreen", "AdminReviewsScreen"]) {
    assert.match(source, new RegExp(screen));
  }
  assert.doesNotMatch(source, /AdminPlaceholderScreen/);
});

test("admin mobile service covers protected management endpoints", () => {
  const source = read("services/adminService.js");
  for (const endpoint of ["/admin/dashboard", "/admin/providers", "/approve", "/reject", "/suspend", "/reactivate", "/admin/drivers", "/deactivate", "/activate", "/admin/breakdown-requests", "/admin/reviews"]) {
    assert.match(source, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("provider dashboard separates approval from availability and supports resubmission", () => {
  const dashboard = read("screens/provider/ProviderDashboardScreen.js");
  const profile = read("screens/provider/ProviderProfileScreen.js");
  assert.match(dashboard, /Pending Approval/);
  assert.match(dashboard, /Your profile is under review/);
  assert.match(dashboard, /Edit & Resubmit/);
  assert.match(dashboard, /approvalStatus !== "approved"/);
  assert.match(profile, /resubmitProviderProfile/);
  assert.match(profile, /Save & Resubmit/);
});

test("spare-parts finder uses approved backend providers instead of mock shops", () => {
  const service = read("services/requestService.js");
  assert.match(service, /providerType: "spare_parts_shop"/);
  assert.match(service, /availabilityStatus: "online"/);
  assert.doesNotMatch(service, /mockSparePartsShops/);
});

test("admin rejection UI requires a written reason", () => {
  const details = read("screens/admin/AdminProviderDetailsScreen.js");
  assert.match(details, /reason\.trim\(\)/);
  assert.match(details, /reason is required/);
  assert.match(details, /Reason required for reject or suspend/);
});

test("admin UI separates approval, availability, and account state", () => {
  const list = read("screens/admin/AdminProvidersScreen.js");
  const details = read("screens/admin/AdminProviderDetailsScreen.js");
  for (const label of ["Approval Status:", "Availability:", "Account:"]) {
    assert.match(list, new RegExp(label)); assert.match(details, new RegExp(label));
  }
});
