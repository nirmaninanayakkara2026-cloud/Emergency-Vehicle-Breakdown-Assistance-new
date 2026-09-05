const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "../src");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("registration exposes a dedicated spare-parts shop owner role", () => {
  const source = read("screens/auth/RegisterScreen.js");
  assert.match(source, /Spare Parts Shop Owner/); assert.match(source, /setRole\("spare_parts_shop"\)/); assert.match(source, /Service Provider/);
});

test("shop owner navigator includes dashboard, inventory, and item form", () => {
  const source = read("navigation/ProviderNavigator.js");
  for (const screen of ["SparePartsShopDashboard", "ShopInventory", "SparePartItemForm"]) assert.match(source, new RegExp(screen));
  assert.match(read("screens/provider/ProviderEntryScreen.js"), /SparePartsShopDashboard/);
});

test("provider dashboards separate approval and availability with offline notice", () => {
  for (const file of ["screens/provider/ProviderDashboardScreen.js", "screens/provider/SparePartsShopDashboardScreen.js"]) {
    const source = read(file); assert.match(source, /Approval:/); assert.match(source, /Availability:/);
    assert.match(source, /Your profile is approved, but drivers cannot find you while you are offline/);
  }
});

test("driver spare-parts flow uses live nearby inventory APIs", () => {
  const service = read("services/sparePartService.js");
  for (const endpoint of ["/spare-parts/shops/nearby", "/spare-parts/search", "/spare-parts/shops/"]) assert.match(service, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const finder = read("screens/driver/SparePartsFinderScreen.js");
  assert.match(finder, /Search for a Part/); assert.match(finder, /View Nearby Shops/); assert.doesNotMatch(finder, /mock/);
});

test("nearby results require location and support safe no-stock recovery", () => {
  const source = read("screens/driver/NearbySparePartsScreen.js");
  assert.match(source, /requestForegroundPermissionsAsync/); assert.match(source, /Increase Search Radius/); assert.match(source, /Try Another Search/); assert.match(source, /Only approved, active, online shops/);
  for (const radius of [5, 10, 20, 50]) assert.match(source, new RegExp(`label: "${radius} km", value: ${radius}`));
  assert.match(source, /useState\(10\)/); assert.doesNotMatch(source, /25 km/);
});

test("shop profile does not render or submit service radius", () => {
  const source = read("screens/provider/ProviderProfileScreen.js");
  assert.match(source, /shopOwner \? \{\} : \{ serviceRadiusKm/);
  assert.match(source, /!shopOwner \? <AppInput label="Service radius/);
});

test("driver details show stock status but never exact quantity", () => {
  const source = read("screens/driver/SparePartsShopDetailsScreen.js");
  assert.match(source, /stockStatus/); assert.match(source, /In stock/); assert.doesNotMatch(source, /item\.quantity/);
});

test("owner inventory prevents decrement below zero", () => {
  const source = read("screens/provider/ShopInventoryScreen.js");
  assert.match(source, /if \(quantity < 0\) return/); assert.match(source, /item\.quantity === 0/); assert.match(source, /updateSparePartQuantity/);
});
