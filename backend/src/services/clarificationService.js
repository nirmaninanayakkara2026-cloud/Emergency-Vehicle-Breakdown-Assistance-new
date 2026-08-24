const OpenAI = require("openai");

const MAX_QUESTIONS = 2;
const SYSTEM_INSTRUCTION = `You are a vehicle symptom clarification assistant.

Your job is NOT to diagnose or repair the vehicle.

Ask short, driver-friendly questions that help distinguish between the supplied possible fault categories.

Do not provide repair instructions.

Do not tell the user that a specific fault is definitely present.

Avoid technical automotive terminology.

Ask no more than two questions.

Each question must provide simple answer options.

Always include 'Not sure' as an option.

Only ask about symptoms the driver has already noticed from a safe position.

Do not ask the driver to open the hood, touch vehicle parts, start the vehicle, or move the vehicle.`;

const CLARIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["id", "question", "options"]
      }
    }
  },
  required: ["questions"]
};

function isClarificationConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY.trim() &&
      process.env.OPENAI_MODEL &&
      process.env.OPENAI_MODEL.trim()
  );
}

function sanitizeText(value, maximumLength = 2000) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted email]")
    .replace(/(?:\+?\d[\d\s().-]{6,}\d)/g, "[redacted phone]")
    .slice(0, maximumLength);
}

function buildSafeContext(context = {}) {
  const symptoms = sanitizeText(
    JSON.stringify(context.collectedSymptomAnswers || {}),
    1500
  );
  return {
    vehicleType: sanitizeText(context.vehicleType, 50),
    mainBreakdownCategory: sanitizeText(context.mainBreakdownCategory, 80),
    collectedSymptomAnswers: symptoms,
    diagnosticInputText: sanitizeText(context.diagnosticInputText, 2500),
    possibleFaults: (context.topPredictions || []).slice(0, 2).map((item) => ({
      fault: sanitizeText(item.fault, 80),
      probability: Number(item.probability)
    })),
    confidence: Number(context.confidence),
    predictionMargin: Number(context.predictionMargin)
  };
}

function normalizeQuestions(parsed) {
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Clarification response did not contain questions")
  }

  return parsed.questions.slice(0, MAX_QUESTIONS).map((item, index) => {
    const question = String(item.question || "").trim().slice(0, 180);
    const options = Array.isArray(item.options)
      ? [...new Set(item.options.map((option) => String(option).trim()).filter(Boolean))]
          .slice(0, 5)
          .map((option) => option.slice(0, 80))
      : [];
    if (!question || options.length < 2) {
      throw new Error("Clarification response contained an invalid question")
    }
    const notSureIndex = options.findIndex(
      (option) => option.toLowerCase() === "not sure"
    );
    if (notSureIndex === -1) {
      if (options.length === 5) options[4] = "Not sure";
      else options.push("Not sure");
    }
    return {
      id: `clarification_${index + 1}`,
      question,
      options
    };
  });
}

async function generateClarificationQuestions(
  context,
  { client, model } = {}
) {
  const selectedModel = model || process.env.OPENAI_MODEL;
  if ((!client && !isClarificationConfigured()) || !selectedModel) {
    return { available: false, questions: [] };
  }

  try {
    const openai = client || new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 10000,
      maxRetries: 1
    });
    const response = await openai.responses.create({
      model: selectedModel,
      instructions: SYSTEM_INSTRUCTION,
      input: JSON.stringify(buildSafeContext(context)),
      text: {
        format: {
          type: "json_schema",
          name: "vehicle_clarification_questions",
          strict: true,
          schema: CLARIFICATION_SCHEMA
        }
      },
      max_output_tokens: 500,
      store: false
    });
    const questions = normalizeQuestions(JSON.parse(response.output_text));
    return { available: true, questions };
  } catch (_error) {
    return { available: false, questions: [] };
  }
}

module.exports = {
  CLARIFICATION_SCHEMA,
  MAX_QUESTIONS,
  SYSTEM_INSTRUCTION,
  buildSafeContext,
  generateClarificationQuestions,
  isClarificationConfigured,
  normalizeQuestions,
  sanitizeText
};
