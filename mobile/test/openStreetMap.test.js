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
const { buildWebMapDocument } = require("../src/utils/webMapDocument");

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

function mountMap(location, options) {
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
  for (const script of buildMapHtml(location, options).matchAll(/<script>([\s\S]*?)<\/script>/g)) {
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

test("detail maps keep the saved pin fixed when the user clicks the map", () => {
  const page = mountMap({ latitude: 6.9, longitude: 79.8 }, { readOnly: true });
  assert.equal(page.markerCount(), 1);
  assert.equal(page.mapEvents.click, undefined);
  assert.deepEqual(page.messages, []);
});

test("browser map bridge forwards events and accepts only map commands from its parent", () => {
  const sent = [], updates = [], listeners = {};
  const parent = { postMessage: (data) => sent.push(data) };
  const window = {
    parent, addEventListener: (name, listener) => { listeners[name] = listener; },
    setSelectedLocation: (value, center) => updates.push({ value, center }),
    setRoadRoute: (value) => updates.push(value)
  };
  const html = buildWebMapDocument("<html><head></head><body></body></html>");
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], { window });
  window.ReactNativeWebView.postMessage('{"type":"ready"}');
  assert.equal(sent[0].channel, "roadcare-map");
  assert.equal(sent[0].data, '{"type":"ready"}');
  const command = { channel: "roadcare-map-command", method: "setSelectedLocation", value: { latitude: 6.9, longitude: 79.8 } };
  listeners.message({ source: {}, data: command });
  listeners.message({ source: parent, data: { ...command, channel: "unrelated" } });
  listeners.message({ source: parent, data: { ...command, method: "eval" } });
  assert.equal(updates.length, 0);
  listeners.message({ source: parent, data: command });
  assert.deepEqual(updates[0], { value: command.value, center: true });
  listeners.message({ source: parent, data: { ...command, method: "setRoadRoute", value: [command.value] } });
  assert.deepEqual(updates[1], [command.value]);
});
