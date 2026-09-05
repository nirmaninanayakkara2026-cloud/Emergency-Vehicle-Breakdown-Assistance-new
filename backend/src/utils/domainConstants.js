const PROVIDER_ROLES = [
  "mechanic",
  "garage",
  "towing_service",
  "spare_parts_shop"
];

const PROVIDER_TYPES = [...PROVIDER_ROLES];

const VEHICLE_TYPES = [
  "car",
  "bike",
  "van",
  "three_wheeler",
  "truck"
];

const BREAKDOWN_TYPES = [
  "vehicle_not_starting",
  "flat_tyre",
  "battery_issue",
  "engine_problem",
  "engine_overheating",
  "brake_problem",
  "electrical_problem",
  "fuel_problem",
  "fuel_issue",
  "steering_problem",
  "transmission_problem",
  "strange_noise",
  "accident",
  "towing_needed",
  "other"
];

const URGENCY_LEVELS = ["low", "medium", "high"];

const REQUEST_STATUSES = [
  "pending",
  "recommended",
  "created",
  "awaiting_clarification",
  "provider_selection",
  "provider_requested",
  "accepted",
  "on_the_way",
  "provider_en_route",
  "arrived",
  "in_progress",
  "completed",
  "cancelled",
  "provider_rejected"
];

const PROVIDER_UPDATE_STATUSES = [
  "on_the_way",
  "provider_en_route",
  "arrived",
  "in_progress",
  "completed"
];

const PROVIDER_STATUS_TRANSITIONS = {
  accepted: ["provider_en_route", "on_the_way"],
  provider_en_route: ["arrived"],
  on_the_way: ["arrived", "in_progress"],
  arrived: ["in_progress"],
  in_progress: ["completed"]
};

const AVAILABILITY_STATUSES = ["available", "online", "busy", "offline"];

const SERVICE_TYPE_MAP = {
  vehicle_not_starting: "battery_electrical_mechanic",
  flat_tyre: "tire_mechanic",
  battery_issue: "battery_electrical_mechanic",
  engine_problem: "engine_mechanic",
  engine_overheating: "engine_mechanic",
  brake_problem: "brake_mechanic",
  electrical_problem: "battery_electrical_mechanic",
  fuel_problem: "fuel_system_mechanic",
  fuel_issue: "roadside_fuel_support",
  steering_problem: "steering_mechanic",
  transmission_problem: "transmission_mechanic",
  strange_noise: "general_mechanic",
  accident: "towing_service",
  towing_needed: "towing_service",
  other: "general_mechanic"
};

function mapBreakdownToServiceType(breakdownType) {
  return SERVICE_TYPE_MAP[breakdownType] || SERVICE_TYPE_MAP.other;
}

module.exports = {
  AVAILABILITY_STATUSES,
  BREAKDOWN_TYPES,
  PROVIDER_ROLES,
  PROVIDER_TYPES,
  PROVIDER_UPDATE_STATUSES,
  PROVIDER_STATUS_TRANSITIONS,
  REQUEST_STATUSES,
  URGENCY_LEVELS,
  VEHICLE_TYPES,
  SERVICE_TYPE_MAP,
  mapBreakdownToServiceType
};
