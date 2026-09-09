const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const navigatorSource = fs.readFileSync(
  path.join(__dirname, "../src/navigation/ProviderNavigator.js"),
  "utf8",
);

test("provider profile always provides a working accessible back button", () => {
  assert.match(navigatorSource, /headerLeft:/);
  assert.match(navigatorSource, /accessibilityLabel="Go back"/);
  assert.match(navigatorSource, /navigation\.canGoBack\(\)/);
  assert.match(navigatorSource, /navigation\.goBack\(\)/);
  assert.match(navigatorSource, /navigation\.replace\("Profile"\)/);
});
