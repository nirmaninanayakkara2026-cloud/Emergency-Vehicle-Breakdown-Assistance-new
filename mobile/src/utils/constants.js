export const COLORS = {
  primary: "#2f6f73",
  primaryDark: "#234e52",
  accent: "#b7791f",
  background: "#ffffff",
  surface: "#ffffff",
  softSurface: "#f7fafc",
  text: "#1f2933",
  muted: "#667085",
  border: "#d9e2ec",
  danger: "#b42318",
  success: "#2f855a",
  warning: "#b7791f"
};

export const PROVIDER_ROLES = [
  "mechanic",
  "garage",
  "towing_service",
  "spare_parts_shop"
];

export const VEHICLE_TYPES = [
  { label: "Car", value: "car" },
  { label: "Bike", value: "bike" },
  { label: "Van", value: "van" },
  { label: "Three wheeler", value: "three_wheeler" },
  { label: "Truck", value: "truck" }
];

export const BREAKDOWN_TYPES = [
  { label: "Flat tyre", value: "flat_tyre" },
  { label: "Battery issue", value: "battery_issue" },
  { label: "Engine overheating", value: "engine_overheating" },
  { label: "Brake problem", value: "brake_problem" },
  { label: "Fuel issue", value: "fuel_issue" },
  { label: "Accident", value: "accident" },
  { label: "Towing needed", value: "towing_needed" },
  { label: "Other", value: "other" }
];

export const URGENCY_LEVELS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" }
];

export const PROVIDER_SPECIALIZATIONS = [
  { label: "Tire", value: "tire" },
  { label: "Battery", value: "battery" },
  { label: "Electrical", value: "electrical" },
  { label: "Engine", value: "engine" },
  { label: "Brake", value: "brake" },
  { label: "Towing", value: "towing" },
  { label: "Fuel support", value: "fuel_support" },
  { label: "General", value: "general" },
  { label: "Spare parts", value: "spare_parts" }
];

export const REQUEST_STATUS_OPTIONS = [
  { label: "Accepted", value: "accepted" },
  { label: "On the way", value: "on_the_way" },
  { label: "In progress", value: "in_progress" },
  { label: "Completed", value: "completed" }
];

export const MOCK_LOCATION = {
  latitude: 6.9271,
  longitude: 79.8612,
  address: "Colombo, Sri Lanka"
};

export const STORAGE_KEYS = {
  token: "authToken",
  user: "authUser"
};
