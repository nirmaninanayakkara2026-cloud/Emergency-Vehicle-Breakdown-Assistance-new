const { rules } = require("../../ai/ai2/config/conversation_safety.json");

function detectDanger(value) {
  const text = String(value || "").toLowerCase().replace(/_/g, " ").replace(/’/g, "'");
  for (const clause of text.split(/[.!;\n]|\bbut\b|\bhowever\b/)) {
    if (/:\s*(no|none|not noticed|not present)\s*$/.test(clause)) continue;
    for (const rule of rules) {
      for (const match of clause.matchAll(new RegExp(rule.pattern, "g"))) {
        const prefix = clause.slice(0, match.index);
        const directNegation = /\b(no|without|no sign of|no signs of)\s+(?:(?:visible|any|strong)\s+)?$/.test(prefix);
        const negatedList = rule.id === "smoke_or_fire" && /\bno\s+(?:smoke|fire|flames)\s+(?:or|and)\s+$/.test(prefix);
        const intactBattery = rule.id === "battery_damage" && /\b(?:not|isn't)\s+(?:leaking|swollen|cracked|damaged|hissing|bulging)\b/.test(match[0]);
        if (!directNegation && !negatedList && !intactBattery) return rule;
      }
    }
  }
  return null;
}

function dangerMessage(danger) {
  return danger.emergency
    ? "Stop troubleshooting. Keep away from the vehicle and traffic. If there is fire or immediate danger, contact local emergency services. Professional assistance is required."
    : "Stop troubleshooting and keep clear of the unsafe area. Do not operate or repair the vehicle. Professional assistance is required.";
}

module.exports = { detectDanger, dangerMessage };
