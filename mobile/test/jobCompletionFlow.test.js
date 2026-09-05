const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "../src");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("provider completion opens a required final-price form with confirmation", () => {
  const source = read("screens/provider/ProviderRequestDetailsScreen.js");
  assert.match(source, /Complete Service/); assert.match(source, /Final Service Price \*/); assert.match(source, /Completion Note \(optional\)/);
  assert.match(source, /Please enter the final service price/); assert.match(source, /Complete this service for LKR/); assert.match(source, /Alert\.alert/);
});

test("completed requests use the dedicated driver completion screen", () => {
  const navigator = read("navigation/DriverNavigator.js"); const tracking = read("screens/driver/RequestTrackingScreen.js"); const details = read("screens/driver/RequestDetailsScreen.js");
  assert.match(navigator, /JobCompletionScreen/); assert.match(tracking, /navigation\.replace\("JobCompletion"/); assert.match(details, /navigation\.replace\("JobCompletion"/);
});

test("completion screen shows final price, summary, review, and safe exit actions", () => {
  const source = read("screens/driver/JobCompletionScreen.js");
  for (const copy of ["Service Completed", "Final Service Price", "How was your service?", "Submit Review", "Rate Later", "Back to Home", "View Service History", "Your Rating", "Your Review"]) assert.match(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /formatFaultLabel/); assert.match(source, /formatServiceType/); assert.match(source, /submitRequestReview/);
});

test("history routes completed work to completion details and home excludes it from active activity", () => {
  const history = read("screens/driver/MyRequestsScreen.js"); const home = read("screens/driver/DriverHomeScreen.js");
  assert.match(history, /request\.status === "completed" \? "JobCompletion"/); assert.match(history, /request\.finalCost/); assert.match(history, /request\.review/);
  assert.match(home, /setRecentRequest\(current \|\| null\)/); assert.doesNotMatch(home, /current \|\| items\[0\]/);
});

test("status service sends final cost and completion note", () => {
  const source = read("services/requestService.js");
  assert.match(source, /finalCost, completionNote/); assert.match(source, /status, finalCost, completionNote/);
});
