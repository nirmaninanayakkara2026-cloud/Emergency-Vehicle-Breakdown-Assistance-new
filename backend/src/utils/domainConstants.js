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
  "flat_tyre",
  "battery_issue",
  "engine_overheating",
  "brake_problem",
  "fuel_issue",
  "accident",
  "towing_needed",
  "other"
];

const URGENCY_LEVELS = ["low", "medium", "high"];

const REQUEST_STATUSES = [
  "pending",
  "recommended",
  "accepted",
  "on_the_way",
  "in_progress",
  "completed",
  "cancelled"
];

const PROVIDER_UPDATE_STATUSES = [
  "accepted",
  "on_the_way",
  "in_progress",
  "completed"
];

const AVAILABILITY_STATUSES = ["available", "busy", "offline"];

const SERVICE_TYPE_MAP = {
  flat_tyre: "tire_mechanic",
  battery_issue: "battery_electrical_mechanic",
  engine_overheating: "engine_mechanic",
  brake_problem: "brake_mechanic",
  fuel_issue: "roadside_fuel_support",
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
  REQUEST_STATUSES,
  URGENCY_LEVELS,
  VEHICLE_TYPES,
  SERVICE_TYPE_MAP,
  mapBreakdownToServiceType
};
