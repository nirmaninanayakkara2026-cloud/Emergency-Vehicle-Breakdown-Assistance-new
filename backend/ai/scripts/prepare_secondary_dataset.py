"""Convert compatible secondary diagnostic cases into the shared AI 1 schema."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from inspect_secondary_dataset import AI_ROOT, SECONDARY_DATASET, analyze_secondary, choose_candidate

SECONDARY_MAPPING = AI_ROOT / "config" / "secondary_category_mapping.json"
PROCESSED_SECONDARY = AI_ROOT / "dataset" / "processed" / "ai1_secondary_fault_dataset.csv"
DATA_SOURCE = "secondary_diagnostic_dataset"


def clean_symptom_text(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"[^a-z0-9\s'-]", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")


def load_mapping(path: Path = SECONDARY_MAPPING) -> dict[str, str]:
    content = json.loads(path.read_text(encoding="utf-8"))
    mapping = content.get("mapping", {})
    if not isinstance(mapping, dict):
        raise ValueError("secondary_category_mapping.json must contain a mapping object")
    return {str(key): str(value) for key, value in mapping.items()}


def prepare_secondary_records(analysis: dict[str, Any], mapping: dict[str, str]) -> tuple[list[dict[str, str]], dict[str, Any]]:
    candidates = analysis["candidates"]
    description_field = choose_candidate(candidates, "problem description") or choose_candidate(candidates, "symptoms")
    classification_field = choose_candidate(candidates, "problem classification")
    diagnosis_field = choose_candidate(candidates, "diagnosis")
    procedure_field = choose_candidate(candidates, "repair procedure")
    record_id_field = next((column for column in analysis["columns"] if column.lower().replace(" ", "_") == "record_id"), None)

    if not description_field or not classification_field:
        raise ValueError("A meaningful description/symptom field and classification field are required")

    prepared: list[dict[str, str]] = []
    unmapped = Counter()
    unusable = 0
    for index, source in enumerate(analysis["rows"], start=1):
        source_category = source.get(classification_field, "").strip()
        fault_category = mapping.get(source_category, "")
        symptom_text = clean_symptom_text(source.get(description_field, ""))
        if not fault_category:
            unmapped[source_category or "<missing>"] += 1
            continue
        if not symptom_text:
            unusable += 1
            continue

        source_id = source.get(record_id_field, "").strip() if record_id_field else str(index)
        diagnosis = source.get(diagnosis_field, "").strip() if diagnosis_field else ""
        procedure = source.get(procedure_field, "").strip() if procedure_field else ""
        prepared.append(
            {
                "record_id": f"secondary_{source_id or index}",
                # Diagnosis is deliberately kept out of symptom_text to prevent target leakage.
                "symptom_text": symptom_text,
                "fault_category": fault_category,
                "original_fault_name": diagnosis or source_category,
                "diagnosis": diagnosis,
                "diagnostic_procedure": procedure,
                "data_source": DATA_SOURCE,
            }
        )

    return prepared, {
        "original_records": len(analysis["rows"]),
        "usable_records": len(prepared),
        "unusable_records": unusable,
        "unmapped_records": sum(unmapped.values()),
        "unmapped_categories": dict(unmapped),
        "description_field": description_field,
        "classification_field": classification_field,
        "diagnosis_field": diagnosis_field,
        "procedure_field": procedure_field,
    }


def write_secondary(records: list[dict[str, str]]) -> None:
    PROCESSED_SECONDARY.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "record_id",
        "symptom_text",
        "fault_category",
        "original_fault_name",
        "diagnosis",
        "diagnostic_procedure",
        "data_source",
    ]
    with PROCESSED_SECONDARY.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        writer.writerows(records)


def print_summary(records: list[dict[str, str]], metrics: dict[str, Any]) -> None:
    pair_count = len({(record["symptom_text"], record["fault_category"]) for record in records})
    print("SECONDARY DATASET PREPARATION COMPLETE")
    print(f"Original records: {metrics['original_records']}")
    print(f"Usable before deduplication: {metrics['usable_records']}")
    print(f"Unique symptom + fault pairs: {pair_count}")
    print(f"Unmapped records: {metrics['unmapped_records']}")
    print(f"Output: {PROCESSED_SECONDARY.relative_to(AI_ROOT).as_posix()}")


if __name__ == "__main__":
    secondary_analysis = analyze_secondary(SECONDARY_DATASET)
    secondary_records, secondary_metrics = prepare_secondary_records(secondary_analysis, load_mapping())
    write_secondary(secondary_records)
    print_summary(secondary_records, secondary_metrics)
