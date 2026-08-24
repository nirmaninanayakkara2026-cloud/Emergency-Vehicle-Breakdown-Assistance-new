export const troubleshootingGuides = [
  {
    id: "vehicle_not_starting_basic",
    vehicleTypes: ["car", "van", "three_wheeler", "truck"],
    breakdownType: "vehicle_not_starting",
    requestBreakdownType: "battery_issue",
    title: "Vehicle Not Starting Basic Checks",
    riskLevel: "low",
    serviceType: "battery_electrical_mechanic",
    symptoms: ["Vehicle does not start", "Starter clicks", "Dashboard lights may be weak"],
    warning: "Do not touch damaged wiring, leaking batteries, or hot engine parts.",
    requirements: ["Park safely", "Apply the parking brake", "Keep away from moving traffic", "Stop if you are unsure"],
    steps: [
      { id: 1, title: "Check dashboard lights", instruction: "Turn the key or press start once and observe whether dashboard lights turn on normally." },
      { id: 2, title: "Listen for clicking", instruction: "Listen for a repeated clicking sound when starting. This may suggest a weak battery." },
      { id: 3, title: "Turn off accessories", instruction: "Switch off lights, AC, radio, and chargers before trying once more." }
    ],
    stopConditions: ["Smoke", "Burning smell", "Battery leakage", "Visible damaged wiring"]
  },
  {
    id: "battery_weak",
    vehicleTypes: ["car", "van", "three_wheeler", "truck"],
    breakdownType: "battery_issue",
    title: "Possible Weak Battery",
    riskLevel: "low",
    serviceType: "battery_electrical_mechanic",
    symptoms: ["Dashboard lights appear weak", "Headlights are dim", "Vehicle does not start"],
    warning: "Do not touch damaged electrical wiring or a leaking battery.",
    requirements: ["Vehicle should be safely parked", "Parking brake should be applied"],
    steps: [
      { id: 1, title: "Check dashboard lights", instruction: "Turn the ignition to the normal starting position and check whether dashboard lights appear unusually weak." },
      { id: 2, title: "Check headlights", instruction: "Check whether the headlights appear significantly dimmer than normal." },
      { id: 3, title: "Check for warning signs", instruction: "Look from a safe distance for leakage, smoke, or damaged wires. Do not touch anything damaged." }
    ],
    stopConditions: ["Burning smell", "Battery leakage", "Visible damaged wiring", "Smoke"]
  },
  {
    id: "flat_tyre_visible",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "flat_tyre",
    title: "Flat or Low-Pressure Tyre",
    riskLevel: "caution",
    serviceType: "tire_mechanic",
    symptoms: ["Tyre appears deflated", "Vehicle pulls to one side", "Unusual tyre noise"],
    warning: "Tyre-related assistance can be dangerous near traffic or on unstable ground.",
    requirements: ["Stop away from moving traffic", "Park on level ground if possible", "Apply the parking brake", "Do not work under the vehicle"],
    steps: [
      { id: 1, title: "Check from a safe distance", instruction: "Walk around the vehicle only if it is safe and identify whether a tyre is visibly low or flat." },
      { id: 2, title: "Check ground condition", instruction: "Confirm the vehicle is not on soft, steep, or unstable ground before doing any further checks." },
      { id: 3, title: "Avoid driving further", instruction: "If the tyre is flat, avoid driving. Request help if you do not have safe tools or experience." }
    ],
    stopConditions: ["Vehicle is on a busy road", "Ground is unstable", "Wheel is damaged", "You are unsure"]
  },
  {
    id: "low_fuel",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "fuel_issue",
    title: "Possible Low Fuel",
    riskLevel: "low",
    serviceType: "roadside_fuel_support",
    symptoms: ["Engine stopped", "Fuel gauge is low", "Vehicle loses power"],
    warning: "If you smell fuel or see leakage, do not continue self-checks.",
    requirements: ["Park safely", "Switch on hazard lights if needed"],
    steps: [
      { id: 1, title: "Check fuel gauge", instruction: "Check whether the fuel level is empty or very low." },
      { id: 2, title: "Check for fuel smell", instruction: "From a safe position, check whether there is a strong fuel smell. Do not search near hot parts." }
    ],
    stopConditions: ["Fuel leakage", "Strong fuel smell", "Smoke", "Fire risk"]
  },
  {
    id: "engine_overheating_safe",
    vehicleTypes: ["car", "van", "three_wheeler", "truck"],
    breakdownType: "engine_overheating",
    title: "Engine Overheating Safe Checks",
    riskLevel: "caution",
    serviceType: "engine_mechanic",
    symptoms: ["Temperature warning light", "Steam from engine area", "Hot smell"],
    warning: "Hot engine parts and pressurized coolant can cause serious burns.",
    requirements: ["Stop in a safe place", "Switch off the engine", "Wait for the engine to cool", "Do not open the radiator cap"],
    steps: [
      { id: 1, title: "Switch off engine", instruction: "Turn off the engine and wait. Do not open the bonnet if steam is heavy or unsafe." },
      { id: 2, title: "Observe warning signs", instruction: "From a safe distance, look for steam, leaking fluid, or warning lights." },
      { id: 3, title: "Avoid restarting repeatedly", instruction: "Do not keep restarting an overheating engine. Request professional help if warning signs continue." }
    ],
    stopConditions: ["Heavy steam", "Coolant leak", "Burning smell", "Temperature warning remains"]
  },
  {
    id: "brake_problem_high",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "brake_problem",
    title: "Brake Problem",
    riskLevel: "high",
    serviceType: "brake_mechanic",
    symptoms: ["Brake pedal feels unusual", "Grinding noise", "Vehicle does not stop normally"],
    warning: "Brake system problems can make the vehicle unsafe to drive.",
    dangerReason: "Incorrect brake repair can cause loss of braking and serious injury.",
    immediateActions: ["Stop in a safe place", "Do not continue driving", "Request professional assistance"],
    avoidActions: ["Do not dismantle brake parts", "Do not drive at speed", "Do not ignore brake warning lights"],
    steps: [],
    stopConditions: ["Brake warning light", "Brake fluid leak", "Grinding noise", "Reduced stopping power"]
  },
  {
    id: "electrical_problem_high",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "electrical_problem",
    requestBreakdownType: "battery_issue",
    title: "Electrical Problem",
    riskLevel: "high",
    serviceType: "battery_electrical_mechanic",
    symptoms: ["Burning smell", "Electrical sparks", "Repeated fuse failure"],
    warning: "Electrical faults can cause fire, shock, or vehicle damage.",
    dangerReason: "Electrical repairs may involve hidden short circuits or high current components.",
    immediateActions: ["Switch off the vehicle if safe", "Move away from smoke or sparks", "Request a mechanic"],
    avoidActions: ["Do not touch damaged wiring", "Do not bypass fuses", "Do not pour water on electrical parts"],
    steps: [],
    stopConditions: ["Smoke", "Sparks", "Burning smell", "Damaged wiring"]
  },
  {
    id: "towing_required",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "towing_needed",
    title: "Towing Required",
    riskLevel: "high",
    serviceType: "towing_service",
    symptoms: ["Vehicle cannot move safely", "Wheel or steering damage", "Severe breakdown"],
    warning: "Moving an unsafe vehicle can cause further damage or accidents.",
    dangerReason: "A vehicle that cannot move safely should be handled by towing professionals.",
    immediateActions: ["Stay in a safe location", "Use hazard lights if safe", "Request towing support"],
    avoidActions: ["Do not push in traffic", "Do not tow with unsafe equipment", "Do not drive with steering damage"],
    steps: [],
    stopConditions: ["Steering failure", "Wheel damage", "Accident damage", "Vehicle stuck in traffic"]
  },
  {
    id: "accident_damage",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "accident",
    title: "Accident or Collision Damage",
    riskLevel: "high",
    serviceType: "towing_service",
    symptoms: ["Collision damage", "Airbag deployed", "Vehicle unsafe to drive"],
    warning: "Accident damage may hide fuel, electrical, steering, or brake hazards.",
    dangerReason: "Attempting repairs after an accident can expose you to serious safety risks.",
    immediateActions: ["Move to a safe place if possible", "Check for injuries", "Request professional help"],
    avoidActions: ["Do not drive a badly damaged vehicle", "Do not touch leaking fluids", "Do not stand in traffic"],
    steps: [],
    stopConditions: ["Injury", "Fuel leakage", "Smoke", "Severe vehicle damage"]
  },
  {
    id: "unknown_general",
    vehicleTypes: ["car", "bike", "van", "three_wheeler", "truck"],
    breakdownType: "other",
    title: "Unknown or General Problem",
    riskLevel: "high",
    serviceType: "general_mechanic",
    symptoms: ["Problem is unclear", "Unusual noise", "Warning light"],
    warning: "If the problem is unclear, unsafe repair steps should not be attempted.",
    dangerReason: "Unknown faults can involve brakes, steering, fuel, electrical, or engine systems.",
    immediateActions: ["Park safely", "Note warning lights or sounds", "Request professional assistance"],
    avoidActions: ["Do not guess repairs", "Do not keep driving if the vehicle feels unsafe", "Do not ignore smoke or leaks"],
    steps: [],
    stopConditions: ["Smoke", "Fuel smell", "Brake issue", "Steering issue", "Electrical smell"]
  }
];
