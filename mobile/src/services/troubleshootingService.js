import AsyncStorage from "@react-native-async-storage/async-storage";
import { troubleshootingGuides } from "../data/troubleshootingGuides";

const HISTORY_KEY = "selfAssistanceHistory";

export function findTroubleshootingGuide({ vehicleType, breakdownType }) {
  // Future AI integration point:
  // Replace or support this local matching with an API prediction result,
  // then continue to apply the same safety/risk guide rules below.
  return (
    troubleshootingGuides.find(
      (guide) =>
        guide.breakdownType === breakdownType &&
        (!guide.vehicleTypes || guide.vehicleTypes.includes(vehicleType))
    ) || troubleshootingGuides.find((guide) => guide.breakdownType === "other")
  );
}

export function getGuideRiskLevel(guide) {
  return guide?.riskLevel || "high";
}

export function validateGuide(guide) {
  if (!guide) return false;
  if (!guide.title || !guide.riskLevel || !guide.breakdownType) return false;
  if (guide.riskLevel !== "high" && (!guide.steps || guide.steps.length === 0)) return false;
  return true;
}

export async function readTroubleshootingHistory() {
  const value = await AsyncStorage.getItem(HISTORY_KEY);
  return value ? JSON.parse(value) : [];
}

export async function saveTroubleshootingHistory(record) {
  const existingHistory = await readTroubleshootingHistory();
  const nextHistory = [
    {
      date: new Date().toISOString(),
      vehicleType: record.vehicleType,
      breakdownType: record.breakdownType,
      riskLevel: record.riskLevel,
      result: record.result
    },
    ...existingHistory
  ].slice(0, 10);

  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}
