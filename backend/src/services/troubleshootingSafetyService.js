const { rules } = require("../../ai/ai2/config/conversation_safety.json");

function isNegatedListItem(clause, match, explicitFailure) {
  if (explicitFailure) return false;
  const prefix = clause.slice(0, match.index);
  const negators = [...prefix.matchAll(/\b(?:no|without)\b/g)];
  if (!negators.length) return false;
  const listPrefix = prefix.slice(negators.at(-1).index + negators.at(-1)[0].length);
  const trimmedListPrefix = listPrefix.trim();
  if (!/^[a-z ,\/-]+$/i.test(trimmedListPrefix)
      || !/(?:,|\/|\band\b|\bor\b)$/i.test(trimmedListPrefix)
      || /\b(?:is|are|was|were|has|have|started|appeared|came|comes|coming)\b/i.test(trimmedListPrefix)) {
    return false;
  }

  // A verb immediately after the matched term starts an affirmative statement,
  // for example: "No warning light, but smoke is coming from the bonnet."
  const suffix = clause.slice(match.index + match[0].length);
  return !/^\s+(?:is|are|was|were|has|have|started|appeared|came|comes|coming|leak\w*|burn\w*|smok\w*)\b/i.test(suffix);
}

function detectDanger(value) {
  const text = String(value || "").replace(/\u2019/g, "'").toLowerCase().replace(/_/g, " ").replace(/’/g, "'");
  for (const clause of text.split(/[.!;\n]|\bbut\b|\bhowever\b/)) {
    if (/:\s*(no|none|not noticed|not present)\s*$/.test(clause)) continue;
    for (const rule of rules) {
      for (const match of clause.matchAll(new RegExp(rule.pattern, "g"))) {
        const prefix = clause.slice(0, match.index);
        const directNegation = /\b(no|without|no sign of|no signs of)\s+(?:(?:visible|any|strong)\s+)?$/.test(prefix);
        const negativeObservation = /\b(?:not|isn't|aren't|don't|doesn't|do not|does not|cannot see|can't see|cannot smell|can't smell)\s+(?:(?:currently|any|really|visibly|actively)\s+)?$/.test(prefix);
        const negativeCondition = /\b(?:is|are|was|were)\s+not\s+(?:currently\s+)?(?:leaking|overheating|swollen|burning|smoking)\b/.test(match[0]);
        const explicitFailure = /\b(?:is|are|was|were)\s+(?:not working|failed|failing|leak\w*|burn\w*|smok\w*)\b|\b(?:battery|fuel|petrol|gasoline|diesel|fluid)\s+leak\w*\b|\b(?:cannot|can't)\s+(?:stop|steer)\b/.test(match[0]);
        const negatedList = isNegatedListItem(clause, match, explicitFailure);
        const intactBattery = rule.id === "battery_damage" && /\b(?:not|isn't)\s+(?:leaking|swollen|cracked|damaged|hissing|bulging)\b/.test(match[0]);
        if (!directNegation && !negativeObservation && !negativeCondition && !negatedList && !intactBattery) return rule;
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
