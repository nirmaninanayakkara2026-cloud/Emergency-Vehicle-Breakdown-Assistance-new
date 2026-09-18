const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const babel = require("@babel/core");

const sourceRoot = path.resolve(__dirname, "../src");
const defaultLoader = require.extensions[".js"];
function compile(filename) {
  return babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, presets: [["babel-preset-expo", { disableImportExportTransform: false }]],
  }).code;
}
require.extensions[".js"] = function (module, filename) {
  if (!filename.startsWith(sourceRoot)) return defaultLoader(module, filename);
  return module._compile(compile(filename), filename);
};
const { canShowProviderRoute, shouldRefreshRequest, buildDirectionsUrl, buildRoadRouteUrl, parseRoadRoute } = require("../src/utils/providerTracking");
const { buildProviderRouteMapHtml } = require("../src/utils/providerRouteMap");
const provider = { latitude: 6.9271, longitude: 79.8612 };
const driver = { latitude: 6.915, longitude: 79.873 };

test("route is visible only after acceptance and hides for terminal or rejected requests", () => {
  for (const status of ["accepted", "provider_en_route", "on_the_way", "arrived", "in_progress"]) assert.equal(canShowProviderRoute(status), true);
  for (const status of [undefined, "pending", "recommended", "provider_requested", "provider_rejected", "completed", "cancelled"]) assert.equal(canShowProviderRoute(status), false);
  assert.equal(shouldRefreshRequest("provider_requested"), true);
  for (const status of ["cancelled", "completed", "provider_rejected"]) assert.equal(shouldRefreshRequest(status), false);
});

test("directions run from provider to driver and routing uses longitude first", () => {
  const url = new URL(buildDirectionsUrl(provider, driver));
  assert.equal(url.searchParams.get("origin"), "6.9271,79.8612");
  assert.equal(url.searchParams.get("destination"), "6.915,79.873");
  assert.equal(url.searchParams.get("travelmode"), "driving");
  assert.equal(url.searchParams.get("api"), "1");
  assert.match(buildRoadRouteUrl(provider, driver), /\/driving\/79\.8612,6\.9271;79\.873,6\.915\?/);
  for (const invalid of [null, {}, { latitude: null, longitude: 80 }, { latitude: "", longitude: 80 }, { latitude: 91, longitude: 80 }]) {
    assert.equal(buildDirectionsUrl(invalid, driver), null);
    assert.equal(buildRoadRouteUrl(provider, invalid), null);
  }
  assert.ok(buildDirectionsUrl({ latitude: 0, longitude: 0 }, driver));
});

function routeResponse() {
  return { code: "Ok", routes: [{ distance: 2100, duration: 301, geometry: { type: "LineString", coordinates: [[79.8612, 6.9271], [79.873, 6.915]] } }] };
}

test("road geometry converts GeoJSON coordinates and rejects unavailable or malformed routes", () => {
  assert.deepEqual(parseRoadRoute(routeResponse()), { coordinates: [provider, driver], distanceKm: 2.1, durationMinutes: 6 });
  for (const data of [null, {}, { code: "NoRoute", routes: [] }, { code: "Ok", routes: [] }]) assert.equal(parseRoadRoute(data), null);
  for (const coordinates of [[], [[79, 6]], [[79, 95], [80, 6]], [null, [80, 6]], [[79, null], [80, 6]]]) {
    const response = routeResponse();
    response.routes[0].geometry.coordinates = coordinates;
    assert.equal(parseRoadRoute(response), null);
  }
  const response = routeResponse();
  response.routes[0].duration = -1;
  assert.equal(parseRoadRoute(response), null);
});

test("embedded map shows fixed labeled pins, draws road geometry, and fits the full route", () => {
  const pins = [], lines = [], bounds = [], messages = [], removed = [], tileEvents = {};
  const map = { setView() { return this; }, fitBounds(points) { bounds.push(points); }, removeLayer(line) { removed.push(line); }, invalidateSize() {} };
  const window = { ReactNativeWebView: { postMessage(data) { messages.push(JSON.parse(data)); } }, addEventListener() {} };
  const context = vm.createContext({ window, L: {
    map() { return map; }, control: { attribution() { return { addTo() {} }; } },
    tileLayer() { return { on(name, fn) { tileEvents[name] = fn; }, addTo() {} }; }, divIcon(options) { return options; },
    marker(point, options) { pins.push({ point, options }); return { addTo() { return this; }, bindTooltip(label) { pins.at(-1).label = label; } }; },
    polyline(points) { const line = { points, addTo() { return this; } }; lines.push(line); return line; },
  } });
  const html = buildProviderRouteMapHtml(provider, driver);
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script[1], context);
  assert.equal(pins.length, 2);
  assert.equal(pins[0].label, "Provider service location");
  assert.equal(pins[1].label, "Your breakdown location");
  assert.equal(pins[0].options.draggable, undefined);
  assert.equal(lines.length, 0, "Do not invent a straight-line road route");
  assert.deepEqual(messages, [{ type: "initialized" }]);
  const detour = { latitude: 7, longitude: 80 };
  window.setRoadRoute([provider, detour, driver]);
  assert.equal(lines.length, 1);
  assert.equal(JSON.stringify(lines[0].points), JSON.stringify([[6.9271, 79.8612], [7, 80], [6.915, 79.873]]));
  assert.equal(bounds.at(-1).length, 5, "Fit both endpoints and the entire road geometry");
  window.setRoadRoute([]);
  assert.equal(removed.length, 1);
  tileEvents.tileerror();
  tileEvents.tileload();
  assert.deepEqual(messages.slice(-2), [{ type: "error" }, { type: "ready" }]);
  assert.match(html, /OpenStreetMap<\/a> contributors/);
  assert.doesNotMatch(buildProviderRouteMapHtml({ latitude: "</script><script>alert(1)</script>", longitude: 80 }, driver), /alert\(1\)/);
});

function mountPolling(load, enabled = true) {
  let cleanup, listener;
  const timers = new Map();
  let nextTimer = 0;
  const appState = { currentState: "active", addEventListener(_, fn) { listener = fn; return { remove() { listener = null; } }; } };
  const module = { exports: {} };
  vm.runInNewContext(compile(path.join(sourceRoot, "hooks/useRequestPolling.js")), {
    module, exports: module.exports,
    require(name) {
      if (name === "react") return { useCallback: (fn) => fn };
      if (name === "react-native") return { AppState: appState };
      if (name === "@react-navigation/native") return { useFocusEffect(fn) { cleanup = fn(); } };
      return require(name);
    },
    setTimeout(fn, delay) { assert.equal(delay, 10000); timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
  });
  module.exports.default(load, enabled);
  return { timers, cleanup: () => cleanup(), changeState(state) { appState.currentState = state; listener?.(state); }, async tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); await fn(); } };
}

test("polling detects acceptance, pauses in background, resumes and stops on blur", async () => {
  let calls = 0;
  const page = mountPolling(async () => { calls++; });
  await Promise.resolve();
  assert.equal(calls, 1);
  await page.tick();
  assert.equal(calls, 2);
  page.changeState("background");
  assert.equal(page.timers.size, 0);
  page.changeState("active");
  await Promise.resolve();
  assert.equal(calls, 3);
  page.cleanup();
  assert.equal(page.timers.size, 0);
});

test("polling ignores late responses after blur and does not repeat for terminal status", async () => {
  let resolve, isActive;
  const page = mountPolling((check) => { isActive = check; return new Promise((done) => { resolve = done; }); });
  assert.equal(isActive(), true);
  page.cleanup();
  assert.equal(isActive(), false);
  resolve();
  await Promise.resolve();
  assert.equal(page.timers.size, 0);
  const terminal = mountPolling(async () => {}, false);
  await Promise.resolve();
  assert.equal(terminal.timers.size, 0);
  terminal.cleanup();
});
