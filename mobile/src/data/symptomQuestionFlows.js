import { BREAKDOWN_TYPES } from "../utils/constants";

export const SYMPTOM_BREAKDOWN_TYPES = BREAKDOWN_TYPES;

const notSure = { value: "not_sure", label: "Not Sure" };

export const symptomQuestionFlows = {
  vehicle_not_starting: [
    {
      id: "starting_behavior",
      question: "What happens when you try to start the vehicle?",
      summaryLabel: "When starting",
      type: "single_choice",
      options: [
        { value: "nothing", label: "Nothing happens" },
        { value: "clicking", label: "I hear a clicking sound" },
        { value: "engine_turns", label: "The engine tries to start" },
        { value: "starts_then_stops", label: "It starts and then stops" },
        notSure
      ]
    },
    {
      id: "light_condition",
      question: "How do the dashboard lights look?",
      summaryLabel: "Dashboard lights",
      type: "single_choice",
      options: [
        { value: "normal", label: "Normal" },
        { value: "dim", label: "Weak or dim" },
        { value: "no_lights", label: "No lights" },
        notSure
      ]
    },
    {
      id: "other_signs",
      question: "Did you notice anything else?",
      summaryLabel: "Other signs",
      type: "multi_choice",
      options: [
        { value: "smoke", label: "Smoke" },
        { value: "burning_smell", label: "Burning smell" },
        { value: "warning_light", label: "Warning light" },
        { value: "strange_sound", label: "Strange sound" },
        { value: "none", label: "None" },
        notSure
      ]
    }
  ],
  flat_tyre: [
    {
      id: "affected_tyre",
      question: "Which tyre seems affected?",
      summaryLabel: "Affected tyre",
      type: "single_choice",
      options: [
        { value: "front_left", label: "Front left" },
        { value: "front_right", label: "Front right" },
        { value: "rear_left", label: "Rear left" },
        { value: "rear_right", label: "Rear right" },
        notSure
      ]
    },
    {
      id: "tyre_condition",
      question: "What do you notice?",
      summaryLabel: "What you notice",
      type: "multi_choice",
      options: [
        { value: "completely_flat", label: "Completely flat" },
        { value: "low_pressure", label: "Low pressure" },
        { value: "visible_damage", label: "Visible damage" },
        { value: "pulling_side", label: "Vehicle pulling to one side" },
        notSure
      ]
    },
    {
      id: "tyre_observations",
      question: "Any other tyre observations? (optional)",
      summaryLabel: "Other tyre observations",
      type: "multi_choice",
      optional: true,
      options: [
        { value: "puncture_visible", label: "Puncture visible" },
        { value: "sidewall_damage", label: "Sidewall damage" },
        { value: "unusual_vibration", label: "Unusual vibration" },
        { value: "none", label: "None" },
        notSure
      ]
    }
  ],
  battery_issue: [
    {
      id: "starting_behavior",
      question: "What happens when you try to start?",
      summaryLabel: "When starting",
      type: "single_choice",
      options: [
        { value: "clicking", label: "Clicking sound" },
        { value: "nothing", label: "Nothing happens" },
        { value: "engine_slow", label: "Engine turns slowly" },
        notSure
      ]
    },
    {
      id: "light_condition",
      question: "What do you notice about the lights?",
      summaryLabel: "Lights",
      type: "single_choice",
      options: [
        { value: "normal", label: "Normal" },
        { value: "dim", label: "Dim" },
        { value: "no_lights", label: "No lights" },
        notSure
      ]
    },
    {
      id: "unusual_signs",
      question: "Any unusual signs?",
      summaryLabel: "Unusual signs",
      type: "multi_choice",
      options: [
        { value: "smoke", label: "Smoke" },
        { value: "burning_smell", label: "Burning smell" },
        { value: "battery_leakage", label: "Battery leakage" },
        { value: "none", label: "None" },
        notSure
      ]
    }
  ],
  engine_problem: [
    {
      id: "engine_signs",
      question: "What engine problem did you notice?",
      summaryLabel: "Engine signs",
      type: "multi_choice",
      options: [
        { value: "loss_of_power", label: "Loss of power" },
        { value: "engine_shaking", label: "Engine shaking" },
        { value: "engine_stalls", label: "Engine stalls" },
        { value: "knocking_sound", label: "Knocking sound" },
        { value: "warning_light", label: "Warning light" },
        { value: "hard_to_start", label: "Hard to start" },
        { value: "smoke", label: "Smoke" },
        notSure
      ]
    },
    {
      id: "engine_problem_timing",
      question: "When does the engine problem happen?",
      summaryLabel: "When it happens",
      type: "single_choice",
      options: [
        { value: "when_starting", label: "When starting" },
        { value: "while_idling", label: "While idling" },
        { value: "while_driving", label: "While driving" },
        { value: "during_acceleration", label: "During acceleration" },
        { value: "all_the_time", label: "All the time" },
        notSure
      ]
    }
  ],
  engine_overheating: [
    {
      id: "overheating_signs",
      question: "What did you notice?",
      summaryLabel: "Signs noticed",
      type: "multi_choice",
      options: [
        { value: "temperature_warning", label: "Temperature warning" },
        { value: "steam", label: "Steam" },
        { value: "smoke", label: "Smoke" },
        { value: "fluid_leak", label: "Liquid leaking under the vehicle" },
        { value: "extremely_hot", label: "Engine feels extremely hot" },
        notSure
      ]
    },
    {
      id: "problem_timing",
      question: "When did the problem happen?",
      summaryLabel: "When it happened",
      type: "single_choice",
      options: [
        { value: "while_driving", label: "While driving" },
        { value: "while_stopped", label: "While stopped" },
        { value: "after_starting", label: "Just after starting" },
        notSure
      ]
    }
  ],
  brake_problem: [
    {
      id: "brake_behavior",
      question: "What happens when you press the brake?",
      summaryLabel: "Brake behavior",
      type: "single_choice",
      options: [
        { value: "weak", label: "Brakes feel weak" },
        { value: "longer_stop", label: "Vehicle takes longer to stop" },
        { value: "pedal_unusual", label: "Brake pedal feels unusual" },
        { value: "strange_noise", label: "Strange brake noise" },
        { value: "not_working", label: "Brakes are not working properly" },
        notSure
      ]
    },
    {
      id: "brake_warning",
      question: "Did you notice a brake warning light or liquid leak?",
      summaryLabel: "Other brake signs",
      type: "single_choice",
      options: [
        { value: "warning_light", label: "Brake warning light" },
        { value: "fluid_leak", label: "Liquid leak" },
        { value: "neither", label: "Neither" },
        notSure
      ]
    }
  ],
  electrical_problem: [
    {
      id: "electrical_signs",
      question: "What did you notice?",
      summaryLabel: "Electrical signs",
      type: "multi_choice",
      options: [
        { value: "lights_not_working", label: "Lights not working" },
        { value: "warning_lights", label: "Warning lights" },
        { value: "system_off", label: "Electrical system switching off" },
        { value: "burning_smell", label: "Burning smell" },
        { value: "smoke", label: "Smoke" },
        notSure
      ]
    },
    {
      id: "electrical_timing",
      question: "When does it happen?",
      summaryLabel: "When it happens",
      type: "single_choice",
      options: [
        { value: "starting", label: "When starting" },
        { value: "driving", label: "While driving" },
        { value: "all_time", label: "All the time" },
        notSure
      ]
    }
  ],
  fuel_issue: [
    {
      id: "fuel_behavior",
      question: "What happened?",
      summaryLabel: "What happened",
      type: "single_choice",
      options: [
        { value: "gauge_empty", label: "Fuel gauge shows empty" },
        { value: "stopped_driving", label: "Vehicle stopped while driving" },
        { value: "starts_stops", label: "Vehicle starts and stops" },
        { value: "fuel_smell", label: "Fuel smell" },
        notSure
      ]
    },
    {
      id: "fuel_leak",
      question: "Do you see liquid leaking under the vehicle?",
      summaryLabel: "Visible leak",
      type: "single_choice",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        notSure
      ]
    }
  ],
  strange_sound: [
    {
      id: "sound_type",
      question: "What kind of sound do you hear?",
      summaryLabel: "Sound",
      type: "single_choice",
      options: [
        { value: "clicking", label: "Clicking" },
        { value: "grinding", label: "Grinding" },
        { value: "knocking", label: "Knocking" },
        { value: "squealing", label: "Squealing" },
        { value: "rattling", label: "Rattling" },
        notSure
      ]
    },
    {
      id: "sound_location",
      question: "Where does it seem to come from?",
      summaryLabel: "Sound location",
      type: "single_choice",
      options: [
        { value: "front", label: "Front" },
        { value: "rear", label: "Rear" },
        { value: "near_wheel", label: "Near a wheel" },
        { value: "under_vehicle", label: "Under vehicle" },
        { value: "engine_area", label: "Engine area" },
        notSure
      ]
    },
    {
      id: "sound_timing",
      question: "When does it happen?",
      summaryLabel: "Sound timing",
      type: "single_choice",
      options: [
        { value: "starting", label: "Starting" },
        { value: "driving", label: "Driving" },
        { value: "braking", label: "Braking" },
        { value: "turning", label: "Turning" },
        { value: "all_time", label: "All the time" },
        notSure
      ]
    }
  ],
  vehicle_shaking: [
    {
      id: "shaking_timing",
      question: "When does the shaking happen?",
      summaryLabel: "Shaking timing",
      type: "single_choice",
      options: [
        { value: "starting", label: "When starting" },
        { value: "driving", label: "While driving" },
        { value: "braking", label: "When braking" },
        { value: "high_speed", label: "At higher speed" },
        { value: "all_time", label: "All the time" },
        notSure
      ]
    },
    {
      id: "shaking_area",
      question: "Where do you feel it most?",
      summaryLabel: "Where shaking is felt",
      type: "single_choice",
      options: [
        { value: "steering", label: "Steering wheel" },
        { value: "seat", label: "Seat or vehicle body" },
        { value: "whole_vehicle", label: "Whole vehicle" },
        notSure
      ]
    }
  ],
  loss_of_power: [
    {
      id: "power_loss_timing",
      question: "When does the vehicle lose power?",
      summaryLabel: "Power loss timing",
      type: "single_choice",
      options: [
        { value: "accelerating", label: "When accelerating" },
        { value: "normal_driving", label: "While driving normally" },
        { value: "uphill", label: "Going uphill" },
        { value: "after_starting", label: "Immediately after starting" },
        notSure
      ]
    },
    {
      id: "power_warning",
      question: "Did a warning light appear?",
      summaryLabel: "Warning light",
      type: "single_choice",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        notSure
      ]
    }
  ],
  accident: [
    {
      id: "accident_condition",
      question: "Can the vehicle move safely?",
      summaryLabel: "Vehicle condition",
      type: "single_choice",
      options: [
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
        { value: "damaged", label: "It looks damaged" },
        notSure
      ]
    },
    {
      id: "accident_signs",
      question: "Did you notice any immediate danger?",
      summaryLabel: "Immediate signs",
      type: "multi_choice",
      options: [
        { value: "smoke", label: "Smoke" },
        { value: "fuel_smell", label: "Fuel smell" },
        { value: "fluid_leak", label: "Liquid leak" },
        { value: "none", label: "None" },
        notSure
      ]
    }
  ],
  towing_needed: [
    {
      id: "towing_reason",
      question: "Why does the vehicle need towing?",
      summaryLabel: "Towing reason",
      type: "single_choice",
      options: [
        { value: "will_not_start", label: "It will not start" },
        { value: "wheel_damage", label: "Wheel or tyre damage" },
        { value: "accident_damage", label: "Accident damage" },
        { value: "unsafe_to_drive", label: "It feels unsafe to drive" },
        notSure
      ]
    },
    {
      id: "vehicle_position",
      question: "Where is the vehicle now?",
      summaryLabel: "Vehicle position",
      type: "single_choice",
      options: [
        { value: "roadside", label: "Safe roadside area" },
        { value: "traffic", label: "In or near traffic" },
        { value: "parking", label: "Parking area" },
        { value: "off_road", label: "Off the road" },
        notSure
      ]
    }
  ],
  other: [
    {
      id: "general_behavior",
      question: "What best describes the problem?",
      summaryLabel: "Problem behavior",
      type: "single_choice",
      options: [
        { value: "will_not_move", label: "Vehicle will not move" },
        { value: "warning_light", label: "A warning light appeared" },
        { value: "unusual_feeling", label: "Vehicle feels unusual" },
        { value: "unclear", label: "The problem is unclear" },
        notSure
      ]
    },
    {
      id: "general_timing",
      question: "When did you first notice it?",
      summaryLabel: "When first noticed",
      type: "single_choice",
      options: [
        { value: "starting", label: "When starting" },
        { value: "driving", label: "While driving" },
        { value: "braking", label: "When braking" },
        { value: "stopped", label: "While stopped" },
        notSure
      ]
    }
  ]
};

export const OBSERVED_SYMPTOM_GROUPS = [
  {
    key: "see",
    label: "SEE",
    options: [
      { value: "smoke", label: "Smoke" },
      { value: "warning_light", label: "Warning light" },
      { value: "fluid_leak", label: "Fluid leak" }
    ]
  },
  {
    key: "hear",
    label: "HEAR",
    options: [
      { value: "clicking", label: "Clicking" },
      { value: "grinding", label: "Grinding" },
      { value: "knocking", label: "Knocking" },
      { value: "squealing", label: "Squealing" }
    ]
  },
  {
    key: "smell",
    label: "SMELL",
    options: [
      { value: "burning_smell", label: "Burning smell" },
      { value: "fuel_smell", label: "Fuel smell" },
      { value: "unusual_smell", label: "Unusual smell" }
    ]
  },
  {
    key: "feel",
    label: "FEEL",
    options: [
      { value: "vehicle_shaking", label: "Vehicle shaking" },
      { value: "steering_difficult", label: "Steering difficult" },
      { value: "weak_brakes", label: "Weak brakes" },
      { value: "loss_of_power", label: "Loss of power" }
    ]
  }
];
