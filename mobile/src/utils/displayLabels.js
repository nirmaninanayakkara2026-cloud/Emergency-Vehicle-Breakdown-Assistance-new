const titleCase = (value) => String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export const FAULT_LABELS = {
  electrical_system_fault: "Electrical / Starting System Problem",
  engine_system_fault: "Engine / Cooling System Problem",
  brake_system_fault: "Brake System Problem",
  wheel_tire_fault: "Wheel / Tyre Problem",
  steering_system_fault: "Steering System Problem",
  fuel_system_fault: "Fuel System Problem",
  drivetrain_fault: "Transmission / Drivetrain Problem"
};
export const REQUEST_STATUS_LABELS = {
  pending: "Request Created", recommended: "Providers Found", provider_requested: "Request Sent",
  accepted: "Provider Accepted", provider_en_route: "Provider On The Way", on_the_way: "Provider On The Way",
  arrived: "Provider Arrived", in_progress: "Repair In Progress", completed: "Completed",
  cancelled: "Cancelled", provider_rejected: "Provider Unavailable"
};
export const SERVICE_LABELS = {
  general_mechanic: "General Mechanic", engine_mechanic: "Engine Mechanic", brake_mechanic: "Brake Mechanic",
  battery_electrical_mechanic: "Battery / Electrical Mechanic", fuel_system_mechanic: "Fuel System Mechanic",
  transmission_mechanic: "Transmission Mechanic", steering_mechanic: "Steering Mechanic",
  tire_mechanic: "Tyre Mechanic", towing: "Towing Service", fuel_support: "Fuel Support", spare_parts: "Spare Parts"
};
export const RISK_LABELS = { low: "Basic Check", caution: "Continue With Care", high: "Professional Help Recommended" };
export function formatFaultLabel(value, fallback) { return FAULT_LABELS[value] || fallback || titleCase(value) || "Further inspection required"; }
export function formatRequestStatus(value) { return REQUEST_STATUS_LABELS[value] || titleCase(value) || "Status unavailable"; }
export function formatServiceType(value) { return SERVICE_LABELS[value] || titleCase(value) || "General Service"; }
export function formatRiskLevel(value) { return RISK_LABELS[value] || titleCase(value); }
export function formatDisplayValue(value, fallback = "Not available") { return value ? titleCase(value) : fallback; }
