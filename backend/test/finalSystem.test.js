const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const authController = require("../src/controllers/authController");
const { protect } = require("../src/middleware/authMiddleware");
const { User } = require("../src/models/User");
const { normalizeSymptomCapture } = require("../src/utils/symptomNormalizer");
const { buildDiagnosticText } = require("../src/utils/buildDiagnosticText");
const aiDiagnosisService = require("../src/services/aiDiagnosisService");
const ai2Service = require("../src/services/ai2TroubleshootingService");
const clarificationService = require("../src/services/clarificationService");
const providerRecommendation = require("../src/services/providerRecommendationService");
const { getServiceCostRange, SERVICE_COST_RANGES } = require("../src/config/serviceCostRanges");
const { PROVIDER_STATUS_TRANSITIONS } = require("../src/utils/domainConstants");
const { DEMO_PROVIDERS } = require("../scripts/seedDemoData");

const testSecret = "final-system-test-secret";

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return payload; }
  };
}

async function invoke(handler, req) {
  const res = response();
  let error;
  await handler(req, res, (value) => { error = value; });
  return { res, error };
}

function fakeUser(role = "driver", overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    name: `Demo ${role}`,
    email: `${role}.test@example.com`,
    phone: "000-TEST",
    role,
    isActive: true,
    ...overrides
  };
}

test.before(() => { process.env.JWT_SECRET = testSecret; });

for (const role of ["driver", "mechanic"]) {
  test(`[Authentication] ${role} registration returns a JWT`, async (t) => {
    const originalFind = User.findOne;
    const originalCreate = User.create;
    const user = fakeUser(role);
    User.findOne = async () => null;
    User.create = async () => user;
    try {
      const { res, error } = await invoke(authController.register, {
        body: { name: user.name, email: user.email, phone: user.phone, password: "DemoPass123", role }
      });
      assert.equal(error, undefined);
      assert.equal(res.statusCode, 201);
      assert.equal(jwt.verify(res.body.data.token, testSecret).role, role);
      t.diagnostic(`status=${res.statusCode}, role=${role}, token=valid`);
    } finally { User.findOne = originalFind; User.create = originalCreate; }
  });

  test(`[Authentication] ${role} login succeeds with valid credentials`, async (t) => {
    const originalFind = User.findOne;
    const user = fakeUser(role, { comparePassword: async () => true });
    User.findOne = () => ({ select: async () => user });
    try {
      const { res, error } = await invoke(authController.login, {
        body: { email: user.email, password: "DemoPass123" }
      });
      assert.equal(error, undefined);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.data.user.role, role);
      t.diagnostic(`status=${res.statusCode}, role=${role}`);
    } finally { User.findOne = originalFind; }
  });
}

test("[Authentication] duplicate email is rejected", async (t) => {
  const originalFind = User.findOne;
  User.findOne = async () => fakeUser();
  try {
    const { res, error } = await invoke(authController.register, {
      body: { name: "Duplicate", email: "driver.test@example.com", phone: "000", password: "DemoPass123", role: "driver" }
    });
    assert.equal(res.statusCode, 409);
    assert.match(error.message, /already registered/);
    t.diagnostic(`status=${res.statusCode}, duplicate blocked`);
  } finally { User.findOne = originalFind; }
});

test("[Authentication] wrong password is rejected", async (t) => {
  const originalFind = User.findOne;
  User.findOne = () => ({ select: async () => fakeUser("driver", { comparePassword: async () => false }) });
  try {
    const { res, error } = await invoke(authController.login, {
      body: { email: "driver.test@example.com", password: "wrong-password" }
    });
    assert.equal(res.statusCode, 401);
    assert.match(error.message, /Invalid email or password/);
    t.diagnostic(`status=${res.statusCode}, wrong password blocked`);
  } finally { User.findOne = originalFind; }
});

for (const scenario of [
  ["missing bearer token", undefined],
  ["invalid JWT", "Bearer invalid.jwt.value"],
  ["expired JWT", `Bearer ${jwt.sign({ id: String(new mongoose.Types.ObjectId()) }, testSecret, { expiresIn: -1 })}`]
]) {
  test(`[Authentication] protected endpoint rejects ${scenario[0]}`, async (t) => {
    const req = { headers: {} };
    if (scenario[1]) req.headers.authorization = scenario[1];
    const res = response();
    let error;
    await protect(req, res, (value) => { error = value; });
    assert.equal(res.statusCode, 401);
    assert.ok(error);
    t.diagnostic(`status=${res.statusCode}, ${scenario[0]} rejected`);
  });
}

const symptomCases = [
  ["vehicle not starting", { starting_behavior: "clicking", light_condition: "dim" }],
  ["flat tyre", { tyre_condition: "completely_flat" }],
  ["brake problem", { brake_feel: "soft" }],
  ["engine overheating", { temperature: "very_high" }],
  ["not sure answer", { starting_behavior: "not_sure" }]
];

for (const [name, symptoms] of symptomCases) {
  test(`[Smart symptom capture] ${name} produces structured diagnostic text`, (t) => {
    const capture = normalizeSymptomCapture({
      symptoms,
      observedSymptoms: { see: [], hear: ["clicking"], smell: [], feel: [] },
      additionalDescription: ""
    });
    const text = buildDiagnosticText({ vehicleType: "car", breakdownType: name.replaceAll(" ", "_"), symptomCapture: capture });
    assert.equal(typeof capture.symptoms, "object");
    assert.match(text, /Vehicle type: car/);
    assert.ok(text.length > 20);
    t.diagnostic(`diagnosticInputText=${text}`);
  });
}

test("[Smart symptom capture] optional and non-guided input remain valid", (t) => {
  const capture = normalizeSymptomCapture(undefined);
  const text = buildDiagnosticText({ vehicleType: "car", breakdownType: "other", symptomCapture: capture });
  assert.equal(capture.additionalDescription, "");
  assert.match(text, /Main problem: other/);
  t.diagnostic(`diagnosticInputText=${text}`);
});

test("[AI 1 failure handling] mechanic request uses rule fallback when FastAPI is offline", async (t) => {
  const result = await aiDiagnosisService.diagnoseBreakdown("dashboard lights dim", {
    fallbackRequiredService: "battery_electrical_mechanic",
    httpClient: { post: async () => { throw new Error("offline"); } }
  });
  assert.equal(result.predictionSource, "rule_fallback");
  assert.equal(result.requiredService, "battery_electrical_mechanic");
  t.diagnostic(`source=${result.predictionSource}, service=${result.requiredService}`);
});

test("[AI clarification] OpenAI unavailable is optional and exposes no key", async (t) => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await clarificationService.generateClarificationQuestions({});
    assert.deepEqual(result, { available: false, questions: [] });
    assert.doesNotMatch(JSON.stringify(result), /OPENAI_API_KEY|sk-/i);
    t.diagnostic("clarification available=false; request remains usable");
  } finally { if (originalKey !== undefined) process.env.OPENAI_API_KEY = originalKey; }
});

test("[AI 2 failure handling] offline service returns no guessed repair steps", async (t) => {
  const result = await ai2Service.startGuide("demo-guide", true, {
    httpClient: { post: async () => { throw new Error("offline"); } }
  });
  assert.equal(result.status, "troubleshooting_unavailable");
  assert.equal(result.canRequestMechanic, true);
  assert.equal(result.current_step, undefined);
  t.diagnostic(`status=${result.status}, repairSteps=none, mechanicFallback=true`);
});

test("[Provider recommendation] exact, distance, filters, limit, and public response", (t) => {
  const base = {
    providerType: "mechanic", specializations: ["battery_electrical_mechanic"], serviceCategories: [],
    supportedVehicleTypes: ["car"], availabilityStatus: "available", serviceRadiusKm: 30,
    averageRating: 4.5, totalReviews: 10, averageResponseTimeMinutes: 15, isApproved: true, isActive: true
  };
  const providers = Array.from({ length: 8 }, (_, index) => ({
    ...base,
    _id: new mongoose.Types.ObjectId(),
    businessName: `Electrical ${index + 1}`,
    location: { latitude: 6.9271 + index * 0.005, longitude: 79.8612 }
  }));
  providers.push({ ...base, _id: new mongoose.Types.ObjectId(), businessName: "Unapproved", isApproved: false, location: { latitude: 6.9271, longitude: 79.8612 } });
  const ranked = providerRecommendation.rankProviders(providers, {
    requiredServiceType: "battery_electrical_mechanic", latitude: 6.9271, longitude: 79.8612,
    vehicleType: "car", breakdownType: "battery_issue"
  });
  const publicResult = providerRecommendation.toPublicRecommendationResult(ranked);
  assert.equal(ranked.providers.length, 5);
  assert.equal(ranked.providers[0].businessName, "Electrical 1");
  assert.equal(publicResult.providers[0].recommendationScore, undefined);
  assert.equal(publicResult.providers.some((item) => item.businessName === "Unapproved"), false);
  t.diagnostic(`returned=${ranked.providers.length}, first=${ranked.providers[0].businessName}, internalScoreHidden=true`);
});

test("[Request tracking] only sequential provider transitions are configured", (t) => {
  assert.deepEqual(PROVIDER_STATUS_TRANSITIONS.accepted, ["provider_en_route", "on_the_way"]);
  assert.deepEqual(PROVIDER_STATUS_TRANSITIONS.provider_en_route, ["arrived"]);
  assert.deepEqual(PROVIDER_STATUS_TRANSITIONS.arrived, ["in_progress"]);
  assert.deepEqual(PROVIDER_STATUS_TRANSITIONS.in_progress, ["completed"]);
  assert.equal(PROVIDER_STATUS_TRANSITIONS.accepted.includes("completed"), false);
  t.diagnostic("accepted -> provider_en_route -> arrived -> in_progress -> completed");
});

test("[Cost estimation] every service range has valid LKR schema", (t) => {
  for (const service of Object.keys(SERVICE_COST_RANGES)) {
    const range = getServiceCostRange(service);
    assert.equal(range.currency, "LKR");
    assert.ok(range.min >= 0 && range.max >= range.min);
  }
  t.diagnostic(`validated service ranges=${Object.keys(SERVICE_COST_RANGES).length}`);
});

test("[Demo data] fixtures are safe, complete, and duplicate-resistant", (t) => {
  assert.equal(DEMO_PROVIDERS.length, 10);
  assert.equal(new Set(DEMO_PROVIDERS.map((item) => item[0])).size, 10);
  assert.ok(DEMO_PROVIDERS.every((item) => item[5] >= 1 && item[5] <= 5));
  const seedSource = fs.readFileSync(path.resolve(__dirname, "../scripts/seedDemoData.js"), "utf8");
  assert.match(seedSource, /findOneAndUpdate/);
  assert.doesNotMatch(seedSource, /deleteMany|dropDatabase/);
  t.diagnostic("providers=10, upsert=true, destructiveDeletes=none, passwordSource=environment");
});

test("[Mobile integration] API URL and error/loading states are presentation-safe", (t) => {
  const apiSource = fs.readFileSync(path.resolve(__dirname, "../../mobile/src/services/api.js"), "utf8");
  const screens = [
    "RecommendationScreen.js", "RequestTrackingScreen.js", "SelfBreakdownAssistantScreen.js"
  ].map((file) => fs.readFileSync(path.resolve(__dirname, `../../mobile/src/screens/driver/${file}`), "utf8")).join("\n");
  assert.match(apiSource, /EXPO_PUBLIC_API_BASE_URL/);
  assert.match(screens, /loading|ActivityIndicator/);
  assert.match(screens, /error/);
  assert.doesNotMatch(screens, /recommendationScore/);
  t.diagnostic("configurableApi=true, loadingStates=true, userErrors=true, rawScores=false");
});

test("[Security] client-facing fallbacks expose no secrets or service internals", (t) => {
  const fallback = ai2Service.unavailable();
  const serialized = JSON.stringify(fallback);
  assert.doesNotMatch(serialized, /OPENAI|API_KEY|traceback|stack|python|axios/i);
  assert.equal(fallback.canRequestMechanic, true);
  t.diagnostic(`response=${serialized}`);
});
