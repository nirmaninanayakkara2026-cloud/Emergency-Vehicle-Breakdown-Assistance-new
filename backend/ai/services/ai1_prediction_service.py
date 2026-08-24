"""Local AI 1 prediction service with confidence-handling business rules.

The model predicts a fault category from symptom text. Separate configuration
then maps that category to a service. Confidence levels are application-level
heuristics, not calibrated guarantees of correctness or safety assessments.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np


AI_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = AI_ROOT / "models" / "ai1_fault_classifier.joblib"
CONFIG_DIR = AI_ROOT / "config"


def _load_json(filename: str) -> dict[str, Any]:
    path = CONFIG_DIR / filename
    with path.open("r", encoding="utf-8") as source:
        return json.load(source)


# Module imports are cached by Python, so the model and configuration are loaded
# once per process and reused by every predict_fault call.
MODEL = joblib.load(MODEL_PATH)
FAULT_SERVICE_MAPPING = _load_json("fault_service_mapping.json")
CONFIDENCE_POLICY = _load_json("confidence_policy.json")
RELATED_FAULT_GROUPS = _load_json("related_fault_groups.json")
FAULT_LABELS = _load_json("fault_labels.json")

if not hasattr(MODEL, "predict_proba"):
    raise TypeError("The selected AI 1 model must support predict_proba()")

CLASSIFIER = MODEL.named_steps["classifier"]
FAULT_CLASSES = [str(value) for value in CLASSIFIER.classes_]
MODEL_NAME = "Logistic Regression"

for config_name, mapping in (
    ("fault-to-service mapping", FAULT_SERVICE_MAPPING),
    ("fault labels", FAULT_LABELS),
):
    missing_classes = sorted(set(FAULT_CLASSES).difference(mapping))
    extra_classes = sorted(set(mapping).difference(FAULT_CLASSES))
    if missing_classes or extra_classes:
        raise ValueError(
            f"Invalid {config_name}; missing={missing_classes}, extra={extra_classes}"
        )


def _confidence_level(top_probability: float, prediction_margin: float) -> str:
    high = CONFIDENCE_POLICY["high"]
    medium = CONFIDENCE_POLICY["medium"]
    if (
        top_probability >= high["minimum_top_probability"]
        and prediction_margin >= high["minimum_prediction_margin"]
    ):
        return "high"
    if (
        top_probability >= medium["minimum_top_probability"]
        or prediction_margin >= medium["minimum_prediction_margin"]
    ):
        return "medium"
    return "low"


def _related_group(first_fault: str, second_fault: str) -> str | None:
    pair = {first_fault, second_fault}
    for group_name, group_faults in RELATED_FAULT_GROUPS.items():
        if pair.issubset(set(group_faults)):
            return group_name
    return None


def predict_fault(symptom_text: str) -> dict[str, Any]:
    """Predict a fault and apply service, confidence, and ambiguity policies."""
    if not isinstance(symptom_text, str):
        raise TypeError("symptom_text must be a string")
    normalized_text = symptom_text.strip()
    if not normalized_text:
        raise ValueError("symptom_text must not be empty")

    probabilities = MODEL.predict_proba([normalized_text])[0]
    ranked_indices = np.argsort(probabilities)[::-1]
    top_indices = ranked_indices[:3]
    top_predictions = [
        {
            "fault": FAULT_CLASSES[int(index)],
            "probability": float(probabilities[int(index)]),
        }
        for index in top_indices
    ]

    predicted_fault = top_predictions[0]["fault"]
    top_probability = top_predictions[0]["probability"]
    second_probability = top_predictions[1]["probability"]
    prediction_margin = top_probability - second_probability
    confidence_level = _confidence_level(top_probability, prediction_margin)
    ambiguity_threshold = CONFIDENCE_POLICY["ambiguous"][
        "prediction_margin_below"
    ]
    is_ambiguous = prediction_margin < ambiguity_threshold
    related_fault_group = _related_group(
        top_predictions[0]["fault"], top_predictions[1]["fault"]
    )

    return {
        "predicted_fault": predicted_fault,
        "fault_label": FAULT_LABELS[predicted_fault],
        "required_service": FAULT_SERVICE_MAPPING[predicted_fault],
        "confidence": top_probability,
        "prediction_margin": prediction_margin,
        "confidence_level": confidence_level,
        "is_ambiguous": is_ambiguous,
        "needs_more_information": confidence_level == "low" or is_ambiguous,
        "related_fault_group": related_fault_group,
        "top_predictions": top_predictions,
    }
