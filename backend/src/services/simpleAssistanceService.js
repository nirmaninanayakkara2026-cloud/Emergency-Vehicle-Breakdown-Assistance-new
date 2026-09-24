const Session = require("../models/TroubleshootingSession");
const ai1 = require("./aiDiagnosisService");
const ai2 = require("./ai2TroubleshootingService");
const aiHelp = require("./aiTroubleshootingHelpService");
const { detectDanger, dangerMessage } = require("./troubleshootingSafetyService");
const faultLabels = require("../../ai/config/fault_labels.json");
const faultServices = require("../../ai/config/fault_service_mapping.json");

const TECHNICAL_CATEGORIES = {
  engine_problem: "engine_system_fault", electrical_problem: "electrical_system_fault",
  cooling_problem: "cooling_system_fault", fuel_problem: "fuel_system_fault",
  transmission_problem: "transmission_fault", brake_problem: "brake_system_fault",
  steering_problem: "steering_system_fault", flat_tyre: "wheel_tire_fault",
  visibility_problem: "visibility_system_fault",
  cabin_filter_problem: "air_conditioning_fault"
};

const EXTRA_CATEGORY_LABELS = {
  visibility_system_fault: "Windscreen Washer Problem",
  air_conditioning_fault: "Cabin Air Filter Problem"
};

function response(session, extra = {}) {
  const publicSession = typeof session.toJSON === "function" ? session.toJSON() : { ...session };
  if (session.status === "awaiting_safety_confirmation") publicSession.guidanceSteps = [];
  return {
    success: true, status: session.status, session: publicSession,
    currentStep: session.currentStep, riskLevel: session.riskLevel,
    safetyWarning: session.safetyWarning, beforeYouBegin: session.beforeYouBegin,
    message: session.lastMessage, recommendedService: session.recommendedService,
    aiPrediction: {
      predictedFault: session.predictedFault.fault,
      faultLabel: session.predictedFault.label,
      requiredService: session.recommendedService,
      confidence: session.predictedFault.confidence,
      needsMoreInformation: session.predictedFault.needsMoreInformation
    }, ...extra
  };
}

function stop(session, reason) {
  session.status = "professional_help_required";
  session.escalationReason = reason;
  session.lastMessage = reason;
  session.currentStep = null;
  session.currentStepId = null;
  session.guidanceSteps = [];
  session.resumeStep = null;
  session.resolved = false;
  session.riskLevel ||= "HIGH";
  session.completedAt = new Date();
}

function enterStep(session, step) {
  if (!step || session.completedSteps.some((item) => item.stepId === step.step_id)) {
    stop(session, "No further safe steps are available. Professional assistance is recommended.");
    return;
  }
  session.status = "in_progress";
  session.currentStep = step;
  session.currentStepId = step.step_id;
  session.currentPhase = "instruction";
  session.lastMessage = "";
}

function batterySymptoms(text) {
  const observed = text.replace(/\b(?:no|not|without)\s+(?:any\s+)?(?:clicking|dim|weak)\b/gi, "");
  return /\b(clicking|cranks slowly|turns slowly)\b/i.test(observed) &&
    /\b(dim|weak|no lights|lights.{0,12}off)\b/i.test(observed);
}

function safeFirstCheck(details = {}) {
  const capture = details.symptomCapture || {};
  const symptoms = capture.symptoms || {};
  const symptomValues = Object.values(symptoms)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  const hasSymptom = (...values) => values.some((value) => symptomValues.includes(value));
  const description = [capture.additionalDescription, details.diagnosticInputText]
    .filter(Boolean).join(" ");
  const observations = Object.values(capture.observedSymptoms || {})
    .flatMap((value) => Array.isArray(value) ? value : [])
    .map((value) => String(value).toLowerCase());
  const hasOnlyGenericPowerObservation = observations.every((value) => value === "loss_of_power");
  const hasAdditionalDescription = Boolean(String(capture.additionalDescription || "").trim());

  const dangerSigns = Array.isArray(symptoms.danger_signs)
    ? symptoms.danger_signs
    : [symptoms.danger_signs].filter(Boolean);
  const onlyNoDangerSelection = dangerSigns.length === 0 || dangerSigns.every((value) => value === "none");
  const lowCoolantReported = symptoms.hot_signs === "coolant_low" ||
    symptoms.bike_cooling_signs === "liquid_cooled_low_coolant" ||
    /\bcoolant\b.{0,35}\b(?:low|below|min(?:imum)?)\b|\b(?:low|below|min(?:imum)?)\b.{0,35}\bcoolant\b/i
      .test(description);
  const otherSafetyText = String(details.safetyText || "")
    .replace(/\btemperature(?:\s+(?:meter|gauge))?.{0,35}\bred(?:\s+zone)?\b/gi, "")
    .replace(/\bengine\s+(?:is\s+)?overheating\b/gi, "");
  const hasOtherDanger = Boolean(detectDanger(otherSafetyText));

  if (["feels_hot", "cooling_problem"].includes(details.breakdownType) &&
      symptoms.warning_detail === "temperature_red" &&
      lowCoolantReported && onlyNoDangerSelection && !hasOtherDanger) {
    return {
      id: "guarded_coolant_check",
      category: "cooling_system_fault",
      problem: "Low Coolant / Coolant Reservoir",
      guideSearchText: "engine overheating low coolant coolant reservoir"
    };
  }

  if (["flat_tyre", "wheel_tyre_symptom"].includes(details.breakdownType) ||
      symptoms.warning_detail === "tire_pressure_warning") {
    const lowPressure = hasSymptom("low_pressure", "tire_pressure_warning");
    return {
      id: "vehicle_tyre_observation",
      category: "wheel_tire_fault",
      problem: lowPressure ? "Low Tyre Pressure / Tyre Problem" : "Tyre / Wheel Problem",
      guideSearchText: lowPressure
        ? "low tyre pressure no visible puncture"
        : "flat tyre wheel damage roadside"
    };
  }

  const warningRoutes = {
    battery_warning: ["electrical_system_fault", "Charging / Electrical Warning"],
    check_engine_steady: ["engine_system_fault", "Engine Warning"],
    flashing_check_engine: ["engine_system_fault", "Flashing Engine Warning"],
    oil_pressure_warning: ["engine_system_fault", "Engine Oil Pressure Warning"],
    temperature_red: ["cooling_system_fault", "Engine Overheating Warning"]
  };
  if (warningRoutes[symptoms.warning_detail]) {
    const [category, problem] = warningRoutes[symptoms.warning_detail];
    return { id: "identified_warning", category, problem,
      guideSearchText: `${problem} ${symptoms.warning_detail}` };
  }

  if (details.breakdownType === "vehicle_stopped" && symptoms.stopped_behavior === "gauge_empty") {
    return {
      id: "fuel_gauge_empty",
      category: "fuel_system_fault",
      problem: "Possible Empty Fuel Tank / Fuel Supply Problem",
      guideSearchText: "fuel gauge empty vehicle stopped"
    };
  }

  if (details.vehicleType === "bike") {
    if (symptoms.bike_starting_control === "fuel_tap_off") {
      return {
        id: "bike_fuel_tap_off",
        category: "fuel_system_fault",
        problem: "Bike Fuel Tap Is Off",
        guideSearchText: "carburettor motorcycle fuel tap off no start",
        guidanceSteps: [{
          step_id: "bike_fuel_tap_on",
          instruction: "Keep the bike stationary with the ignition off. Use the bike handbook to identify the normal fuel tap and move it from OFF to ON. Do not disconnect a fuel hose or continue if you smell or see fuel. Then try one normal start.",
          possible_results: []
        }]
      };
    }
    if (symptoms.bike_starting_control === "fuel_reserve_available") {
      return {
        id: "bike_fuel_reserve",
        category: "fuel_system_fault",
        problem: "Bike Fuel Level Is Low / Reserve Needed",
        guideSearchText: "carburettor motorcycle low fuel use reserve tap",
        guidanceSteps: [{
          step_id: "bike_select_fuel_reserve",
          instruction: "Keep the bike stationary with the ignition off. If the handbook confirms that this bike has a RESERVE fuel-tap position, select RESERVE using only the normal control and try one normal start. Stop if fuel is leaking or you smell fuel. Refuel safely as soon as possible and return the tap to its normal position as the handbook directs.",
          possible_results: []
        }]
      };
    }
    if (symptoms.bike_starting_control === "spark_plug_cap_loose") {
      return {
        id: "bike_loose_spark_plug_cap",
        category: "engine_system_fault",
        problem: "Possible Loose Bike Spark-Plug Cap",
        guideSearchText: "motorcycle spark plug cap loose disconnected engine turns but does not start",
        // The automotive knowledge base does not contain a suitable bike guide.
        // Route this observation to the controlled OpenAI action selector instead.
        skipLocalGuide: true
      };
    }
    if (details.driverType === "technical" &&
        symptoms.bike_owner_service_status === "owner_service_confirmed") {
      const technicalEngineChecks = {
        spark_plug_fouled: {
          id: "bike_spark_plug_replacement",
          problem: "Bike Spark Plug Needs Replacement",
          guideSearchText: "motorcycle owner serviceable fouled damaged spark plug replacement"
        },
        engine_oil_low: {
          id: "bike_low_engine_oil",
          problem: "Low Bike Engine-Oil Level",
          guideSearchText: "motorcycle low engine oil level no visible leak correct oil top up"
        },
        air_filter_dirty: {
          id: "bike_dirty_air_filter",
          problem: "Dirty Bike Engine Air Filter",
          guideSearchText: "motorcycle owner serviceable dirty engine air filter replacement"
        }
      };
      const check = technicalEngineChecks[symptoms.bike_engine_issue];
      if (check) {
        return {
          ...check,
          category: "engine_system_fault",
          skipLocalGuide: true
        };
      }
    }
    if (details.driverType === "technical" && symptoms.bike_drive_issue === "chain_dry" &&
        symptoms.bike_chain_service_status === "owner_service_confirmed") {
      return {
        id: "bike_dry_drive_chain",
        category: "drivetrain_fault",
        problem: "Dry Bike Drive Chain",
        guideSearchText: "motorcycle dry drive chain handbook specified lubricant",
        skipLocalGuide: true,
        skipProfessionalGate: true
      };
    }
    if (symptoms.bike_drive_issue === "chain_loose_or_damaged") {
      return {
        id: "bike_unsafe_drive_chain",
        category: "drivetrain_fault",
        problem: "Loose or Damaged Bike Drive Chain",
        guideSearchText: "motorcycle loose damaged kinked misaligned drive chain"
      };
    }
    if (symptoms.bike_starting_control === "engine_stop_switch_off") {
      return {
        id: "bike_engine_stop_switch",
        category: "electrical_system_fault",
        problem: "Bike Engine Stop Switch Is Off",
        guideSearchText: "motorcycle engine stop switch off no start",
        guidanceSteps: [{
          step_id: "bike_engine_stop_control",
          instruction: "Keep the bike stationary and select Neutral. Use the owner's handbook to identify the normal engine stop switch and set it to RUN. Do not bypass or alter the switch. Then try the starter once and stop if you notice heat, smoke, sparks or a burning smell.",
          possible_results: []
        }]
      };
    }
    if (["side_stand_in_gear", "neutral_not_confirmed"].includes(symptoms.bike_starting_control)) {
      return {
        id: "bike_starting_interlock",
        category: "electrical_system_fault",
        problem: "Bike Starting Safety Interlock",
        guideSearchText: "motorcycle neutral side stand clutch starting interlock",
        guidanceSteps: [{
          step_id: "bike_normal_starting_controls",
          instruction: "Keep the bike stable and follow its owner's handbook for a normal start: select Neutral, confirm the neutral indicator where fitted, raise the side stand where required, and use the clutch control as specified. Never bypass a side-stand, neutral or clutch safety switch. Try the starter once.",
          possible_results: []
        }]
      };
    }
    if (symptoms.bike_sound_location === "chain_rear_wheel" ||
        /\b(chain|final drive|rear sprocket)\b/i.test(description)) {
      return {
        id: "bike_chain_drive",
        category: "drivetrain_fault",
        problem: "Bike Chain / Final Drive Problem",
        guideSearchText: "motorcycle chain final drive rear sprocket noise"
      };
    }
    if (/\b(regulator[ -]?rectifier|rectifier|stator|charging system)\b/i.test(description)) {
      return {
        id: "bike_charging_system",
        category: "electrical_system_fault",
        problem: "Bike Charging System / Regulator-Rectifier Problem",
        guideSearchText: "motorcycle charging system regulator rectifier stator"
      };
    }
    if (/\b(spark plug|no spark|ignition spark)\b/i.test(description)) {
      return {
        id: "bike_ignition_system",
        category: "engine_system_fault",
        problem: "Bike Ignition / Spark Plug Problem",
        guideSearchText: "motorcycle ignition spark plug no spark"
      };
    }
    if (symptoms.bike_cooling_signs === "air_cooled") {
      return {
        id: "air_cooled_bike_heat",
        category: "engine_system_fault",
        problem: "Air-Cooled Bike Engine Heat Problem",
        guideSearchText: "air cooled motorcycle engine excessive heat"
      };
    }
  }

  if (details.driverType === "non_technical" && details.breakdownType === "loss_of_power" &&
      symptoms.power_warning === "no" && !hasAdditionalDescription && hasOnlyGenericPowerObservation) {
    return {
      category: "engine_system_fault",
      problem: "Air Filter",
      guideSearchText: "decreased engine performance air filter"
    };
  }
  return null;
}

function guardedCoolantCheckSteps() {
  return [
    {
      step_id: "coolant_level_check",
      instruction: "Keep the engine switched off until it is completely cold. Without opening any cap, use the vehicle handbook to locate the translucent coolant reservoir and look at its marked level from a safe position.",
      simple_question: "After the engine is completely cold, what level can you clearly see? Choose Not sure if the reservoir is not safely visible.",
      possible_results: [
        { value: "low_coolant_level", label: "Low coolant level", next_step: "coolant_leak_check", action: "continue" },
        { value: "empty_reservoir", label: "Reservoir looks empty", next_step: null, action: "stop" },
        { value: "sufficient_coolant_level", label: "Coolant level looks normal", next_step: null, action: "stop" }
      ]
    },
    {
      step_id: "coolant_leak_check",
      instruction: "With the engine completely cold, look from a safe distance around the coolant reservoir, visible hoses and the ground for a leak. Do not touch fluid or hot parts.",
      simple_question: "Can you clearly see a coolant leak? Choose Not sure if you cannot check safely.",
      possible_results: [
        { value: "visible_coolant_leak", label: "A leak is visible", next_step: null, action: "stop" },
        { value: "no_visible_leak", label: "No visible leaks", next_step: null, action: "request_mechanic" }
      ]
    }
  ];
}

function dangerRecommendation(danger, text = "") {
  const recommendations = {
    overheating: ["cooling_system_fault", "Engine Overheating Warning"],
    brake_failure: ["brake_system_fault", "Brake System Safety Warning"],
    steering_failure: ["steering_system_fault", "Steering System Safety Warning"],
    fuel_hazard: ["fuel_system_fault", "Fuel Leak or Fuel-Vapour Warning"],
    electrical_burning: ["electrical_system_fault", "Electrical Burning or Sparking Warning"],
    battery_damage: ["electrical_system_fault", "Damaged 12V Battery Warning"],
    high_voltage: ["electrical_system_fault", "High-Voltage System Warning"],
    smoke_or_fire: ["engine_system_fault", "Smoke or Fire Reported"]
  };
  if (danger?.id === "critical_indicator") {
    return /\boil(?:[- ]can| pressure)|oil_pressure/i.test(text)
      ? { category: "engine_system_fault", label: "Engine Oil Pressure Warning" }
      : { category: "engine_system_fault", label: "Flashing Engine Warning" };
  }
  const [category, label] = recommendations[danger?.id] || [null, "Unsafe Condition Reported"];
  return { category, label };
}

function buildModelInput(text) {
  // TF-IDF does not understand negation. Keep no-start/no-lights symptoms,
  // but remove explicit absent hazards from the model input, not the safety input.
  return String(text).replace(/\u2019/g, "'")
    .replace(/\btyre\b/gi, "tire").replace(/\btyres\b/gi, "tires")
    .replace(/\b(?:no|without)\s+(?:visible\s+|any\s+|strong\s+)?(?:smoke|fire|flames|steam|fuel smell|fuel leak|burning smell)\b/gi, "")
    .replace(/\b(?:i\s+)?(?:don't|do not|cannot|can't)\s+smell\s+(?:any\s+)?(?:fuel|petrol|diesel)\b/gi, "")
    .replace(/\b(?:the\s+)?engine\s+(?:is not|isn't)\s+overheating\b/gi, "")
    .replace(/\s+/g, " ").trim();
}

async function attachDangerSafetyActions(session, danger, symptoms) {
  const safetyHelp = await aiHelp.getDangerSafetyHelp({
    danger, driverType: session.driverType, vehicleType: session.vehicleType, symptoms
  });
  session.safetyActions = safetyHelp.actions;
  session.riskLevel = "HIGH";
  if (safetyHelp.source === "OPENAI") session.troubleshootingSource = "OPENAI";
}

async function start(details, driverId) {
  const { driverType, vehicleType, breakdownType, symptomCapture, diagnosticInputText } = details;
  const session = new Session({
    driverId, driverType, vehicleType, breakdownType, symptomCapture, diagnosticInputText,
    predictedFault: { label: "Problem not yet identified" }
  });
  const firstCheck = safeFirstCheck(details);
  const danger = detectDanger(details.safetyText);
  const guardedOverheat = firstCheck?.id === "guarded_coolant_check" && danger?.id === "overheating";
  if (danger && !guardedOverheat) {
    const recommendation = dangerRecommendation(danger, details.safetyText);
    session.predictedFault = {
      fault: recommendation.category,
      label: recommendation.label,
      confidence: null,
      confidenceLevel: "unavailable",
      needsMoreInformation: false
    };
    session.identifiedProblem = recommendation.label;
    await attachDangerSafetyActions(session, danger, details.safetyText);
    session.riskLevel = "HIGH";
    session.recommendedService = faultServices[recommendation.category] ||
      faultServices[TECHNICAL_CATEGORIES[breakdownType]] || "general_mechanic";
    stop(session, dangerMessage(danger));
    await session.save();
    return response(session);
  }

  // Observable symptoms always reach AI 1; a driver selection is not its diagnosis.
  const modelInput = buildModelInput(diagnosticInputText);
  let prediction = await ai1.diagnoseBreakdown(modelInput);
  let category = prediction.predictedFault;
  if (driverType === "technical" && Object.hasOwn(TECHNICAL_CATEGORIES, breakdownType)) {
    category = TECHNICAL_CATEGORIES[breakdownType];
    prediction = { ...prediction, confidence: null, confidenceLevel: "unavailable", needsMoreInformation: false };
  }
  const battery = batterySymptoms(modelInput) &&
    (driverType === "non_technical" || category === "electrical_system_fault");
  if (battery) {
    if (category !== "electrical_system_fault") {
      prediction.confidence = null;
      prediction.confidenceLevel = "unavailable";
    }
    category = "electrical_system_fault";
    prediction.needsMoreInformation = false;
  }
  if (firstCheck) {
    category = firstCheck.category;
    prediction = { ...prediction, confidence: null, confidenceLevel: "unavailable", needsMoreInformation: false };
  }
  session.predictedFault = {
    fault: category || null, label: faultLabels[category] || EXTRA_CATEGORY_LABELS[category] || "Problem not yet identified",
    confidence: prediction.confidence, confidenceLevel: prediction.confidenceLevel,
    needsMoreInformation: prediction.needsMoreInformation
  };
  session.recommendedService = faultServices[category] || "general_mechanic";
  session.identifiedProblem = firstCheck?.problem || (battery
    ? "Weak 12V Battery / Battery Connection Issue"
    : session.predictedFault.label);

  if (!category || prediction.needsMoreInformation) {
    // The existing clarification screen asks one bounded follow-up round.
    // Do not guess a component guide from uncertain category scores.
    return response(session, { status: "more_information_required", session: null,
      message: "We need a little more detail to identify a useful check." });
  }

  const guideSearchText = firstCheck?.guideSearchText || (battery
    ? "battery clicking dim lights"
    : modelInput);
  let guide;
  if (firstCheck?.guidanceSteps?.length) {
    guide = {
      guide_id: `vehicle_rule_${firstCheck.id}`,
      title: `${firstCheck.problem} Safety Guide`,
      risk_level: "LOW",
      professional_help_required: false,
      safety_warning: "Use only the bike's normal controls while it is stationary. Never bypass a safety switch.",
      before_you_begin: ["Keep the bike stable and clear of traffic.", "Stop if anything appears damaged or unsafe."],
      steps: firstCheck.guidanceSteps
    };
  } else if (!firstCheck?.skipLocalGuide) {
    const lookup = await ai2.findGuide(category, guideSearchText,
      "", { includeSteps: true });
    guide = lookup.guide_available ? lookup.guide : null;
  }
  if (guide && firstCheck?.id === "guarded_coolant_check") {
    guide = { ...guide, steps: guardedCoolantCheckSteps() };
  }
  if (guide) {
    session.guideId = guide.guide_id;
    session.guideTitle = guide.title;
    if (!battery && !firstCheck) {
      session.identifiedProblem = guide.title.replace(/\s*Safety Guide$/i, "");
    }
    session.riskLevel = guide.risk_level;
    session.safetyWarning = guide.safety_warning;
    session.beforeYouBegin = guide.before_you_begin;
    session.troubleshootingSource = "LOCAL_KB";
    if (guide.risk_level === "HIGH" || guide.professional_help_required) {
      await attachDangerSafetyActions(session, { id: "high_risk_guide", emergency: false },
        `${diagnosticInputText}\nAI 2 classified this guide as high risk: ${guide.title}`);
      stop(session, "This problem cannot be safely resolved using driver self-guidance.");
    } else if (guide.steps?.length && guide.steps.every((step) =>
      typeof step.instruction === "string" && step.instruction.trim() &&
      !/\bsource check\b|\bnamed area\b/i.test(step.instruction))) {
      session.guidanceSteps = guide.steps;
    }
  }
  if (session.status !== "professional_help_required" && !session.guidanceSteps.length) {
    if (!firstCheck?.skipProfessionalGate &&
        aiHelp.requiresProfessionalHelp(category, diagnosticInputText)) {
      await attachDangerSafetyActions(session, { id: "professional_category", emergency: false }, diagnosticInputText);
      stop(session, "This problem cannot be safely resolved using driver self-guidance.");
    }
  }
  if (session.status !== "professional_help_required" && !session.guidanceSteps.length) {
    const help = await aiHelp.getAiTroubleshootingHelp({
      mode: "fallback", problem: session.identifiedProblem, category,
      symptoms: diagnosticInputText, vehicleType, driverType
    });
    session.troubleshootingSource = help.available ? "OPENAI" : null;
    if (help.professionalHelp) stop(session, help.reason);
    else {
      session.troubleshootingSource = "OPENAI";
      session.riskLevel = help.risk === "LOW" ? "LOW" : "CAUTION";
      session.guidanceSteps = help.steps.map((instruction, index) => ({
        step_id: `ai_step_${index + 1}`, instruction, possible_results: []
      }));
      session.safetyWarning = "Continue only from a safe parked position. Stop if there is smoke, a fuel smell, heat, leaking liquid or anything unsafe.";
      session.beforeYouBegin = help.actionId
        ? ["Keep the bike secure and clear of traffic.", "Follow only the displayed handbook-based action.", "Stop if the part is inaccessible, damaged or unsafe."]
        : ["Stay clear of traffic.", "Switch off the engine and apply the parking brake.", "Do not touch, dismantle or repair vehicle parts."];
    }
  }
  if (session.guidanceSteps.length && session.status !== "professional_help_required") {
    session.startedAt = new Date();
    if (session.riskLevel === "CAUTION") session.status = "awaiting_safety_confirmation";
    else enterStep(session, session.guidanceSteps[0]);
  }
  await session.save();
  return response(session);
}

async function confirmSafety(session) {
  session.safetyConfirmed = true;
  enterStep(session, session.guidanceSteps[0]);
  session.startedAt ||= new Date();
  await session.save();
  return response(session);
}

function completeStep(session, selectedResult) {
  if (!session.currentStep) return;
  session.completedSteps.push({
    stepId: session.currentStepId, instruction: session.currentStep.instruction,
    instructionConfirmed: true, selectedResult, completedAt: new Date()
  });
}

async function continueWithGeneratedGuidance(session, observation) {
  if (session.troubleshootingSource !== "LOCAL_KB") {
    stop(session, "No further safe steps are available. Professional assistance is recommended.");
    return;
  }
  const help = await aiHelp.getAiTroubleshootingHelp({
    mode: "fallback", category: session.predictedFault.fault,
    problem: session.identifiedProblem, vehicleType: session.vehicleType,
    driverType: session.driverType,
    symptoms: [session.diagnosticInputText, observation].filter(Boolean).join("\n"),
    currentStep: session.currentStep?.instruction,
    steps: session.guidanceSteps.map((item) => item.instruction)
  });
  if (help.professionalHelp) {
    stop(session, help.reason || "No further safe driver-level steps are available. Professional assistance is recommended.");
    return;
  }
  session.troubleshootingSource = "OPENAI";
  session.riskLevel = help.risk === "LOW" ? "LOW" : "CAUTION";
  session.guidanceSteps = help.steps.map((instruction, index) => ({
    step_id: `ai_self_fix_${index + 1}`, instruction, possible_results: []
  }));
  session.currentStep = null;
  session.currentStepId = null;
  session.resumeStep = null;
  session.safetyWarning = "Continue only from a safe parked position. Stop if there is smoke, a fuel smell, heat, leaking liquid or anything unsafe.";
  session.beforeYouBegin = ["Stay clear of traffic.", "Switch off the engine and apply the parking brake.", "Do not continue if the action is not clearly supported by the vehicle handbook."];
  if (session.riskLevel === "CAUTION" && !session.safetyConfirmed) {
    session.status = "awaiting_safety_confirmation";
  } else {
    enterStep(session, session.guidanceSteps[0]);
  }
}

async function act(session, action, selectedResult) {
  const step = session.currentStep;
  session.lastMessage = "";
  if (action === "solved") {
    session.resolved = true;
    session.status = "resolved";
    session.currentStep = null;
    session.currentStepId = null;
    session.resumeStep = null;
    session.completedAt = new Date();
    session.lastMessage = "You confirmed that the problem is solved.";
  } else if (action === "not_sure") {
    session.lastMessage = step?.simple_question || "You do not need to guess. Ask for an explanation or request a mechanic if you cannot check safely.";
  } else if (session.status === "awaiting_resolution_confirmation") {
    const resumeStep = session.resumeStep;
    session.resumeStep = null;
    if (resumeStep) enterStep(session, resumeStep);
    else await continueWithGeneratedGuidance(session, "The original problem is still not fixed after the local check.");
  } else if (action === "observation") {
    const option = step?.possible_results?.find((item) => item.value === selectedResult);
    if (!option) throw new Error("Choose an observation from the current step.");
    completeStep(session, selectedResult);
    const next = session.guidanceSteps.find((item) => item.step_id === option.next_step);
    if (option.action === "stop") {
      stop(session, "The coolant observation is not suitable for a driver-level top-up. Keep the engine switched off and request a mechanic or recovery vehicle.");
    } else if (option.action === "request_mechanic") {
      await continueWithGeneratedGuidance(session,
        `Local check result: ${option.label || option.value}. The local guide has no approved driver fix for this result.`);
    } else if (["verify_resolution", "resolved"].includes(option.action)) {
      session.status = "awaiting_resolution_confirmation";
      session.resumeStep = next || null;
      session.currentStep = null;
      session.currentStepId = null;
      session.lastMessage = "Is the original problem now solved? A normal observation alone does not confirm a repair. Do not operate the vehicle just to test it.";
    } else enterStep(session, next);
  } else if (step?.possible_results?.length) {
    const outcomes = step.possible_results;
    const nextId = outcomes[0].next_step;
    if (nextId && outcomes.every((item) => item.action === "continue" && item.next_step === nextId)) {
      // Continue without another question only when every approved outcome agrees.
      completeStep(session, "still_not_fixed");
      enterStep(session, session.guidanceSteps.find((item) => item.step_id === nextId));
    } else if (outcomes.every((item) => !item.next_step)) {
      completeStep(session, "still_not_fixed");
      await continueWithGeneratedGuidance(session,
        "The problem is still not fixed and the local guide has no further driver action.");
    } else session.lastMessage = "Choose what you observed below so we can select the appropriate next step. You can also choose Not sure.";
  } else {
    const index = session.guidanceSteps.findIndex((item) => item.step_id === session.currentStepId);
    completeStep(session, "still_not_fixed");
    const next = session.guidanceSteps[index + 1];
    if (next) enterStep(session, next);
    else await continueWithGeneratedGuidance(session,
      "The problem is still not fixed after completing the local guide.");
  }
  await session.save();
  return response(session);
}

async function explain(session, question) {
  const danger = detectDanger(question);
  if (danger) {
    await attachDangerSafetyActions(session, danger, question);
    stop(session, dangerMessage(danger));
    await session.save();
    return response(session);
  }
  const help = await aiHelp.getAiTroubleshootingHelp({
    mode: "explain", category: session.predictedFault.fault, problem: session.identifiedProblem,
    vehicleType: session.vehicleType, driverType: session.driverType,
    symptoms: session.diagnosticInputText,
    currentStep: session.currentStep?.instruction, question,
    steps: session.guidanceSteps.map((step) => step.instruction)
  });
  if (help.available && help.professionalHelp) {
    stop(session, help.reason);
    await session.save();
    return response(session);
  }
  // Optional help never interprets an answer or marks a step complete.
  return response(session, { help: help.professionalHelp ? help.reason : help.explanation,
    helpAvailable: help.available });
}

async function explainProfessional(session, question) {
  const danger = detectDanger(question);
  if (danger) {
    await attachDangerSafetyActions(session, danger, question);
    stop(session, dangerMessage(danger));
    await session.save();
    return response(session, {
      help: dangerMessage(danger),
      observationSteps: [],
      helpAvailable: true
    });
  }
  const help = await aiHelp.getProfessionalAssistanceExplanation({
    problem: session.identifiedProblem || session.predictedFault?.label,
    vehicleType: session.vehicleType,
    symptoms: session.diagnosticInputText,
    reason: session.escalationReason || session.lastMessage,
    recommendedService: session.recommendedService,
    safetyActions: session.safetyActions,
    question
  });
  return response(session, {
    help: help.explanation,
    observationSteps: help.observationSteps || [],
    helpAvailable: help.available
  });
}

module.exports = {
  start, response, confirmSafety, act, explain, explainProfessional,
  buildModelInput, safeFirstCheck, stop
};
