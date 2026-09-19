const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const babel = require("@babel/core");

const mobileRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(mobileRoot, "src");
const defaultLoader = require.extensions[".js"];
require.extensions[".js"] = function compileMobileSource(module, filename) {
  if (!filename.startsWith(sourceRoot)) return defaultLoader(module, filename);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = babel.transformSync(source, {
    filename,
    presets: [["babel-preset-expo", { disableImportExportTransform: false }]]
  });
  return module._compile(compiled.code, filename);
};

const {
  formatGeocodedAddress,
  isValidLocation,
  normalizeLocation,
  regionForLocation,
  SRI_LANKA_REGION
} = require("../src/utils/locationPicker");

test("validates provider coordinates within geographic bounds", () => {
  assert.equal(isValidLocation({ latitude: 6.9271, longitude: 79.8612 }), true);
  assert.equal(isValidLocation({ latitude: -90, longitude: 180 }), true);
  assert.equal(isValidLocation({ latitude: 91, longitude: 79 }), false);
  assert.equal(isValidLocation({ latitude: 7, longitude: -181 }), false);
  assert.equal(isValidLocation({ latitude: null, longitude: 79 }), false);
  assert.equal(normalizeLocation({ latitude: "6.9271", longitude: "79.8612" }).latitude, 6.9271);
});

test("uses Sri Lanka only as an unselected default map region", () => {
  assert.deepEqual(regionForLocation(null), SRI_LANKA_REGION);
  assert.equal(normalizeLocation(null), null);
  const existing = regionForLocation({ latitude: 7.291, longitude: 80.636 });
  assert.equal(existing.latitude, 7.291);
  assert.equal(existing.longitude, 80.636);
  assert.ok(existing.latitudeDelta < SRI_LANKA_REGION.latitudeDelta);
});

test("formats a readable reverse-geocoded address without duplicate parts", () => {
  assert.equal(formatGeocodedAddress({ formattedAddress: "Galle Road, Colombo 03" }), "Galle Road, Colombo 03");
  assert.equal(formatGeocodedAddress({
    name: "45",
    street: "Galle Road",
    district: "Colombo 03",
    city: "Colombo",
    region: "Western Province",
    country: "Sri Lanka"
  }), "45, Galle Road, Colombo 03, Colombo, Western Province, Sri Lanka");
  assert.equal(formatGeocodedAddress({ city: "Colombo", region: "Colombo" }), "Colombo");
});

test("location picker uses the real map, tap selection, draggable marker, and shared current-location action", () => {
  const picker = fs.readFileSync(path.join(sourceRoot, "components/location/LocationPicker.js"), "utf8");
  assert.match(picker, /from "\.\/MapView"/);
  assert.match(picker, /provider=\{Platform\.OS === "android" \? PROVIDER_GOOGLE : undefined\}/);
  assert.match(picker, /requestForegroundPermissionsAsync/);
  assert.match(picker, /withTimeout/);
  assert.doesNotMatch(picker, /requestBackgroundPermissionsAsync|startLocationUpdatesAsync/);
  assert.match(picker, /onPress=\{handleMapPress\}/);
  assert.match(picker, /draggable/);
  assert.match(picker, /onDragEnd=\{handleMarkerDragEnd\}/);
  assert.match(picker, /reverseGeocodeAsync/);
  assert.equal((picker.match(/onPress=\{handleUseCurrentLocation\}/g) || []).length, 2);
});

test("provider profile saves the selected pin through the existing location schema", () => {
  const screen = fs.readFileSync(path.join(sourceRoot, "screens/provider/ProviderProfileScreen.js"), "utf8");
  assert.match(screen, /const \[selectedLocation, setSelectedLocation\] = useState\(null\)/);
  assert.match(screen, /setSelectedLocation\(normalizeLocation\(profile\.location\)\)/);
  assert.match(screen, /latitude: selectedLocation\.latitude/);
  assert.match(screen, /longitude: selectedLocation\.longitude/);
  assert.match(screen, /address: address\.trim\(\)/);
  assert.match(screen, /Please select your service location on the map or use your current location\./);
  assert.doesNotMatch(screen, /label="Latitude"|label="Longitude"/);
});
