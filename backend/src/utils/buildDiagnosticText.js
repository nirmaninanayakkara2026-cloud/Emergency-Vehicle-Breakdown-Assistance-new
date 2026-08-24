const SYMPTOM_LABELS = {
  starting_behavior: "Starting behavior",
  light_condition: "Dashboard lights"
};

const OBSERVATION_LABELS = {
  see: "Observed visually",
  hear: "Observed sound",
  smell: "Observed smell",
  feel: "Observed feeling"
};

function humanize(value) {
  return String(value).trim().replace(/_/g, " ");
}

function formatValue(value) {
  if (Array.isArray(value)) return value.map(humanize).join(", ");
  return humanize(value);
}

function getSymptomsObject(symptoms) {
  if (symptoms instanceof Map) return Object.fromEntries(symptoms);
  return symptoms && typeof symptoms === "object" ? symptoms : {};
}

function buildDiagnosticText({ vehicleType, breakdownType, symptomCapture, problemDescription } = {}) {
  const sentences = [];
  if (vehicleType) sentences.push(`Vehicle type: ${humanize(vehicleType)}`);
  if (breakdownType) sentences.push(`Main problem: ${humanize(breakdownType)}`);

  const capture = symptomCapture && typeof symptomCapture === "object" ? symptomCapture : {};
  Object.entries(getSymptomsObject(capture.symptoms)).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length)) return;
    const label = SYMPTOM_LABELS[key] || humanize(key).replace(/^./, (letter) => letter.toUpperCase());
    sentences.push(`${label}: ${formatValue(value)}`);
  });

  const observed = capture.observedSymptoms || {};
  Object.entries(OBSERVATION_LABELS).forEach(([key, label]) => {
    const values = observed[key];
    if (Array.isArray(values) && values.length) sentences.push(`${label}: ${formatValue(values)}`);
  });

  if (capture.additionalDescription) {
    sentences.push(`Additional symptom description: ${String(capture.additionalDescription).trim()}`);
  }
  if (problemDescription && String(problemDescription).trim()) {
    sentences.push(`Driver description: ${String(problemDescription).trim()}`);
  }

  return sentences.map((sentence) => `${sentence.replace(/[.\s]+$/, "")}.`).join(" ");
}

module.exports = { buildDiagnosticText };
