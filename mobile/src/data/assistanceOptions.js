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

export function getAssistanceProblems(driverType) {
  return driverType === "technical" ? TECHNICAL_PROBLEMS : OBSERVABLE_PROBLEMS;
}

export function getAssistanceQuestions(problem) {
  const aliases = { wheel_tyre_symptom: "flat_tyre", fuel_problem: "fuel_issue", strange_noise: "strange_sound" };
  const questions = extraQuestions[problem] || symptomQuestionFlows[aliases[problem] || problem] || symptomQuestionFlows.other;
  return [...questions.slice(0, 2), safetyQuestion];
}
