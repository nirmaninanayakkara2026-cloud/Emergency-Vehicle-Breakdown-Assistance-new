import { colors } from "../theme";

export const COLORS = { ...colors, accent: colors.amber };

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
  { label: "Vehicle Won't Start", value: "vehicle_not_starting" },
  { label: "Engine Problem", value: "engine_problem" },
  { label: "Engine Overheating", value: "engine_overheating" },
  { label: "Flat Tyre", value: "flat_tyre" },
  { label: "Brake Problem", value: "brake_problem" },
  { label: "Electrical Problem", value: "electrical_problem" },
  { label: "Fuel Problem", value: "fuel_problem" },
  { label: "Steering Problem", value: "steering_problem" },
  { label: "Transmission Problem", value: "transmission_problem" },
  { label: "Strange Noise", value: "strange_noise" },
  { label: "Other", value: "other" }
];

export const URGENCY_LEVELS = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" }
];

export const PROVIDER_SPECIALIZATIONS = [
  { label: "General mechanic", value: "general_mechanic" },
  { label: "Engine mechanic", value: "engine_mechanic" },
  { label: "Brake mechanic", value: "brake_mechanic" },
  { label: "Battery / electrical mechanic", value: "battery_electrical_mechanic" },
  { label: "Fuel-system mechanic", value: "fuel_system_mechanic" },
  { label: "Transmission mechanic", value: "transmission_mechanic" },
  { label: "Steering mechanic", value: "steering_mechanic" },
  { label: "Tyre mechanic", value: "tire_mechanic" },
  { label: "Towing", value: "towing" },
  { label: "Fuel support", value: "fuel_support" },
  { label: "Spare parts", value: "spare_parts" }
];

export const REQUEST_STATUS_OPTIONS = [
  { label: "On the way", value: "provider_en_route" },
  { label: "Arrived", value: "arrived" },
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
