const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const BreakdownRequest = require("../src/models/BreakdownRequest");
const aiDiagnosisService = require("../src/services/aiDiagnosisService");
const clarificationService = require("../src/services/clarificationService");
const structuredProblemRoutingService = require("../src/services/structuredProblemRoutingService");
const {
  createBreakdownRequest,
  requestClarification,
  submitClarificationAnswers,
} = require("../src/controllers/breakdownRequestController");

const driverId = new mongoose.Types.ObjectId();
const otherDriverId = new mongoose.Types.ObjectId();

const aiPrediction = {
  predictedFault: "steering_system_fault",
  faultLabel: "Steering System Problem",
  requiredService: "steering_mechanic",
  confidence: 0.95,
  confidenceLevel: "high",
  predictionMargin: 0.8,
  isAmbiguous: false,
  needsMoreInformation: false,
  topPredictions: [
    { fault: "steering_system_fault", probability: 0.95 },
    { fault: "wheel_tire_fault", probability: 0.05 },
  ],
  predictionSource: "ai_model",
};

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return payload;
    },
  };
}

async function invokeController(controller, req) {
  const res = createResponse();
  let forwardedError;
  await controller(req, res, (error) => {
    forwardedError = error;
  });
  return { res, error: forwardedError };
}

test("normalizes a valid FastAPI response and marks its source", async () => {
  const httpClient = {
    async post(url, body, options) {
      assert.match(url, /\/predict-fault$/);
      assert.equal(body.symptom_text, "hard steering");
      assert.ok(options.timeout > 0);
      return {
        data: {
          success: true,
          prediction: {
            predicted_fault: "steering_system_fault",
            fault_label: "Steering System Problem",
            required_service: "steering_mechanic",
            confidence: 0.95,
            confidence_level: "high",
            prediction_margin: 0.8,
            is_ambiguous: false,
            needs_more_information: false,
            top_predictions: [
              { fault: "steering_system_fault", probability: 0.95 },
              { fault: "wheel_tire_fault", probability: 0.05 },
            ],
          },
        },
      };
    },
  };

  const result = await aiDiagnosisService.diagnoseBreakdown("hard steering", {
    fallbackRequiredService: "general_mechanic",
    httpClient,
  });
  assert.equal(result.predictionSource, "ai_model");
  assert.equal(result.requiredService, "steering_mechanic");
});

test("uses rule fallback when FastAPI is offline", async () => {
  const result = await aiDiagnosisService.diagnoseBreakdown("strange noise", {
    fallbackRequiredService: "tire_mechanic",
    httpClient: {
      post: async () => {
        throw new Error("offline");
      },
    },
  });
  assert.equal(result.predictionSource, "rule_fallback");
  assert.equal(result.requiredService, "tire_mechanic");
});

test("uses rule fallback for an invalid FastAPI response", async () => {
  const result = await aiDiagnosisService.diagnoseBreakdown("strange noise", {
    fallbackRequiredService: "general_mechanic",
    httpClient: {
      post: async () => ({ data: { success: true, prediction: {} } }),
    },
  });
  assert.equal(result.predictionSource, "rule_fallback");
});

test("high-specificity main problems cannot be overridden by an unrelated AI result", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const expectedRoutes = {
    flat_tyre: ["wheel_tire_fault", "tire_mechanic", "Wheel / Tyre Problem"],
    brake_problem: [
      "brake_system_fault",
      "brake_mechanic",
      "Brake System Problem",
    ],
    steering_problem: [
      "steering_system_fault",
      "steering_mechanic",
      "Steering System Problem",
    ],
    transmission_problem: [
      "transmission_fault",
      "transmission_mechanic",
      "Transmission Problem",
    ],
    fuel_problem: [
      "fuel_system_fault",
      "fuel_system_mechanic",
      "Fuel System Problem",
    ],
    electrical_problem: [
      "electrical_system_fault",
      "battery_electrical_mechanic",
      "Electrical / Starting System Problem",
    ],
    engine_overheating: [
      "cooling_system_fault",
      "engine_mechanic",
      "Cooling / Overheating Problem",
    ],
  };
  let modelCalls = 0;
  aiDiagnosisService.diagnoseBreakdown = async () => {
    modelCalls += 1;
    return aiPrediction;
  };
  try {
    for (const [breakdownType, [fault, service, label]] of Object.entries(
      expectedRoutes,
    )) {
      const result =
        await structuredProblemRoutingService.diagnoseWithStructuredProblemPolicy(
          breakdownType,
          `Main problem: ${breakdownType}`,
        );
      assert.equal(result.predictedFault, fault);
      assert.equal(result.requiredService, service);
      assert.equal(result.faultLabel, label);
      assert.equal(result.predictionSource, "structured_problem");
      assert.equal(result.needsMoreInformation, false);
    }
    assert.equal(modelCalls, Object.keys(expectedRoutes).length);
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
  }
});

test("diagnostic categories remain AI-first", async () => {
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  let modelCalls = 0;
  aiDiagnosisService.diagnoseBreakdown = async () => {
    modelCalls += 1;
    return aiPrediction;
  };
  try {
    for (const breakdownType of structuredProblemRoutingService.AI_FIRST_PROBLEMS) {
      const result =
        await structuredProblemRoutingService.diagnoseWithStructuredProblemPolicy(
          breakdownType,
          "current symptoms",
        );
      assert.equal(result, aiPrediction);
      assert.equal(result.predictionSource, "ai_model");
    }
    assert.equal(
      modelCalls,
      structuredProblemRoutingService.AI_FIRST_PROBLEMS.length,
    );
  } finally {
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
  }
});

test("creates a request with the AI-required service", async () => {
  const originalCreate = BreakdownRequest.create;
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  let savedPayload;
  BreakdownRequest.create = async (payload) => {
    savedPayload = payload;
    return payload;
  };
  aiDiagnosisService.diagnoseBreakdown = async () => aiPrediction;

  try {
    const { res, error } = await invokeController(createBreakdownRequest, {
      user: { _id: driverId },
      body: {
        vehicleType: "car",
        breakdownType: "other",
        urgencyLevel: "medium",
        problemDescription: "steering is difficult",
        location: { latitude: 1, longitude: 2 },
      },
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(savedPayload.requiredServiceType, "steering_mechanic");
    assert.equal(savedPayload.aiPrediction.predictionSource, "ai_model");
  } finally {
    BreakdownRequest.create = originalCreate;
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
  }
});

test("self-assistant mechanic escalation carries its resolved service into provider matching", async () => {
  const originalCreate = BreakdownRequest.create;
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  let savedPayload;
  BreakdownRequest.create = async (payload) => {
    savedPayload = payload;
    return payload;
  };
  aiDiagnosisService.diagnoseBreakdown = async () => aiPrediction;

  try {
    const { res, error } = await invokeController(createBreakdownRequest, {
      user: { _id: driverId },
      body: {
        vehicleType: "car",
        breakdownType: "battery_issue",
        urgencyLevel: "medium",
        problemDescription: "Possible electrical issue",
        diagnosticInputText:
          "Guided symptoms\nAdditional clarification: dashboard lights become dim",
        predictedFault: "electrical_system_fault",
        requiredService: "battery_electrical_mechanic",
        location: { latitude: 1, longitude: 2 },
      },
    });
    assert.equal(error, undefined);
    assert.equal(res.statusCode, 201);
    assert.equal(
      savedPayload.requiredServiceType,
      "battery_electrical_mechanic",
    );
    assert.equal(
      savedPayload.diagnosticInputText,
      "Guided symptoms\nAdditional clarification: dashboard lights become dim",
    );
  } finally {
    BreakdownRequest.create = originalCreate;
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
  }
});

test("does not call clarification for a high-confidence prediction", async () => {
  const originalFindById = BreakdownRequest.findById;
  const originalGenerate = clarificationService.generateClarificationQuestions;
  let clarificationCalled = false;
  BreakdownRequest.findById = async () => ({ driverId, aiPrediction });
  clarificationService.generateClarificationQuestions = async () => {
    clarificationCalled = true;
    return { available: true, questions: [] };
  };

  try {
    const { res, error } = await invokeController(requestClarification, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: driverId },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.clarificationNeeded, false);
    assert.equal(clarificationCalled, false);
  } finally {
    BreakdownRequest.findById = originalFindById;
    clarificationService.generateClarificationQuestions = originalGenerate;
  }
});

test("never asks OpenAI clarification for a structured flat tyre selection", async () => {
  const originalFindById = BreakdownRequest.findById;
  const originalGenerate = clarificationService.generateClarificationQuestions;
  let clarificationCalled = false;
  BreakdownRequest.findById = async () => ({
    driverId,
    breakdownType: "flat_tyre",
    aiPrediction: { ...aiPrediction, needsMoreInformation: true },
  });
  clarificationService.generateClarificationQuestions = async () => {
    clarificationCalled = true;
    return { available: true, questions: [] };
  };
  try {
    const { res, error } = await invokeController(requestClarification, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: driverId },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.clarificationNeeded, false);
    assert.equal(clarificationCalled, false);
  } finally {
    BreakdownRequest.findById = originalFindById;
    clarificationService.generateClarificationQuestions = originalGenerate;
  }
});

test("requests questions for an ambiguous AI-first engine prediction", async () => {
  const originalFindById = BreakdownRequest.findById;
  const originalGenerate = clarificationService.generateClarificationQuestions;
  const request = {
    driverId,
    vehicleType: "car",
    breakdownType: "engine_problem",
    symptomCapture: {},
    diagnosticInputText: "temperature high and steam",
    clarificationAttempts: 0,
    aiPrediction: {
      ...aiPrediction,
      predictedFault: "engine_system_fault",
      confidence: 0.49,
      predictionMargin: 0.09,
      isAmbiguous: true,
      needsMoreInformation: true,
      topPredictions: [
        { fault: "engine_system_fault", probability: 0.49 },
        { fault: "cooling_system_fault", probability: 0.4 },
      ],
    },
    async save() {
      this.saved = true;
    },
  };
  BreakdownRequest.findById = async () => request;
  clarificationService.generateClarificationQuestions = async () => ({
    available: true,
    questions: [
      {
        id: "clarification_1",
        question: "What do you notice near the engine area?",
        options: ["Steam", "Fluid leaking", "Nothing visible", "Not sure"],
      },
      {
        id: "clarification_2",
        question: "When does the warning appear?",
        options: ["Immediately", "After driving", "Not sure"],
      },
      {
        id: "clarification_3",
        question: "Is another warning visible?",
        options: ["Yes", "No", "Not sure"],
      },
    ],
  });

  try {
    const { res, error } = await invokeController(requestClarification, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: driverId },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.clarificationNeeded, true);
    assert.equal(res.body.questions.length, 2);
    assert.equal(request.clarificationQuestions.length, 2);
    assert.equal(request.clarificationAttempts, 1);
    assert.equal(request.saved, true);
  } finally {
    BreakdownRequest.findById = originalFindById;
    clarificationService.generateClarificationQuestions = originalGenerate;
  }
});

test("OpenAI unavailable leaves clarification optional", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    const result = await clarificationService.generateClarificationQuestions(
      {},
    );
    assert.deepEqual(result, { available: false, questions: [] });
  } finally {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test("structured clarification is bounded and removes direct contact data", async () => {
  let requestPayload;
  const client = {
    responses: {
      async create(payload) {
        requestPayload = payload;
        return {
          output_text: JSON.stringify({
            questions: [
              {
                id: "arbitrary",
                question: "What happens when you try to start the vehicle?",
                options: [
                  "Nothing happens",
                  "Clicking sound",
                  "Engine tries to start",
                ],
              },
            ],
          }),
        };
      },
    },
  };
  const result = await clarificationService.generateClarificationQuestions(
    {
      vehicleType: "car",
      mainBreakdownCategory: "battery_issue",
      collectedSymptomAnswers: { note: "email driver@example.com" },
      diagnosticInputText: "Call 0712345678 because dashboard lights are weak",
      topPredictions: aiPrediction.topPredictions,
      confidence: 0.3,
      predictionMargin: 0.05,
    },
    { client, model: "configured-test-model" },
  );
  assert.equal(result.available, true);
  assert.equal(result.questions.length, 1);
  assert.equal(result.questions[0].id, "clarification_1");
  assert.ok(result.questions[0].options.includes("Not sure"));
  assert.equal(requestPayload.store, false);
  assert.equal(requestPayload.text.format.strict, true);
  assert.doesNotMatch(requestPayload.input, /driver@example\.com|0712345678/);
});

test("submitting clarification appends answers and reruns AI 1", async () => {
  const originalFindById = BreakdownRequest.findById;
  const originalDiagnose = aiDiagnosisService.diagnoseBreakdown;
  const originalGenerate = clarificationService.generateClarificationQuestions;
  let secondClarificationCalled = false;
  const updatedPrediction = {
    ...aiPrediction,
    predictedFault: "electrical_system_fault",
    faultLabel: "Electrical / Starting System Problem",
    requiredService: "battery_electrical_mechanic",
    confidence: 0.44,
    confidenceLevel: "low",
    predictionMargin: 0.04,
    isAmbiguous: true,
    needsMoreInformation: true,
  };
  const request = {
    driverId,
    breakdownType: "battery_issue",
    diagnosticInputText: "Vehicle does not start. Dashboard lights dim.",
    clarificationAttempts: 1,
    clarificationQuestions: [
      {
        id: "clarification_1",
        question: "What happens when you try to start the vehicle?",
        options: ["Nothing happens", "Clicking sound", "Not sure"],
      },
    ],
    clarificationAnswers: [],
    aiPredictionHistory: [],
    aiPrediction: { ...aiPrediction, needsMoreInformation: true },
    async save() {
      this.saved = true;
    },
  };
  BreakdownRequest.findById = async () => request;
  aiDiagnosisService.diagnoseBreakdown = async (text) => {
    assert.match(text, /Clicking sound/);
    return updatedPrediction;
  };
  clarificationService.generateClarificationQuestions = async () => {
    secondClarificationCalled = true;
    return { available: true, questions: [] };
  };

  try {
    const { res, error } = await invokeController(submitClarificationAnswers, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: driverId },
      body: {
        answers: [{ questionId: "clarification_1", answer: "Clicking sound" }],
      },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.prediction.predictedFault, "electrical_system_fault");
    assert.match(
      res.body.diagnosticInputText,
      /Additional symptom clarification/,
    );
    assert.equal(request.requiredServiceType, "battery_electrical_mechanic");
    assert.equal(request.clarificationAnswers.length, 1);
    assert.equal(request.aiPredictionHistory.length, 2);
    assert.equal(
      request.aiPredictionHistory[0].predictedFault,
      aiPrediction.predictedFault,
    );
    assert.equal(
      request.aiPredictionHistory[1].predictedFault,
      updatedPrediction.predictedFault,
    );
    assert.equal(request.clarificationQuestions.length, 0);
    assert.equal(request.saved, true);

    const secondRound = await invokeController(requestClarification, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: driverId },
    });
    assert.equal(secondRound.error, undefined);
    assert.equal(secondRound.res.body.maximumAttemptsReached, true);
    assert.equal(secondClarificationCalled, false);
  } finally {
    BreakdownRequest.findById = originalFindById;
    aiDiagnosisService.diagnoseBreakdown = originalDiagnose;
    clarificationService.generateClarificationQuestions = originalGenerate;
  }
});

test("breakdown request schema allows only one clarification round", () => {
  assert.equal(
    BreakdownRequest.schema.path("clarificationAttempts").options.max,
    1,
  );
});

test("rejects clarification from a driver who does not own the request", async () => {
  const originalFindById = BreakdownRequest.findById;
  BreakdownRequest.findById = async () => ({ driverId, aiPrediction });
  try {
    const { res, error } = await invokeController(requestClarification, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: otherDriverId },
    });
    assert.equal(res.statusCode, 403);
    assert.match(error.message, /Only the driver/);
  } finally {
    BreakdownRequest.findById = originalFindById;
  }
});

test("does not call OpenAI after one clarification attempt", async () => {
  const originalFindById = BreakdownRequest.findById;
  const originalGenerate = clarificationService.generateClarificationQuestions;
  let clarificationCalled = false;
  BreakdownRequest.findById = async () => ({
    driverId,
    clarificationAttempts: 1,
    aiPrediction: { ...aiPrediction, needsMoreInformation: true },
  });
  clarificationService.generateClarificationQuestions = async () => {
    clarificationCalled = true;
    return { available: true, questions: [] };
  };
  try {
    const { res, error } = await invokeController(requestClarification, {
      params: { id: new mongoose.Types.ObjectId().toString() },
      user: { _id: driverId },
    });
    assert.equal(error, undefined);
    assert.equal(res.body.maximumAttemptsReached, true);
    assert.equal(clarificationCalled, false);
  } finally {
    BreakdownRequest.findById = originalFindById;
    clarificationService.generateClarificationQuestions = originalGenerate;
  }
});
