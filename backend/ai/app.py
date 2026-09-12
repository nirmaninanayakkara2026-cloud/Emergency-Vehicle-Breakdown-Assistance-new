"""FastAPI boundary for AI 1 classification and deterministic AI 2 guidance."""

from __future__ import annotations

import json

from fastapi import FastAPI
from pydantic import BaseModel, Field, field_validator

from services.ai1_prediction_service import MODEL, predict_fault
from ai2.services.troubleshooting_engine import (
    AI2_ROOT,
    KNOWLEDGE_PATH,
    check_stop_condition,
    get_guide_for_fault,
    process_step_result,
    start_troubleshooting,
)


# Check whether the AI knowledge and safety configuration files are available.
def _load_json_status(path) -> bool:
    try:
        with path.open("r", encoding="utf-8") as source:
            return bool(json.load(source))
    except (OSError, ValueError):
        return False


AI2_KNOWLEDGE_LOADED = _load_json_status(KNOWLEDGE_PATH)
AI2_SAFETY_RULES_LOADED = _load_json_status(AI2_ROOT / "config" / "risk_rules.json")


# Create the FastAPI application exposed to the backend.
app = FastAPI(
    title="Emergency Vehicle Breakdown AI Service",
    version="1.0.0",
)


# Request models for AI 1 and AI 2 operations.
class FaultPredictionRequest(BaseModel):
    symptom_text: str = Field(
        ...,
        min_length=1,
        max_length=3000,
        description="Driver symptom description used by AI 1",
    )

    @field_validator("symptom_text")
    @classmethod
    def validate_symptom_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("symptom_text must not be empty")
        return normalized


class FindGuideRequest(BaseModel):
    fault_category: str = Field(..., min_length=1, max_length=100)
    symptom_text: str | None = Field(default=None, max_length=3000)
    breakdown_type: str | None = Field(default=None, max_length=100)


class StartGuideRequest(BaseModel):
    guide_id: str = Field(..., min_length=1, max_length=100)
    safety_confirmed: bool = False


class StepResultRequest(BaseModel):
    guide_id: str = Field(..., min_length=1, max_length=100)
    step_id: str = Field(..., min_length=1, max_length=100)
    selected_result: str = Field(..., min_length=1, max_length=200)


class StopConditionRequest(BaseModel):
    guide_id: str = Field(..., min_length=1, max_length=100)
    condition: str = Field(..., min_length=1, max_length=200)


# Return only the guide fields needed by API consumers.
def _guide_summary(guide: dict[str, object]) -> dict[str, object]:
    return {
        "guide_id": guide["id"],
        "title": guide["title"],
        "fault_category": guide["fault_category"],
        "risk_level": guide["risk_level"],
        "risk_reason": guide["risk_reason"],
        "safety_warning": guide["safety_warning"],
        "before_you_begin": guide["before_you_begin"],
        "stop_conditions": guide["stop_conditions"],
        "requires_safety_confirmation": guide["requires_safety_confirmation"],
        "professional_help_required": guide["professional_help_required"],
        "recommended_service": guide["recommended_service"],
    }


# Service health and model availability endpoint.
@app.get("/health")
def health() -> dict[str, object]:
    return {
        "success": True,
        "service": "Emergency Vehicle Breakdown AI Service",
        "model": "AI1 Fault Classifier",
        "modelLoaded": MODEL is not None,
        "ai1ModelLoaded": MODEL is not None,
        "ai2KnowledgeLoaded": AI2_KNOWLEDGE_LOADED,
        "ai2SafetyRulesLoaded": AI2_SAFETY_RULES_LOADED,
    }


# AI 1 fault classification endpoint.
@app.post("/predict-fault")
def predict_fault_endpoint(payload: FaultPredictionRequest) -> dict[str, object]:
    return {
        "success": True,
        "prediction": predict_fault(payload.symptom_text),
    }


# AI 2 guide lookup endpoint.
@app.post("/ai2/find-guide")
def find_guide_endpoint(payload: FindGuideRequest) -> dict[str, object]:
    guide = get_guide_for_fault(payload.fault_category.strip(), payload.symptom_text, payload.breakdown_type)
    if not guide:
        return {
            "success": True,
            "guide_available": False,
            "professional_help_required": True,
            "recommended_service": "general_mechanic",
        }
    return {
        "success": True,
        "guide_available": True,
        "guide": _guide_summary(guide),
    }


# AI 2 troubleshooting session start endpoint.
@app.post("/ai2/start")
def start_guide_endpoint(payload: StartGuideRequest) -> dict[str, object]:
    return {
        "success": True,
        **start_troubleshooting(payload.guide_id, payload.safety_confirmed),
    }


# AI 2 troubleshooting step processing endpoint.
@app.post("/ai2/step")
def process_step_endpoint(payload: StepResultRequest) -> dict[str, object]:
    result = process_step_result(
        payload.guide_id, payload.step_id, payload.selected_result
    )
    if result.get("status") == "in_progress" and "current_step" in result:
        result["next_step"] = result.pop("current_step")
    return {"success": True, **result}


# AI 2 safety stop-condition endpoint.
@app.post("/ai2/stop-condition")
def stop_condition_endpoint(payload: StopConditionRequest) -> dict[str, object]:
    result = check_stop_condition(payload.guide_id, payload.condition)
    return {
        "success": True,
        "stop": bool(result.pop("triggered", False)),
        **result,
    }
