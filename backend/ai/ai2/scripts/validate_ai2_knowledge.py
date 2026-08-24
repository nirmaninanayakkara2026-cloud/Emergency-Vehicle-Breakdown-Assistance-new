"""Validate the generated AI 2 knowledge base and its safety invariants."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


AI2_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_PATH = AI2_ROOT / "knowledge" / "troubleshooting_knowledge_base.json"
RISK_RULES_PATH = AI2_ROOT / "config" / "risk_rules.json"
SERVICE_MAPPING_PATH = AI2_ROOT / "config" / "service_mapping.json"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


def validate_knowledge_base(
    knowledge_path: Path = KNOWLEDGE_PATH,
) -> tuple[list[str], dict[str, int]]:
    errors: list[str] = []
    knowledge = load_json(knowledge_path)
    risk_rules = load_json(RISK_RULES_PATH)
    service_mapping = load_json(SERVICE_MAPPING_PATH)
    guides = knowledge.get("guides", [])
    valid_risks = set(risk_rules["valid_risk_levels"])
    valid_actions = set(risk_rules["valid_actions"])
    valid_faults = set(service_mapping)

    guide_ids: set[str] = set()
    source_ids: set[str] = set()
    total_steps = 0
    total_options = 0

    for index, guide in enumerate(guides):
        prefix = f"guide[{index}]"
        guide_id = guide.get("id")
        source_id = guide.get("source_record_id")
        if not guide_id:
            errors.append(f"{prefix}: missing guide id")
        elif guide_id in guide_ids:
            errors.append(f"{prefix}: duplicate guide id {guide_id}")
        else:
            guide_ids.add(guide_id)
        if not source_id:
            errors.append(f"{prefix}: missing source_record_id")
        elif source_id in source_ids:
            errors.append(f"{prefix}: duplicate source_record_id {source_id}")
        else:
            source_ids.add(source_id)

        fault = guide.get("fault_category")
        risk = guide.get("risk_level")
        service = guide.get("recommended_service")
        if fault not in valid_faults:
            errors.append(f"{guide_id}: invalid fault category {fault}")
        if risk not in valid_risks:
            errors.append(f"{guide_id}: invalid risk level {risk}")
        if fault in service_mapping and service != service_mapping[fault]:
            errors.append(f"{guide_id}: recommended service does not match mapping")
        if not guide.get("risk_reason"):
            errors.append(f"{guide_id}: risk reason is empty")
        if not isinstance(guide.get("stop_conditions"), list) or not guide["stop_conditions"]:
            errors.append(f"{guide_id}: stop conditions are missing")
        if risk == "HIGH" and guide.get("professional_help_required") is not True:
            errors.append(f"{guide_id}: HIGH guide must require professional help")
        if risk == "CAUTION":
            if not guide.get("safety_warning"):
                errors.append(f"{guide_id}: CAUTION guide needs a safety warning")
            if guide.get("requires_safety_confirmation") is not True:
                errors.append(f"{guide_id}: CAUTION guide needs safety confirmation")

        steps = guide.get("steps")
        if not isinstance(steps, list) or not steps:
            errors.append(f"{guide_id}: guide has no user-facing steps")
            continue
        step_ids = [step.get("step_id") for step in steps]
        if len(step_ids) != len(set(step_ids)):
            errors.append(f"{guide_id}: duplicate step IDs")
        step_id_set = set(step_ids)
        total_steps += len(steps)
        for step in steps:
            step_id = step.get("step_id")
            instruction = step.get("instruction") or step.get("user_instruction")
            if not instruction or not str(instruction).strip():
                errors.append(f"{guide_id}/{step_id}: empty user-facing instruction")
            if not step.get("question"):
                errors.append(f"{guide_id}/{step_id}: question is empty")
            options = step.get("possible_results")
            if not isinstance(options, list) or not options:
                errors.append(f"{guide_id}/{step_id}: possible results are missing")
                continue
            total_options += len(options)
            values: set[str] = set()
            for option in options:
                value = option.get("value")
                if not value or value in values:
                    errors.append(f"{guide_id}/{step_id}: invalid or duplicate result value")
                values.add(value)
                if not option.get("label"):
                    errors.append(f"{guide_id}/{step_id}/{value}: result label is empty")
                if option.get("action") not in valid_actions:
                    errors.append(
                        f"{guide_id}/{step_id}/{value}: invalid action {option.get('action')}"
                    )
                next_step = option.get("next_step")
                if next_step is not None and next_step not in step_id_set:
                    errors.append(
                        f"{guide_id}/{step_id}/{value}: orphan next_step {next_step}"
                    )

        if risk == "HIGH":
            safe_text = " ".join(
                str(step.get("instruction") or step.get("user_instruction") or "")
                for step in steps
            ).lower()
            if "professional assistance" not in safe_text:
                errors.append(f"{guide_id}: HIGH guide exposes no safe escalation step")

    expected_count = knowledge.get("metadata", {}).get("usable_guides")
    if expected_count != len(guides):
        errors.append("metadata usable guide count does not match guides")

    return errors, {
        "guides": len(guides),
        "steps": total_steps,
        "result_options": total_options,
    }


def main() -> None:
    errors, counts = validate_knowledge_base()
    if errors:
        print("AI 2 KNOWLEDGE VALIDATION: FAIL")
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)
    print("AI 2 KNOWLEDGE VALIDATION: PASS")
    print(f"Validated guides: {counts['guides']}")
    print(f"Validated troubleshooting steps: {counts['steps']}")
    print(f"Validated result options: {counts['result_options']}")


if __name__ == "__main__":
    main()
