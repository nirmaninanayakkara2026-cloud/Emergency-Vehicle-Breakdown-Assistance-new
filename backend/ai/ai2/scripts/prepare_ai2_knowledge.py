"""Build the deterministic, safety-controlled AI 2 knowledge base."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from validate_ai2_knowledge import validate_knowledge_base


AI_ROOT = Path(__file__).resolve().parents[2]
AI2_ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_PATH = AI_ROOT / "dataset" / "processed" / "ai2_troubleshooting_archive.json"
RISK_RULES_PATH = AI2_ROOT / "config" / "risk_rules.json"
SERVICE_MAPPING_PATH = AI2_ROOT / "config" / "service_mapping.json"
KNOWLEDGE_PATH = AI2_ROOT / "knowledge" / "troubleshooting_knowledge_base.json"
AUDIT_PATH = AI2_ROOT / "reports" / "ai2_knowledge_audit.txt"
UNMAPPED_PATH = AI2_ROOT / "reports" / "ai2_unmapped_records.txt"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


def slugify(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return normalized or "result"


def contains_any(text: str, values: list[str]) -> bool:
    lowered = text.lower()
    return any(value.lower() in lowered for value in values)


def classify_risk(record: dict[str, Any], rules: dict[str, Any]) -> tuple[str, str]:
    fault = record["fault_category"]
    title = record["original_fault_name"]
    procedure_text = " ".join(
        str(step.get("step", "")) for step in record["diagnosis_steps"]
    )
    if fault in rules["always_high_fault_categories"]:
        return "HIGH", f"{fault} is classified as high risk by the project safety rules."
    if title in rules["low_title_overrides"]:
        return "LOW", "The approved user pathway is limited to a basic non-invasive observation."
    if title in rules["caution_title_overrides"]:
        return "CAUTION", "The approved pathway is limited to a careful visual or basic check."
    if contains_any(title, rules["high_title_keywords"]):
        return "HIGH", "The source topic involves a component that is not suitable for roadside self-repair."
    if contains_any(procedure_text, rules["high_procedure_keywords"]):
        return "HIGH", "The source procedure requires invasive work, specialist tools, or hazardous testing."
    if fault in rules["caution_fault_categories"] or contains_any(
        f"{title} {procedure_text}", rules["caution_keywords"]
    ):
        return "CAUTION", "The source procedure requires extra care and is restricted to safe observations."
    return "LOW", "The approved pathway contains only a basic non-invasive observation."


def user_instruction(source_instruction: str, fault: str) -> str:
    text = source_instruction.strip()
    lowered = text.lower()
    if "wiring" in lowered or "harness" in lowered:
        return "Check only for clearly visible loose or damaged wiring. Do not touch exposed wires."
    if "coolant" in lowered or "radiator" in lowered or "water pump" in lowered:
        return (
            "Wait until the engine is completely cool. From a safe position, look only for the "
            "visible condition described by the source check. Do not open a hot or pressurized cap."
        )
    if "leak" in lowered:
        return (
            "From a safe distance, look only for a clearly visible leak around the named area. "
            "Do not touch or identify the fluid yourself."
        )
    if "tire pressure" in lowered or "tyre pressure" in lowered:
        return "With the vehicle safely parked, check the tyre pressure using a suitable gauge."
    if "fluid level" in lowered or "oil level" in lowered:
        return (
            "With the vehicle safely parked and switched off, check the visible fluid level only "
            "as described in the vehicle owner's manual. Do not continue if the area is hot or unsafe."
        )
    if "belt" in lowered:
        return (
            "With the engine switched off, look only for clearly visible belt damage. "
            "Do not touch the belt or place your hands near moving parts."
        )
    if "fuse" in lowered:
        return (
            "With the vehicle switched off, visually check the named fuse only if it is safely "
            "accessible and identified in the owner's manual. Never bypass a fuse."
        )
    if lowered.startswith(("test ", "measure ", "perform ", "adjust ", "replace ")):
        return (
            "Do not perform this technical source procedure yourself. Record the symptom you can "
            "observe safely and request professional assistance if the check needs tools or dismantling."
        )
    if lowered.startswith(("inspect ", "check ")):
        return (
            f"From a safe position and without removing parts, {text[0].lower() + text[1:]}. "
            "Stop if the area is not clearly visible or safely accessible."
        )
    return (
        "Observe only the condition described by the source check without removing or touching parts. "
        "Stop if you are unsure."
    )


def is_safe_source_step(source_instruction: str) -> bool:
    """Allow only source checks that can be presented as non-invasive observation."""
    lowered = source_instruction.strip().lower()
    unsafe_prefixes = ("test ", "measure ", "perform ", "adjust ", "replace ", "scan ")
    unsafe_phrases = (
        "pressure test",
        "check pressure at",
        "check valve clearance",
        "check timing marks",
        "check for excessive play",
        "check driveline alignment",
        "check wheel bearing for play",
        "check wheel bearings",
        "check axle bearings",
        "check differential bearing",
        "check mounting bolts",
        "check manifold bolts",
        "check coolant flow",
        "check ac system components",
        "check wheel alignment",
        "inspect piston",
        "inspect valve",
        "inspect oil pump",
        "inspect starter motor brushes",
        "inspect tpms sensors",
        "inspect window regulator",
        "inspect actuator mechanism",
        "inspect wiper motor linkage",
        "inspect blower motor",
        "inspect evaporator",
        "inspect distributor",
        "inspect spark plug",
        "inspect throttle body",
        "inspect pcv valve",
        "inspect fuel filter",
        "inspect headlamp bulb",
        "check headlamp socket",
    )
    return not lowered.startswith(unsafe_prefixes) and not contains_any(
        lowered, list(unsafe_phrases)
    )


def build_results(
    raw_results: list[Any], next_step: str | None, rules: dict[str, Any]
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    used_values: set[str] = set()
    for index, raw_result in enumerate(raw_results):
        label = str(raw_result).strip()
        value = slugify(label)
        if value in used_values:
            value = f"{value}_{index + 1}"
        used_values.add(value)
        results.append(
            {
                "value": value,
                "label": label,
                "source_result": label,
                "next_step": next_step,
                "action": "continue" if next_step else "request_mechanic",
                "branching_note": rules["incomplete_branching_note"],
            }
        )
    return results


def build_user_steps(
    record: dict[str, Any], risk: str, rules: dict[str, Any]
) -> list[dict[str, Any]]:
    if risk == "HIGH":
        return [
            {
                "step_id": "step_1",
                "source_instruction": None,
                "user_instruction": "Do not attempt further repair. Professional assistance is recommended.",
                "instruction": "Do not attempt further repair. Professional assistance is recommended.",
                "question": "Would you like to continue to professional assistance?",
                "possible_results": [
                    {
                        "value": "request_professional_help",
                        "label": "Request professional assistance",
                        "source_result": None,
                        "next_step": None,
                        "action": "request_mechanic",
                        "branching_note": "Deterministic HIGH-risk safety escalation.",
                    }
                ],
            }
        ]

    raw_steps = [
        step
        for step in record["diagnosis_steps"]
        if is_safe_source_step(str(step.get("step", "")))
    ]
    steps: list[dict[str, Any]] = []
    for index, raw_step in enumerate(raw_steps):
        step_id = f"step_{index + 1}"
        next_step = f"step_{index + 2}" if index + 1 < len(raw_steps) else None
        source_instruction = str(raw_step["step"]).strip()
        safe_instruction = user_instruction(source_instruction, record["fault_category"])
        steps.append(
            {
                "step_id": step_id,
                "source_instruction": source_instruction,
                "user_instruction": safe_instruction,
                "instruction": safe_instruction,
                "question": "Which source result best matches what you safely observed? Stop if you are unsure.",
                "possible_results": build_results(raw_step["result"], next_step, rules),
            }
        )
    return steps


def build_guide(
    record: dict[str, Any], rules: dict[str, Any], services: dict[str, str]
) -> dict[str, Any]:
    risk, risk_reason = classify_risk(record, rules)
    if risk == "HIGH":
        warning = rules["high_warning"]
        before = []
    elif risk == "CAUTION":
        warning = rules["caution_warning"]
        before = rules["caution_before_you_begin"]
    else:
        warning = "Use only the non-invasive observation shown. Stop if anything appears unsafe."
        before = rules["low_before_you_begin"]

    return {
        "id": f"ai2_{record['record_id']}",
        "source_record_id": record["record_id"],
        "source_data_source": record.get("data_source"),
        "category": record["source_category"],
        "subcategory": record["original_fault_name"],
        "fault_category": record["fault_category"],
        "title": f"{record['original_fault_name']} Safety Guide",
        "symptoms": [str(item).strip() for item in record["symptoms"] if str(item).strip()],
        "guide_available": True,
        "risk_level": risk,
        "risk_reason": risk_reason,
        "safety_warning": warning,
        "before_you_begin": before,
        "requires_safety_confirmation": risk == "CAUTION",
        "steps": build_user_steps(record, risk, rules),
        "source_diagnosis_steps": record["diagnosis_steps"],
        "stop_conditions": rules["global_stop_conditions"],
        "recommended_service": services[record["fault_category"]],
        "professional_help_required": risk == "HIGH",
        "branching_complete": risk == "HIGH",
        "branching_note": (
            "Deterministic HIGH-risk escalation replaces hazardous user-facing procedures."
            if risk == "HIGH"
            else rules["incomplete_branching_note"]
        ),
    }


def is_usable(record: dict[str, Any], services: dict[str, str]) -> tuple[bool, str]:
    required = (
        "record_id",
        "source_category",
        "original_fault_name",
        "fault_category",
        "symptoms",
        "diagnosis_steps",
    )
    missing = [field for field in required if not record.get(field)]
    if missing:
        return False, f"missing required source fields: {', '.join(missing)}"
    if record["fault_category"] not in services:
        return False, "fault category has no approved service mapping"
    for index, step in enumerate(record["diagnosis_steps"]):
        if not step.get("step") or not isinstance(step.get("result"), list) or not step["result"]:
            return False, f"diagnosis step {index + 1} is incomplete"
    return True, ""


def write_reports(
    archive_count: int,
    guides: list[dict[str, Any]],
    excluded: list[tuple[str, str]],
) -> dict[str, int]:
    risks = Counter(guide["risk_level"] for guide in guides)
    total_steps = sum(len(guide["steps"]) for guide in guides)
    total_options = sum(
        len(step["possible_results"]) for guide in guides for step in guide["steps"]
    )
    incomplete = sum(not guide["branching_complete"] for guide in guides)
    professional = sum(guide["professional_help_required"] for guide in guides)
    fault_count = len({guide["fault_category"] for guide in guides})
    counts = {
        "archive": archive_count,
        "usable": len(guides),
        "low": risks["LOW"],
        "caution": risks["CAUTION"],
        "high": risks["HIGH"],
        "professional": professional,
        "faults": fault_count,
        "excluded": len(excluded),
        "incomplete": incomplete,
        "steps": total_steps,
        "options": total_options,
    }
    audit = "\n".join(
        [
            "AI 2 TROUBLESHOOTING KNOWLEDGE AUDIT",
            "",
            f"Original archive records: {archive_count}",
            f"Usable troubleshooting guides: {len(guides)}",
            f"LOW risk: {risks['LOW']}",
            f"CAUTION risk: {risks['CAUTION']}",
            f"HIGH risk: {risks['HIGH']}",
            f"Guides requiring professional help: {professional}",
            f"Fault categories represented: {fault_count}",
            f"Records excluded: {len(excluded)}",
            f"Records with incomplete branching: {incomplete}",
            f"Total troubleshooting steps: {total_steps}",
            f"Total result options: {total_options}",
            "",
            "SAFETY POLICY",
            "Risk levels are produced only by deterministic project rules.",
            "HIGH-risk source procedures are retained only in source_diagnosis_steps and are not returned as user-facing steps.",
            "LOW and CAUTION paths preserve source order because the archive contains no result-specific branching.",
            "No result is treated as a completed repair because the source does not establish repair outcomes.",
        ]
    )
    AUDIT_PATH.write_text(audit + "\n", encoding="utf-8")
    if excluded:
        unmapped_lines = [
            "AI 2 EXCLUDED / UNMAPPED SOURCE RECORDS",
            "",
            *[f"{record_id}: {reason}" for record_id, reason in excluded],
        ]
    else:
        unmapped_lines = [
            "AI 2 EXCLUDED / UNMAPPED SOURCE RECORDS",
            "",
            "Records excluded: 0",
            "All source records contained traceable symptoms, steps, result options, and an approved service mapping.",
        ]
    UNMAPPED_PATH.write_text("\n".join(unmapped_lines) + "\n", encoding="utf-8")
    return counts


def main() -> None:
    AI2_ROOT.joinpath("knowledge").mkdir(parents=True, exist_ok=True)
    AI2_ROOT.joinpath("reports").mkdir(parents=True, exist_ok=True)
    archive = load_json(ARCHIVE_PATH)
    rules = load_json(RISK_RULES_PATH)
    services = load_json(SERVICE_MAPPING_PATH)
    guides: list[dict[str, Any]] = []
    excluded: list[tuple[str, str]] = []
    for record in archive:
        usable, reason = is_usable(record, services)
        if usable:
            guide = build_guide(record, rules, services)
            if guide["steps"]:
                guides.append(guide)
            else:
                excluded.append(
                    (
                        str(record["record_id"]),
                        "guide_available=false; professional_help_required=true; "
                        "the source contains no non-invasive user-facing step",
                    )
                )
        else:
            excluded.append((str(record.get("record_id", "unknown")), reason))
    guides.sort(key=lambda guide: guide["id"])
    counts = write_reports(len(archive), guides, excluded)
    knowledge = {
        "metadata": {
            "source_archive": ARCHIVE_PATH.name,
            "archive_records": len(archive),
            "usable_guides": len(guides),
            "excluded_records": len(excluded),
            "risk_policy": "deterministic_project_rules",
            "branching_policy": "source_order_only_no_inferred_repair_outcomes",
        },
        "guides": guides,
    }
    KNOWLEDGE_PATH.write_text(json.dumps(knowledge, indent=2) + "\n", encoding="utf-8")
    errors, validation_counts = validate_knowledge_base(KNOWLEDGE_PATH)
    validation = "FAIL" if errors else "PASS"
    safety = "FAIL" if errors else "PASS"

    print("AI 2 KNOWLEDGE BASE PREPARATION COMPLETE")
    print(f"Archive records: {counts['archive']}")
    print(f"Usable guides: {counts['usable']}")
    print(f"LOW: {counts['low']}")
    print(f"CAUTION: {counts['caution']}")
    print(f"HIGH: {counts['high']}")
    print(f"Excluded: {counts['excluded']}")
    print(f"Validated troubleshooting steps: {validation_counts['steps']}")
    print(f"Knowledge validation: {validation}")
    print(f"Safety rules: {safety}")
    print(f"Ready for AI 2 API: {'NO' if errors else 'YES'}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
