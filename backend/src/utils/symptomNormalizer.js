const OBSERVATION_GROUPS = ["see", "hear", "smell", "feel"];
// Utility functions to normalize symptom capture data, ensuring consistent structure and removing empty or duplicate values.
function cleanValue(value) {
  if (value === null || value === undefined) return undefined;
// Remove empty strings and trim whitespace from string values.
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
// Recursively clean arrays and remove duplicates based on value identity.
  if (Array.isArray(value)) {
    const seen = new Set();
    return value.reduce((result, item) => {
      const cleaned = cleanValue(item);
      if (cleaned === undefined) return result;

      const identity = typeof cleaned === "object" ? JSON.stringify(cleaned) : `${typeof cleaned}:${cleaned}`;
      if (!seen.has(identity)) {
        seen.add(identity);
        result.push(cleaned);
      }
      return result;
    }, []);
  }
// Recursively clean objects and remove keys with undefined values.
  if (typeof value === "object") {
    const source = value instanceof Map ? Object.fromEntries(value) : value;
    return Object.entries(source).reduce((result, [key, item]) => {
      const cleaned = cleanValue(item);
      if (cleaned !== undefined) result[key] = cleaned;
      return result;
    }, {});
  }

  return value;
}
// Normalize symptom capture data, ensuring consistent structure and removing empty or duplicate values.
function normalizeSymptomCapture(symptomCapture) {
  const source = symptomCapture && typeof symptomCapture === "object" ? symptomCapture : {};
  const observed = source.observedSymptoms && typeof source.observedSymptoms === "object"
    ? source.observedSymptoms
    : {};

  return {
    symptoms: cleanValue(source.symptoms) || {},
    observedSymptoms: OBSERVATION_GROUPS.reduce((result, group) => {
      const cleaned = cleanValue(observed[group]);
      result[group] = Array.isArray(cleaned) ? cleaned : [];
      return result;
    }, {}),
    additionalDescription: cleanValue(source.additionalDescription) || ""
  };
}

module.exports = { normalizeSymptomCapture };
