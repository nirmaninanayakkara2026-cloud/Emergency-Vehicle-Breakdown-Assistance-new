"""Shared rule data is also enforced by Node before any OpenAI request."""
import json
import re
from pathlib import Path

RULES = json.loads((Path(__file__).resolve().parents[1] / "config" / "conversation_safety.json").read_text())["rules"]


def detect_danger(text: str):
    normalized = str(text or "").lower().replace("_", " ").replace("’", "'")
    for clause in re.split(r"[.!;\n]|\bbut\b|\bhowever\b", normalized):
        if re.search(r":\s*(no|none|not noticed|not present)\s*$", clause):
            continue
        for rule in RULES:
            for match in re.finditer(rule["pattern"], clause):
                prefix = clause[:match.start()]
                # Only explicit, local negation is ignored; uncertainty still stops the flow.
                negated = re.search(r"\b(no|without|no sign of|no signs of)\s+(?:(?:visible|any|strong)\s+)?$", prefix)
                negated_list = rule["id"] == "smoke_or_fire" and re.search(r"\bno\s+(?:smoke|fire|flames)\s+(?:or|and)\s+$", prefix)
                intact_battery = rule["id"] == "battery_damage" and re.search(r"\b(?:not|isn't)\s+(?:leaking|swollen|cracked|damaged|hissing|bulging)\b", match.group())
                if not negated and not negated_list and not intact_battery:
                    return rule
    return None
