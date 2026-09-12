const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const babel = require("@babel/core");

const sourceRoot = path.resolve(__dirname, "../src");
const defaultLoader = require.extensions[".js"];
require.extensions[".js"] = function compileMobileSource(module, filename) {
  if (!filename.startsWith(sourceRoot)) return defaultLoader(module, filename);
  const compiled = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    presets: [["babel-preset-expo", { disableImportExportTransform: false }]]
  });
  return module._compile(compiled.code, filename);
};

const { buildMapHtml, parseMapMessage } = require("../src/utils/openStreetMap");

test("map bridge accepts coordinates and rejects invalid or unrelated messages", () => {
  assert.deepEqual(parseMapMessage(JSON.stringify({ type: "select", location: { latitude: "6.9", longitude: "79.8" } })), {
    type: "select", location: { latitude: 6.9, longitude: 79.8 }
  });
  for (const data of ["bad JSON", "null", '{}', '{"type":"navigate"}', '{"type":"select","location":{"latitude":91,"longitude":80}}']) {
    assert.equal(parseMapMessage(data), null);
  }
  assert.deepEqual(parseMapMessage('{"type":"ready"}'), { type: "ready" });
  assert.deepEqual(parseMapMessage('{"type":"error"}'), { type: "error" });
});

test("map page serializes only validated coordinates and keeps attribution visible", () => {
  const html = buildMapHtml({ latitude: '</script><script>alert(1)</script>', longitude: 80 });
  assert.doesNotMatch(html, /alert\(1\)/);
  assert.match(html, /OpenStreetMap<\/a> contributors/);
  assert.match(html, /position:'bottomleft'/);
});

function mountMap(location) {
  const messages = [];
  const mapEvents = {};
  const tileEvents = {};
  const markerEvents = {};
  const map = { setView() { return this; }, on(name, fn) { mapEvents[name] = fn; }, removeLayer() {}, invalidateSize() {} };
  const point = { lat: 6.9271, lng: 79.8612, wrap() { return this; } };
  const marker = { addTo() { return this; }, on(name, fn) { markerEvents[name] = fn; }, setLatLng() {}, getLatLng() { return point; } };
  let markerCount = 0;
  const window = { ReactNativeWebView: { postMessage(data) { messages.push(JSON.parse(data)); } }, addEventListener() {} };
  const context = vm.createContext({ window, L: {
    map() { return map; },
    control: { attribution() { return { addTo() {} }; } },
    tileLayer() { return { on(name, fn) { tileEvents[name] = fn; }, addTo() {} }; },
    divIcon() {},
    marker() { markerCount++; return marker; }
  } });
  for (const script of buildMapHtml(location).matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    vm.runInContext(script[1], context);
  }
  return { messages, mapEvents, tileEvents, markerEvents, point, window, markerCount: () => markerCount };
}

test("default map is unselected; tapping and dragging send the chosen coordinates", () => {
  const page = mountMap(null);
  assert.equal(page.markerCount(), 0);
  assert.deepEqual(page.messages, []);
  page.mapEvents.click({ latlng: page.point });
  assert.equal(page.markerCount(), 1);
  assert.deepEqual(page.messages[0], { type: "select", location: { latitude: 6.9271, longitude: 79.8612 } });
  page.markerEvents.dragend();
  assert.deepEqual(page.messages[1], page.messages[0]);
});

test("saved and GPS pins do not emit a second selection or claim unloaded tiles are ready", () => {
  const page = mountMap({ latitude: 6.9, longitude: 79.8 });
  assert.equal(page.markerCount(), 1);
  page.window.setSelectedLocation({ latitude: 7.1, longitude: 80.2 }, true);
  assert.deepEqual(page.messages, []);
  page.tileEvents.tileerror();
  assert.deepEqual(page.messages.pop(), { type: "error" });
  page.tileEvents.tileload();
  assert.deepEqual(page.messages.pop(), { type: "ready" });
});
