const CURRENCY = "LKR";

const SERVICE_COST_RANGES = {
  general_mechanic: { min: 2500, max: 7500, currency: CURRENCY },
  battery_electrical_mechanic: { min: 3000, max: 7000, currency: CURRENCY },
  engine_mechanic: { min: 5000, max: 18000, currency: CURRENCY },
  brake_mechanic: { min: 4000, max: 14000, currency: CURRENCY },
  fuel_system_mechanic: { min: 3500, max: 12000, currency: CURRENCY },
  transmission_mechanic: { min: 7000, max: 25000, currency: CURRENCY },
  steering_mechanic: { min: 4500, max: 16000, currency: CURRENCY },
  tire_mechanic: { min: 2000, max: 8000, currency: CURRENCY },
  roadside_fuel_support: { min: 1500, max: 5000, currency: CURRENCY },
  towing_service: { min: 3000, max: 12000, currency: CURRENCY }
};

function getServiceCostRange(serviceType) {
  return { ...(SERVICE_COST_RANGES[serviceType] || SERVICE_COST_RANGES.general_mechanic) };
}

module.exports = { CURRENCY, SERVICE_COST_RANGES, getServiceCostRange };
