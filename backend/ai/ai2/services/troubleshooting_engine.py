"""Authoritative, deterministic engine for approved AI 2 guides."""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from typing import Any
from ai2.services.safety import detect_danger


AI2_ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE_PATH = AI2_ROOT / "knowledge" / "troubleshooting_knowledge_base.json"


def _load_knowledge() -> dict[str, Any]:
    with KNOWLEDGE_PATH.open("r", encoding="utf-8") as source:
        return json.load(source)


_KNOWLEDGE = _load_knowledge()
_GUIDES = _KNOWLEDGE["guides"]
_GUIDES_BY_ID = {guide["id"]: guide for guide in _GUIDES}
_GUIDES_BY_FAULT: dict[str, list[dict[str, Any]]] = {}
for _guide in _GUIDES:
    _GUIDES_BY_FAULT.setdefault(_guide["fault_category"], []).append(_guide)
for _fault_guides in _GUIDES_BY_FAULT.values():
    _fault_guides.sort(key=lambda item: item["id"])


def _normalize(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value or "").lower()).strip("_")


def _public_step(step: dict[str, Any]) -> dict[str, Any]:
    source_question = str(step["question"]).strip()
    result_question = (
        "What did you safely observe?"
        if "source" in source_question.lower()
        else source_question
    )
    return {
        "step_id": step["step_id"],
        "kind": step.get("kind", "CHECK"),
        "uncertain_next_step": step.get("uncertain_next_step"),
        "simple_question": step.get("simple_question", "Choose the closest observation. Do not guess or touch anything."),
        "instruction": step.get("user_instruction") or step["instruction"],
        "requires_action_confirmation": True,
        "result_question": result_question,
        "question": result_question,
        "possible_results": [
            {
                "value": result["value"],
                "label": result["label"],
                "next_step": result["next_step"],
                "action": result["action"],
            }
            for result in step["possible_results"]
        ],
    }


def _guide_header(guide: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": guide["id"],
        "title": guide["title"],
        "risk_level": guide["risk_level"],
        "risk_reason": guide["risk_reason"],
        "safety_warning": guide["safety_warning"],
        "before_you_begin": copy.deepcopy(guide["before_you_begin"]),
        "requires_safety_confirmation": guide["requires_safety_confirmation"],
    }


def _public_guide(guide: dict[str, Any]) -> dict[str, Any]:
    """Return guide metadata and approved steps without internal source procedures."""
    public = {
        key: copy.deepcopy(value)
        for key, value in guide.items()
        if key not in {"steps", "source_diagnosis_steps"}
    }
    public["steps"] = [_public_step(step) for step in guide["steps"]]
    return public


def _professional_response(
    guide: dict[str, Any] | None,
    message: str = "This issue is not suitable for self-repair.",
) -> dict[str, Any]:
    return {
        "status": "professional_help_required",
        "risk_level": guide["risk_level"] if guide else "HIGH",
        "message": message,
        "recommended_service": (
            guide["recommended_service"] if guide else "general_mechanic"
        ),
    }


def get_guide_for_fault(fault_category: str, symptom_text: str = "", breakdown_type: str = "") -> dict[str, Any] | None:
    """Rank source symptoms and explicit matching phrases within the fault category."""
    guides = _GUIDES_BY_FAULT.get(str(fault_category), [])
    if not guides:
        return None
    context = _normalize(f"{symptom_text or ''} {breakdown_type or ''}").replace("tyre", "tire")
    if not context:
        return _public_guide(guides[0])  # Legacy callers without symptom context.
    ignored = {"the", "a", "is", "on", "from", "when", "with", "and", "of", "in", "car", "vehicle", "problem", "fault", "system", "engine", "electrical", "cooling", "fuel", "transmission", "steering", "brake", "other", "not", "no", "sure", "none", "normal", "signs", "noticed", "warning", "light", "driving"}
    words = set(context.split("_")) - ignored
    def score(guide):
        phrases = guide.get("matching_keywords", [])
        exact = sum(5 for phrase in phrases if f"_{_normalize(phrase).replace('tyre', 'tire')}_" in f"_{context}_")
        title = set(_normalize(guide["subcategory"]).replace("tyre", "tire").split("_")) - ignored
        symptoms = set(_normalize(" ".join(guide["symptoms"])).replace("tyre", "tire").split("_")) - ignored
        title_matches = len(words & title)
        symptom_matches = len(words & symptoms)
        # A shared generic word must not select an unrelated component guide.
        if not exact and not title_matches and symptom_matches < 2:
            return 0
        return exact + 3 * title_matches + symptom_matches
    ranked = sorted(guides, key=lambda guide: (-score(guide), guide["id"]))
    return _public_guide(ranked[0]) if score(ranked[0]) > 0 else None


def get_guide_by_id(guide_id: str) -> dict[str, Any] | None:
    guide = _GUIDES_BY_ID.get(str(guide_id))
    return _public_guide(guide) if guide else None


def start_troubleshooting(
    guide_id: str, safety_confirmed: bool = False
) -> dict[str, Any]:
    guide = _GUIDES_BY_ID.get(str(guide_id))
    if not guide:
        return {
            "status": "guide_unavailable",
            "guide_available": False,
            "professional_help_required": True,
            "message": "No validated self-troubleshooting guide is available for this issue.",
            "recommended_service": "general_mechanic",
        }
    if guide["risk_level"] == "HIGH" or guide["professional_help_required"]:
        return _professional_response(guide)
    if guide["risk_level"] == "CAUTION" and not safety_confirmed:
        return {
            "status": "safety_confirmation_required",
            "guide": _guide_header(guide),
            "current_step": None,
            "confirmation_text": "I have read and understood the safety warning.",
        }
    return {
        "status": "in_progress",
        "guide": _guide_header(guide),
        "current_step": _public_step(guide["steps"][0]),
    }


def get_current_step(guide_id: str, step_id: str) -> dict[str, Any] | None:
    guide = _GUIDES_BY_ID.get(str(guide_id))
    if not guide or guide["risk_level"] == "HIGH":
        return None
    for step in guide["steps"]:
        if step["step_id"] == step_id:
            return _public_step(step)
    return None


def process_step_result(
    guide_id: str,
    step_id: str,
    selected_result: str,
) -> dict[str, Any]:
    guide = _GUIDES_BY_ID.get(str(guide_id))
    if not guide:
        return _professional_response(
            None, "No validated guide is available. Professional assistance is recommended."
        )
    if guide["risk_level"] == "HIGH":
        return _professional_response(guide)

    normalized_result = _normalize(selected_result)
    stop_response = check_stop_condition(guide_id, selected_result)
    if stop_response["triggered"]:
        return {key: value for key, value in stop_response.items() if key != "triggered"}

    source_step = next(
        (step for step in guide["steps"] if step["step_id"] == step_id), None
    )
    if not source_step:
        return {
            "status": "invalid_step",
            "message": "The requested troubleshooting step does not exist.",
        }
    if normalized_result in {"not_sure", "unsure", "user_unsure", "i_am_not_sure"}:
        return {"status": "clarification_required", "message": _public_step(source_step)["simple_question"]}
    if normalized_result == "skip_unsure" and source_step.get("uncertain_next_step"):
        alternative = get_current_step(guide_id, source_step["uncertain_next_step"])
        if alternative:
            return {"status": "in_progress", "current_step": alternative}
    result = next(
        (
            item
            for item in source_step["possible_results"]
            if _normalize(item["value"]) == normalized_result
            or _normalize(item["label"]) == normalized_result
        ),
        None,
    )
    if not result:
        return {
            "status": "invalid_result",
            "message": "Select one of the approved results or report that you are not sure.",
            "allowed_results": [
                item["value"] for item in source_step["possible_results"]
            ],
        }

    action = result["action"]
    if action == "verify_resolution":
        return {
            "status": "awaiting_resolution_confirmation",
            "message": result["verification_question"],
            "next_step": get_current_step(guide_id, result["next_step"]) if result["next_step"] else None,
        }
    if action == "continue" and result["next_step"]:
        next_step = get_current_step(guide_id, result["next_step"])
        if next_step is None:
            return _professional_response(
                guide, "The next approved step is unavailable. Troubleshooting has stopped."
            )
        return {"status": "in_progress", "current_step": next_step}
    if action == "resolved":
        return {"status": "resolved", "message": "The approved pathway is complete."}
    if action in {"request_mechanic", "stop"}:
        return _professional_response(
            guide,
            result.get("escalation_reason", "The available approved checks cannot resolve this issue. Professional assistance is recommended."),
        )
    return _professional_response(guide)


def check_stop_condition(guide_id: str, reported_condition: str) -> dict[str, Any]:
    guide = _GUIDES_BY_ID.get(str(guide_id))
    if not guide:
        response = _professional_response(None)
        return {"triggered": True, **response}
    danger = detect_danger(reported_condition)
    matched = danger["id"] if danger else None
    if matched:
        response = _professional_response(
            guide,
            f"Troubleshooting stopped because a safety stop condition was reported: {matched}.",
        )
        return {"triggered": True, "stop_condition": matched, **response}
    return {"triggered": False, "status": "continue"}


def get_escalation_service(guide_id: str) -> str:
    guide = _GUIDES_BY_ID.get(str(guide_id))
    return guide["recommended_service"] if guide else "general_mechanic"
