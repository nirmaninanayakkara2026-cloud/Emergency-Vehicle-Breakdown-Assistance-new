"""Shared rule data is also enforced by Node before any OpenAI request."""
import json
import re
from pathlib import Path

RULES = json.loads((Path(__file__).resolve().parents[1] / "config" / "conversation_safety.json").read_text())["rules"]


def _is_negated_list_item(clause: str, match, explicit_failure) -> bool:
    if explicit_failure:
        return False
    prefix = clause[:match.start()]
    negators = list(re.finditer(r"\b(?:no|without)\b", prefix))
    if not negators:
        return False
    list_prefix = prefix[negators[-1].end():]
    trimmed_list_prefix = list_prefix.strip()
    if (
        not re.fullmatch(r"[a-z ,/-]+", trimmed_list_prefix, re.I)
        or not re.search(r"(?:,|/|\band\b|\bor\b)$", trimmed_list_prefix, re.I)
        or re.search(
            r"\b(?:is|are|was|were|has|have|started|appeared|came|comes|coming)\b",
            trimmed_list_prefix,
            re.I,
        )
    ):
        return False

    suffix = clause[match.end():]
    return not re.match(
        r"\s+(?:is|are|was|were|has|have|started|appeared|came|comes|coming|leak\w*|burn\w*|smok\w*)\b",
        suffix,
        re.I,
    )


def detect_danger(text: str):
    normalized = str(text or "").replace("\u2019", "'").lower().replace("_", " ").replace("’", "'")
    for clause in re.split(r"[.!;\n]|\bbut\b|\bhowever\b", normalized):
        if re.search(r":\s*(no|none|not noticed|not present)\s*$", clause):
            continue
        for rule in RULES:
            for match in re.finditer(rule["pattern"], clause):
                prefix = clause[:match.start()]
                # Only explicit, local negation is ignored; uncertainty still stops the flow.
                negated = re.search(r"\b(no|without|no sign of|no signs of)\s+(?:(?:visible|any|strong)\s+)?$", prefix)
                negative_observation = re.search(r"\b(?:not|isn't|aren't|don't|doesn't|do not|does not|cannot see|can't see|cannot smell|can't smell)\s+(?:(?:currently|any|really|visibly|actively)\s+)?$", prefix)
                negative_condition = re.search(r"\b(?:is|are|was|were)\s+not\s+(?:currently\s+)?(?:leaking|overheating|swollen|burning|smoking)\b", match.group())
                explicit_failure = re.search(
                    r"\b(?:is|are|was|were)\s+(?:not working|failed|failing|leak\w*|burn\w*|smok\w*)\b|\b(?:battery|fuel|petrol|gasoline|diesel|fluid)\s+leak\w*\b|\b(?:cannot|can't)\s+(?:stop|steer)\b",
                    match.group(),
                )
                negated_list = _is_negated_list_item(clause, match, explicit_failure)
                intact_battery = rule["id"] == "battery_damage" and re.search(r"\b(?:not|isn't)\s+(?:leaking|swollen|cracked|damaged|hissing|bulging)\b", match.group())
                if not negated and not negative_observation and not negative_condition and not negated_list and not intact_battery:
                    return rule
    return None
