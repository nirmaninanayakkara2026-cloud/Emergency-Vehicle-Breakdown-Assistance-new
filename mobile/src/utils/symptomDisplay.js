const KEY_LABELS = {
  starting_behavior: "Starting Behaviour",
  light_condition: "Dashboard Lights"
};

const VALUE_LABELS = {
  not_sure: "Not Sure"
};

function titleCase(value) {
  return String(value)
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatSymptomKey(key) {
  return KEY_LABELS[key] || titleCase(key || "");
}

export function formatSymptomValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map(formatSymptomValue).join(", ") : "None";
  }
  if (value === null || value === undefined || value === "") return "None";
  return VALUE_LABELS[value] || titleCase(value);
}
