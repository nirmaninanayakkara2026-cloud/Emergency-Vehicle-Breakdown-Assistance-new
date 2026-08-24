const OBSERVATION_GROUPS = ["see", "hear", "smell", "feel"];

function cleanValue(value) {
  if (value === null || value === undefined) return undefined;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

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
