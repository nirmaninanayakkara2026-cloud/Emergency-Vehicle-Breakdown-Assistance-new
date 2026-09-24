import { symptomQuestionFlows } from "./symptomQuestionFlows";

export const DRIVER_OPTIONS = [
  { value: "technical", label: "I know basic vehicle problems" },
  { value: "non_technical", label: "I need help identifying the problem" }
];

export const TECHNICAL_PROBLEMS = [
  { value: "engine_problem", label: "Engine Problem" },
  { value: "electrical_problem", label: "Electrical / Starting Problem" },
  { value: "cooling_problem", label: "Cooling Problem" },
  { value: "fuel_problem", label: "Fuel Problem" },
  { value: "transmission_problem", label: "Transmission Problem" },
  { value: "brake_problem", label: "Brake Problem" },
  { value: "steering_problem", label: "Steering Problem" },
  { value: "flat_tyre", label: "Tyre / Wheel Problem" },
  { value: "visibility_problem", label: "Windscreen Washer Problem" },
  { value: "cabin_filter_problem", label: "Cabin Air Filter Problem" },
  { value: "other", label: "Other / Not sure" }
];

export const OBSERVABLE_PROBLEMS = [
  { value: "vehicle_not_starting", label: "Vehicle will not start" },
  { value: "vehicle_stopped", label: "Vehicle suddenly stopped" },
  { value: "loss_of_power", label: "Loss of power" },
  { value: "warning_light", label: "Warning light appeared" },
  { value: "smoke_steam", label: "Smoke or steam" },
  { value: "strange_noise", label: "Strange noise" },
  { value: "vehicle_shaking", label: "Vehicle shaking / vibrating" },
  { value: "liquid_leaking", label: "Liquid leaking" },
  { value: "strange_smell", label: "Strange smell" },
  { value: "wheel_tyre_symptom", label: "Tyre / wheel problem" },
  { value: "feels_hot", label: "Vehicle feels too hot" },
  { value: "other", label: "Other / Not sure" }
];

const unsure = { value: "not_sure", label: "Not sure" };
function question(id, text, options) {
  return { id, question: text, summaryLabel: text, type: "single_choice",
    options: [...options.map(([value, label]) => ({ value, label })), unsure] };
}

const warningQuestion = question("warning_detail", "Which warning did you notice?", [
  ["temperature_red", "Temperature meter in the red"],
  ["oil_pressure_warning", "Oil-can symbol"],
  ["battery_warning", "Battery symbol"],
  ["tire_pressure_warning", "Tyre pressure symbol"],
  ["check_engine_steady", "Steady engine-shaped light"],
  ["flashing_check_engine", "Flashing engine-shaped light"],
  ["none", "No warning light"]
]);
const timingQuestion = question("notice_timing", "When did you notice it?", [
  ["starting", "When starting"], ["driving", "While driving"], ["stopped", "While stopped"]
]);
const safetyQuestion = {
  id: "danger_signs", question: "Have you already noticed any of these danger signs?",
  summaryLabel: "Danger signs", type: "multi_choice",
  options: [
    { value: "smoke", label: "Smoke or fire" },
    { value: "fuel_smell", label: "Fuel smell or fuel leaking" },
    { value: "burning_smell", label: "Burning smell or sparks" },
    { value: "battery_swollen", label: "Battery looks swollen or is leaking" },
    { value: "unsafe_location", label: "Vehicle is in an unsafe road position" },
    { value: "none", label: "None of these" }, unsure
  ]
};

const startingQuestions = symptomQuestionFlows.vehicle_not_starting.slice(0, 2).map((item) => ({
  ...item,
  options: item.options.map((option) => option.value === "engine_turns"
    ? { ...option, label: "Engine turns but does not start" } : option)
}));

const bikeStartingQuestions = [
  question("starting_behavior", "What happens when you press the starter or use the kick starter?", [
    ["nothing", "Nothing happens"], ["clicking", "I hear a clicking sound"],
    ["engine_turns", "The engine turns but does not start"],
    ["starts_then_stops", "It starts and then stops"]
  ]),
  question("bike_starting_control", "What do you notice before trying again?", [
    ["engine_stop_switch_off", "Engine stop switch is in the OFF position"],
    ["side_stand_in_gear", "Side stand is down and the bike is in gear"],
    ["neutral_not_confirmed", "Neutral light is not on"],
    ["lights_dim", "Lights are weak or dim"],
    ["fuel_tap_off", "Carburettor bike: fuel tap is set to OFF"],
    ["fuel_reserve_available", "Carburettor bike: fuel is low and RESERVE is available"],
    ["spark_plug_cap_loose", "Spark-plug cap looks loose or disconnected"],
    ["controls_look_normal", "These controls look normal"]
  ])
];

const bikeTechnicalEngineQuestions = [
  question("bike_engine_issue", "Which bike engine condition did you identify?", [
    ["spark_plug_fouled", "Spark plug is fouled or damaged"],
    ["engine_oil_low", "Engine-oil level is below MIN and there is no visible leak"],
    ["air_filter_dirty", "Owner-serviceable engine air filter is dirty"],
    ["other_engine_issue", "Another engine problem"]
  ]),
  question("bike_owner_service_status", "What does the bike handbook say?", [
    ["owner_service_confirmed", "It confirms this is owner-serviceable and I have the exact part or fluid"],
    ["parts_removal_required", "Access requires removing the tank, major panels or other parts"],
    ["not_confirmed", "I cannot confirm the procedure or specification"]
  ])
];

const bikeTechnicalDriveQuestions = [
  question("bike_drive_issue", "What did you identify in the bike drive system?", [
    ["chain_dry", "Drive chain only appears dry"],
    ["chain_loose_or_damaged", "Chain is loose, damaged, kinked or misaligned"],
    ["clutch_issue", "Clutch does not operate normally"],
    ["gear_issue", "Bike does not select or hold gears normally"]
  ]),
  question("bike_chain_service_status", "Can the chain be serviced exactly as the handbook describes?", [
    ["owner_service_confirmed", "Yes, at a safe work area with the specified chain lubricant"],
    ["unsafe_or_unsupported", "No, the bike is roadside, unstable or the procedure is unclear"]
  ])
];

const bikeTyreQuestions = [
  question("affected_tyre", "Which bike tyre seems affected?", [
    ["front", "Front tyre"], ["rear", "Rear tyre"], ["both", "Both tyres"]
  ]),
  question("tyre_condition", "What do you notice?", [
    ["completely_flat", "Completely flat"], ["low_pressure", "Low pressure"],
    ["visible_damage", "Visible damage"], ["bike_pulling_side", "Bike pulls or leans unexpectedly"]
  ])
];

const bikeSteeringQuestions = [
  question("steering_behavior", "What happens when you turn or hold the handlebars?", [
    ["hard_to_turn", "Handlebars are difficult to turn"],
    ["steering_not_working", "Handlebars will not turn normally"],
    ["handlebar_wobble", "Handlebars wobble or shake"],
    ["steering_noise", "There is a noise while turning"]
  ]),
  timingQuestion
];

const bikeBrakeQuestions = [
  question("brake_behavior", "What happens when you use the brake lever or pedal?", [
    ["weak", "Brakes feel weak"], ["longer_stop", "Bike takes longer to stop"],
    ["control_unusual", "Brake lever or pedal feels unusual"],
    ["strange_noise", "Strange brake noise"], ["not_working", "Brakes are not working properly"]
  ]),
  question("brake_warning", "Did you notice a brake warning light or liquid leak?", [
    ["warning_light", "Brake warning light"], ["fluid_leak", "Liquid leak"], ["neither", "Neither"]
  ])
];

const bikeNoiseQuestions = [
  question("sound_type", "What kind of sound do you hear?", [
    ["clicking", "Clicking"], ["grinding", "Grinding"], ["knocking", "Knocking"],
    ["squealing", "Squealing"], ["rattling", "Rattling or clunking"]
  ]),
  question("bike_sound_location", "Where does the sound seem to come from?", [
    ["engine_area", "Engine area"], ["chain_rear_wheel", "Chain or rear-wheel drive area"],
    ["front_wheel", "Front wheel"], ["rear_wheel", "Rear wheel"], ["exhaust", "Exhaust area"]
  ])
];

const bikeHotQuestions = [
  warningQuestion,
  question("bike_cooling_signs", "What else did you notice from a safe distance?", [
    ["liquid_cooled_low_coolant", "Liquid-cooled bike: coolant looked low after it cooled"],
    ["air_cooled", "Bike is air-cooled or has no coolant reservoir"],
    ["steam", "Steam"], ["smoke", "Smoke"], ["fluid_leak", "Liquid leaking"],
    ["none", "Nothing else"]
  ])
];

const extraQuestions = {
  electrical_problem: startingQuestions,
  vehicle_not_starting: startingQuestions,
  vehicle_stopped: [question("stopped_behavior", "What happened before it stopped?", [
    ["lost_power", "It gradually lost power"], ["sudden_stop", "It stopped without warning"],
    ["gauge_empty", "The fuel gauge showed empty"]
  ]), warningQuestion],
  warning_light: [warningQuestion, timingQuestion],
  smoke_steam: [question("visible_vapor", "What can you see from a safe distance?", [
    ["smoke", "Smoke"], ["steam", "White steam"], ["none", "It has stopped now"]
  ]), warningQuestion],
  liquid_leaking: [question("leak_location", "Where did you notice the liquid?", [
    ["front", "Under the front"], ["middle", "Under the middle"], ["wheel", "Near a wheel"]
  ]), question("leak_amount", "How much liquid did you notice?", [
    ["few_drops", "A few drops"], ["serious_fluid_leak", "A large puddle or continuous flow"]
  ])],
  strange_smell: [question("smell_detail", "What does it smell like?", [
    ["fuel_smell", "Petrol or diesel"], ["burning_smell", "Burning"], ["unusual_smell", "Another unusual smell"]
  ]), timingQuestion],
  feels_hot: [warningQuestion, question("hot_signs", "What else did you notice from a safe distance?", [
    ["steam", "Steam"], ["smoke", "Smoke"], ["fluid_leak", "Liquid leaking"],
    ["coolant_low", "Coolant looked low after the engine cooled"], ["none", "Nothing else"]
  ])],
  cooling_problem: [warningQuestion, question("cooling_signs", "What signs have you noticed?", [
    ["coolant_low", "Coolant level looks low"], ["steam", "Steam"], ["fluid_leak", "Liquid leaking"], ["none", "None"]
  ])],
  visibility_problem: [question("washer_behavior", "What happens when you use the windscreen washer?", [
    ["no_spray", "No washer fluid sprays"], ["weak_spray", "Only a weak spray"],
    ["works_normally", "It sprays normally"]
  ]), question("washer_level", "What can you see in the washer-fluid reservoir?", [
    ["low_fluid", "Fluid level looks low"], ["empty", "It looks empty"],
    ["sufficient", "Fluid level looks sufficient"]
  ])],
  cabin_filter_problem: [question("cabin_airflow", "What did you notice from the cabin air vents?", [
    ["weak_airflow", "Airflow is weak"], ["musty_smell", "There is a musty smell"],
    ["both", "Weak airflow and a musty smell"]
  ]), question("cabin_filter_observation", "What does the cabin filter or intake look like?", [
    ["dirty_filter", "Filter looks dirty or clogged"], ["debris_in_intake", "Debris is visible in the intake"],
    ["looks_clean", "It looks clean"]
  ])],
  transmission_problem: [question("gear_behavior", "What happens when changing gears?", [
    ["gear_slipping", "Gears slip"], ["hard_to_shift", "Difficult to change gear"],
    ["jerking", "Vehicle jerks"], ["will_not_move", "Vehicle will not move"]
  ]), timingQuestion],
  steering_problem: [question("steering_behavior", "What happens when you turn the steering wheel?", [
    ["hard_to_turn", "It is difficult to turn"], ["steering_not_working", "It will not turn"],
    ["steering_noise", "There is a noise"], ["steering_shaking", "It shakes"]
  ]), timingQuestion]
};

export function getAssistanceProblems(driverType, vehicleType) {
  if (driverType !== "technical") {
    if (vehicleType === "bike") {
      return OBSERVABLE_PROBLEMS.filter((item) => item.value !== "feels_hot");
    }
    return OBSERVABLE_PROBLEMS;
  }
  if (vehicleType === "bike") {
    const bikeLabels = {
      transmission_problem: "Transmission / Clutch / Chain",
      steering_problem: "Steering / Handling",
      flat_tyre: "Bike Tyre / Wheel Problem"
    };
    return TECHNICAL_PROBLEMS
      .filter((item) => !["cooling_problem", "visibility_problem", "cabin_filter_problem"].includes(item.value))
      .map((item) => ({ ...item, label: bikeLabels[item.value] || item.label }));
  }
  if (vehicleType === "three_wheeler") {
    return TECHNICAL_PROBLEMS.filter((item) => item.value !== "cabin_filter_problem");
  }
  return TECHNICAL_PROBLEMS;
}

export function getAssistanceQuestions(problem, vehicleType, driverType) {
  if (vehicleType === "bike") {
    if (["vehicle_not_starting", "electrical_problem"].includes(problem)) return [...bikeStartingQuestions, safetyQuestion];
    if (problem === "engine_problem" && driverType === "technical") return [...bikeTechnicalEngineQuestions, safetyQuestion];
    if (problem === "transmission_problem" && driverType === "technical") return [...bikeTechnicalDriveQuestions, safetyQuestion];
    if (["flat_tyre", "wheel_tyre_symptom"].includes(problem)) return [...bikeTyreQuestions, safetyQuestion];
    if (problem === "steering_problem") return [...bikeSteeringQuestions, safetyQuestion];
    if (problem === "brake_problem") return [...bikeBrakeQuestions, safetyQuestion];
    if (problem === "strange_noise") return [...bikeNoiseQuestions, safetyQuestion];
    if (["feels_hot", "cooling_problem"].includes(problem)) return [...bikeHotQuestions, safetyQuestion];
  }
  const aliases = { wheel_tyre_symptom: "flat_tyre", fuel_problem: "fuel_issue", strange_noise: "strange_sound" };
  const questions = extraQuestions[problem] || symptomQuestionFlows[aliases[problem] || problem] || symptomQuestionFlows.other;
  return [...questions.slice(0, 2), safetyQuestion];
}
