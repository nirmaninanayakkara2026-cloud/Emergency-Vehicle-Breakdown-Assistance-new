const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const BreakdownRequest = require("../src/models/BreakdownRequest");
const { buildDiagnosticText } = require("../src/utils/buildDiagnosticText");
const { normalizeSymptomCapture } = require("../src/utils/symptomNormalizer");
const {
  validateBreakdownRequestInput,
} = require("../src/utils/requestValidation");
const { mapBreakdownToServiceType } = require("../src/utils/domainConstants");
const {
  createBreakdownRequest,
} = require("../src/controllers/breakdownRequestController");
const aiDiagnosisService = require("../src/services/aiDiagnosisService");

const baseRequest = {
  driverId: new mongoose.Types.ObjectId(),
  vehicleType: "car",
  breakdownType: "battery_issue",
  urgencyLevel: "medium",
  location: { latitude: 6.9271, longitude: 79.8612 },
  requiredServiceType: "battery_electrical_mechanic",
};

test("normalizes structured symptoms without diagnosing them", () => {
  const normalized = normalizeSymptomCapture({
    symptoms: {
      starting_behavior: " clicking ",
      light_condition: "dim",
      uncertain: "not_sure",
      ignored: null,
      other_signs: ["none", " none ", "", undefined],
    },
    observedSymptoms: {
      hear: ["clicking", " clicking ", null],
      smell: [],
    },
  });

  assert.deepEqual(normalized, {
    symptoms: {
      starting_behavior: "clicking",
      light_condition: "dim",
      uncertain: "not_sure",
      other_signs: ["none"],
    },
    observedSymptoms: { see: [], hear: ["clicking"], smell: [], feel: [] },
    additionalDescription: "",
  });
});

test("builds deterministic AI-ready input text", () => {
  const diagnosticInputText = buildDiagnosticText({
    vehicleType: "car",
    breakdownType: "vehicle_not_starting",
    symptomCapture: normalizeSymptomCapture({
      symptoms: { starting_behavior: "clicking", light_condition: "dim" },
      observedSymptoms: { hear: ["clicking"] },
    }),
  });

  assert.equal(
    diagnosticInputText,
    "Vehicle type: car. Main problem: vehicle not starting. Starting behavior: clicking. Dashboard lights: dim. Observed sound: clicking.",
  );
});

test("supports engine problem guided symptoms without changing the fault taxonomy", () => {
  const symptomCapture = normalizeSymptomCapture({
    symptoms: {
      engine_signs: [
        "loss_of_power",
        "engine_shaking",
        "knocking_sound",
        "smoke",
      ],
      engine_problem_timing: "during_acceleration",
    },
  });
  const request = { ...baseRequest, breakdownType: "engine_problem" };
  const diagnosticInputText = buildDiagnosticText({
    ...request,
    symptomCapture,
  });

  assert.deepEqual(validateBreakdownRequestInput(request), []);
  assert.equal(mapBreakdownToServiceType("engine_problem"), "engine_mechanic");
  assert.match(diagnosticInputText, /Main problem: engine problem\./);
  assert.match(
    diagnosticInputText,
    /Engine signs: loss of power, engine shaking, knocking sound, smoke\./,
  );
  assert.match(
    diagnosticInputText,
    /Engine problem timing: during acceleration\./,
  );
});

test("accepts requests without a description or guided symptoms", () => {
  assert.deepEqual(validateBreakdownRequestInput(baseRequest), []);

  const request = new BreakdownRequest(baseRequest);
  assert.equal(request.validateSync(), undefined);
  assert.equal(request.problemDescription, "");
  assert.equal(request.symptomCapture.guidedCaptureUsed, false);
});

test("stores normalized guided symptom fields in the request model", () => {
  const symptomCapture = {
    ...normalizeSymptomCapture({
      symptoms: { starting_behavior: "clicking" },
      observedSymptoms: { hear: ["clicking", "clicking"] },
      additionalDescription: " Lights faded ",
    }),
    guidedCaptureUsed: true,
  };
  const request = new BreakdownRequest({
    ...baseRequest,
    symptomCapture,
    diagnosticInputText: buildDiagnosticText({
      ...baseRequest,
      symptomCapture,
      problemDescription: "Would not start",
    }),
  });

  assert.equal(request.validateSync(), undefined);
  assert.equal(
    request.symptomCapture.symptoms.get("starting_behavior"),
    "clicking",
  );
  assert.deepEqual(request.symptomCapture.observedSymptoms.hear, ["clicking"]);
  assert.equal(request.symptomCapture.guidedCaptureUsed, true);
  assert.match(
    request.diagnosticInputText,
    /Driver description: Would not start\./,
  );
});

test("rejects missing or blank coordinates", () => {
  assert.ok(
    validateBreakdownRequestInput({
      ...baseRequest,
      location: { latitude: "", longitude: 1 },
    }).length,
  );
  assert.ok(
    validateBreakdownRequestInput({ ...baseRequest, location: { latitude: 1 } })
      .length,
  );
});

test("creation flow saves guided and non-guided requests with hybrid routing", async () => {
  const originalCreate = BreakdownRequest.create;
  const originalDiagnoseBreakdown = aiDiagnosisService.diagnoseBreakdown;
  const savedPayloads = [];
  BreakdownRequest.create = async (payload) => {
    savedPayloads.push(payload);
    return { _id: new mongoose.Types.ObjectId(), ...payload };
  };
  aiDiagnosisService.diagnoseBreakdown = async (
    _text,
    { fallbackRequiredService },
  ) => aiDiagnosisService.createRuleFallbackPrediction(fallbackRequiredService);

  const invoke = async (body) => {
    let responseBody;
    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        responseBody = payload;
        return payload;
      },
    };
    let forwardedError;
    await createBreakdownRequest(
      { body, user: { _id: baseRequest.driverId } },
      res,
      (error) => {
        forwardedError = error;
      },
    );
    assert.equal(forwardedError, undefined);
    assert.equal(res.statusCode, 201);
    return responseBody.data.request;
  };

  try {
    const withoutSymptoms = await invoke({
      vehicleType: "car",
      breakdownType: "flat_tyre",
      urgencyLevel: "low",
      location: { latitude: 1, longitude: 2 },
    });
    assert.equal(withoutSymptoms.symptomCapture.guidedCaptureUsed, false);
    assert.equal(withoutSymptoms.requiredServiceType, "tire_mechanic");
    assert.equal(
      withoutSymptoms.aiPrediction.predictionSource,
      "structured_problem",
    );
    assert.equal(
      withoutSymptoms.aiPrediction.predictedFault,
      "wheel_tire_fault",
    );

    const withSymptoms = await invoke({
      vehicleType: "car",
      breakdownType: "battery_issue",
      urgencyLevel: "high",
      problemDescription: "Won't start",
      location: { latitude: 1, longitude: 2 },
      symptomCapture: {
        symptoms: { starting_behavior: " clicking ", uncertainty: "not_sure" },
        observedSymptoms: { hear: ["clicking", "clicking"] },
      },
    });
    assert.equal(withSymptoms.symptomCapture.guidedCaptureUsed, true);
    assert.deepEqual(withSymptoms.symptomCapture.observedSymptoms.hear, [
      "clicking",
    ]);
    assert.match(
      withSymptoms.diagnosticInputText,
      /Starting behavior: clicking\./,
    );
    assert.equal(
      withSymptoms.requiredServiceType,
      "battery_electrical_mechanic",
    );
    assert.equal(savedPayloads.length, 2);
  } finally {
    BreakdownRequest.create = originalCreate;
    aiDiagnosisService.diagnoseBreakdown = originalDiagnoseBreakdown;
  }
});
