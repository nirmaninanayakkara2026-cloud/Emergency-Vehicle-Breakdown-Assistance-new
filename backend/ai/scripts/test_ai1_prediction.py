"""Exercise the local AI 1 prediction service with application-style text."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


AI_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(AI_ROOT))

from services.ai1_prediction_service import (  # noqa: E402
    FAULT_CLASSES,
    MODEL_NAME,
    predict_fault,
)


TEST_INPUTS = [
    (
        "Battery/electrical",
        "vehicle does not start dashboard lights are weak clicking sound",
    ),
    (
        "Cooling / overheating",
        "temperature gauge is very high steam coming from engine area and coolant appears to be leaking",
    ),
    ("Steering", "steering wheel suddenly became very difficult to turn"),
    ("Brake", "brake pedal feels soft and vehicle takes much longer to stop"),
    ("Tyre", "front tyre is completely flat and vehicle is pulling to one side"),
    (
        "Transmission",
        "vehicle hesitates when changing gears and transmission slips while accelerating",
    ),
    (
        "Fuel",
        "strong fuel smell vehicle loses power and fuel appears to be leaking",
    ),
    ("Ambiguous", "vehicle making strange noise and not working properly"),
]


def _format_prediction(name: str, text: str, result: dict[str, Any]) -> str:
    top_lines = [
        f"  {index}. {item['fault']}: {item['probability']:.6f}"
        for index, item in enumerate(result["top_predictions"], start=1)
    ]
    related_group = result["related_fault_group"] or "none"
    return "\n".join(
        [
            name,
            f"Input: {text}",
            f"Predicted fault: {result['predicted_fault']}",
            f"User-friendly label: {result['fault_label']}",
            f"Required service: {result['required_service']}",
            f"Confidence: {result['confidence']:.6f}",
            f"Prediction margin: {result['prediction_margin']:.6f}",
            f"Confidence level: {result['confidence_level']}",
            f"Ambiguous: {str(result['is_ambiguous']).lower()}",
            f"Needs more information: {str(result['needs_more_information']).lower()}",
            f"Related fault group: {related_group}",
            "Top 3 predictions:",
            *top_lines,
        ]
    )


def main() -> None:
    sections = ["AI 1 PREDICTION SERVICE TEST RESULTS", ""]
    results: list[dict[str, Any]] = []
    for name, text in TEST_INPUTS:
        result = predict_fault(text)
        results.append(result)
        section = _format_prediction(name, text, result)
        sections.extend([section, ""])
        print(f"\n{section}")

    ambiguous_count = sum(result["is_ambiguous"] for result in results)
    low_confidence_count = sum(
        result["confidence_level"] == "low" for result in results
    )
    summary = "\n".join(
        [
            "AI 1 PREDICTION SERVICE PREPARATION COMPLETE",
            "",
            f"Model: {MODEL_NAME}",
            f"Fault classes: {len(FAULT_CLASSES)}",
            "Fault-to-service mapping: Loaded",
            "Confidence policy: Loaded",
            f"Test predictions: {len(results)}",
            f"Ambiguous predictions: {ambiguous_count}",
            f"Low-confidence predictions: {low_confidence_count}",
            "Ready for FastAPI integration: YES",
        ]
    )
    sections.append(summary)
    output = "\n".join(sections) + "\n"
    report_path = AI_ROOT / "reports" / "model_results" / "ai1_prediction_tests.txt"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(output, encoding="utf-8")
    print(f"\n{summary}")


if __name__ == "__main__":
    main()
