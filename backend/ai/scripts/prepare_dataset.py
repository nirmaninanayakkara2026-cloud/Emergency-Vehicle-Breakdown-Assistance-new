"""Prepare the audited automotive-fault JSON for a future AI Module 1 baseline."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from inspect_dataset import (
    AI_ROOT,
    APP_STYLE_EXAMPLES,
    AUDIT_REPORT,
    RAW_DATASET,
    analyze_dataset,
    render_audit,
)

PROCESSED_DATASET = AI_ROOT / "dataset" / "processed" / "ai1_fault_dataset.csv"
AI2_ARCHIVE = AI_ROOT / "dataset" / "processed" / "ai2_troubleshooting_archive.json"
SERVICE_MAPPING = AI_ROOT / "config" / "fault_service_mapping.json"

# This ontology keeps distinct vehicle systems separate. The two source engine
# groupings are merged because both describe engine faults. The source
# "Liquid Systems" group is split by its real component because its records
# span otherwise unrelated brake, cooling, steering, and visibility systems.
CATEGORY_NORMALIZATION = {
    "ABS System": "brake_system_fault",
    "Air Conditioning System": "air_conditioning_fault",
    "Cooling System": "cooling_system_fault",
    "Drivetrain": "drivetrain_fault",
    "Electrical System": "electrical_system_fault",
    "Emissions System": "emissions_system_fault",
    "Engine Components": "engine_system_fault",
    "Engine Compartment": "engine_system_fault",
    "Fuel System": "fuel_system_fault",
    "Steering": "steering_system_fault",
    "Transmission": "transmission_fault",
    "Wheels & Tires": "wheel_tire_fault",
}

LIQUID_COMPONENT_NORMALIZATION = {
    "Brake Fluid": "brake_system_fault",
    "Coolant Reservoir": "cooling_system_fault",
    "Radiator": "cooling_system_fault",
    "Power Steering Fluid": "steering_system_fault",
    "Windshield Washer Fluid": "visibility_system_fault",
}

FAULT_SERVICE_MAPPING = {
    "air_conditioning_fault": "general_mechanic",
    "brake_system_fault": "brake_mechanic",
    "cooling_system_fault": "engine_mechanic",
    "drivetrain_fault": "general_mechanic",
    "electrical_system_fault": "battery_electrical_mechanic",
    "emissions_system_fault": "engine_mechanic",
    "engine_system_fault": "engine_mechanic",
    "fuel_system_fault": "engine_mechanic",
    "steering_system_fault": "general_mechanic",
    "transmission_fault": "general_mechanic",
    "visibility_system_fault": "general_mechanic",
    "wheel_tire_fault": "tire_mechanic",
}


def slug(value: str) -> str:
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", value.lower())).strip("_")


def normalize_fault_category(category: str, original_fault_name: str) -> str:
    """Normalize only categories supported by actual source records."""
    if category == "Liquid Systems":
        mapped = LIQUID_COMPONENT_NORMALIZATION.get(original_fault_name)
        if mapped:
            return mapped
    if category in CATEGORY_NORMALIZATION:
        return CATEGORY_NORMALIZATION[category]
    # A deterministic fallback keeps newly added source categories visible
    # instead of silently merging them with an unrelated class.
    return f"{slug(category)}_fault" if category else ""


def _remove_explicit_diagnosis(text: str, label: str) -> tuple[str, int]:
    """Remove explicit diagnosis phrases, but retain normal automotive terms."""
    if not label:
        return text, 0
    escaped = re.escape(label.lower())
    patterns = (
        rf"\bdiagnosed\s+as\s+{escaped}\b",
        rf"\bfaulty\s+{escaped}\b",
        rf"\b{escaped}\s+(?:fault|failure|malfunction)\b",
    )
    removals = 0
    for pattern in patterns:
        text, count = re.subn(pattern, " ", text, flags=re.IGNORECASE)
        removals += count
    return text, removals


def clean_symptom_text(symptoms: Any, source_category: str, original_fault_name: str) -> tuple[str, int]:
    if isinstance(symptoms, str):
        parts = [symptoms]
    elif isinstance(symptoms, list):
        parts = [item for item in symptoms if isinstance(item, str)]
    else:
        parts = []

    text = " ".join(part.strip() for part in parts if part.strip()).lower()
    text, fault_name_removals = _remove_explicit_diagnosis(text, original_fault_name)
    text, category_removals = _remove_explicit_diagnosis(text, source_category)
    # Preserve automotive words and hyphenated terms while removing punctuation
    # that does not carry diagnostic meaning.
    text = re.sub(r"[^a-z0-9\s'-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip(" .,-")
    return text, fault_name_removals + category_removals


def build_diagnostic_procedure(steps: Any) -> str:
    if not isinstance(steps, list):
        return ""
    real_steps = []
    for item in steps:
        if isinstance(item, dict) and isinstance(item.get("step"), str):
            step = re.sub(r"\s+", " ", item["step"]).strip()
            if step:
                real_steps.append(step)
        elif isinstance(item, str) and item.strip():
            real_steps.append(re.sub(r"\s+", " ", item).strip())
    return "; ".join(real_steps)


def prepare_records(records: list[dict[str, Any]]) -> tuple[list[dict[str, str]], dict[str, int]]:
    prepared: list[dict[str, str]] = []
    seen_pairs: set[tuple[str, str]] = set()
    metrics = {
        "original_records": len(records),
        "unusable_records": 0,
        "duplicate_pairs_removed": 0,
        "leakage_phrases_removed": 0,
    }

    for index, record in enumerate(records, start=1):
        source_category = record.get("category", "") if isinstance(record.get("category"), str) else ""
        fault_name = record.get("subcategory", "") if isinstance(record.get("subcategory"), str) else ""
        fault_category = normalize_fault_category(source_category, fault_name)
        symptom_text, removals = clean_symptom_text(
            record.get("symptoms"), source_category, fault_name
        )
        metrics["leakage_phrases_removed"] += removals

        if not symptom_text or not fault_category:
            metrics["unusable_records"] += 1
            continue

        duplicate_key = (symptom_text, fault_category)
        if duplicate_key in seen_pairs:
            metrics["duplicate_pairs_removed"] += 1
            continue
        seen_pairs.add(duplicate_key)

        prepared.append(
            {
                "record_id": f"aktc_{index:04d}",
                "symptom_text": symptom_text,
                "fault_category": fault_category,
                "original_fault_name": fault_name,
                "diagnostic_procedure": build_diagnostic_procedure(record.get("diagnosis_steps")),
                # The source has no resolution field; keep this blank rather than fabricate one.
                "resolution": "",
            }
        )

    metrics["usable_records"] = len(prepared)
    return prepared, metrics


def write_processed_csv(records: list[dict[str, str]]) -> None:
    PROCESSED_DATASET.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "record_id",
        "symptom_text",
        "fault_category",
        "original_fault_name",
        "diagnostic_procedure",
        "resolution",
    ]
    with PROCESSED_DATASET.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        writer.writerows(records)


def write_ai2_archive(records: list[dict[str, Any]]) -> None:
    """Preserve nested diagnostic steps and result options for future AI Module 2 work."""
    archive = []
    for index, record in enumerate(records, start=1):
        source_category = record.get("category", "")
        fault_name = record.get("subcategory", "")
        archive.append(
            {
                "record_id": f"aktc_{index:04d}",
                "data_source": "primary_automotive_fault_dataset",
                "source_category": source_category,
                "fault_category": normalize_fault_category(source_category, fault_name),
                "original_fault_name": fault_name,
                "symptoms": record.get("symptoms", []),
                "diagnosis_steps": record.get("diagnosis_steps", []),
            }
        )
    AI2_ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    AI2_ARCHIVE.write_text(json.dumps(archive, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_service_mapping(classes: set[str]) -> None:
    missing = classes - FAULT_SERVICE_MAPPING.keys()
    if missing:
        raise ValueError(f"No service mapping defined for processed categories: {sorted(missing)}")
    mapping = {category: FAULT_SERVICE_MAPPING[category] for category in sorted(classes)}
    SERVICE_MAPPING.parent.mkdir(parents=True, exist_ok=True)
    SERVICE_MAPPING.write_text(json.dumps(mapping, indent=2) + "\n", encoding="utf-8")


def write_final_audit(analysis: dict[str, Any], prepared: list[dict[str, str]], metrics: dict[str, int]) -> None:
    counts = Counter(record["fault_category"] for record in prepared)
    low_classes = {category: count for category, count in counts.items() if count < 5}
    conclusion = "SUITABLE_FOR_BASELINE_MODEL" if analysis["suitable"] else "INSUFFICIENT_DATA_FOR_RELIABLE_MODEL"
    normalized_lines = [
        f"  - {category}: {count} ({count / len(prepared):.1%})"
        + (" [VERY FEW EXAMPLES]" if count < 5 else "")
        for category, count in counts.most_common()
    ]
    additions = f"""

PROCESSED DATASET RESULTS
=========================
Standardized columns: record_id, symptom_text, fault_category, original_fault_name, diagnostic_procedure, resolution
Original records: {metrics['original_records']}
Usable processed records: {metrics['usable_records']}
Unusable records skipped: {metrics['unusable_records']}
Duplicate symptom + normalized-fault pairs removed: {metrics['duplicate_pairs_removed']}
Explicit diagnosis phrases removed from symptom_text: {metrics['leakage_phrases_removed']}
Processed fault classes: {len(counts)}

Records per normalized fault class:
{chr(10).join(normalized_lines)}

Low-data normalized classes (<5 records): {', '.join(f'{key}={value}' for key, value in sorted(low_classes.items())) or 'none'}

Data leakage check:
symptom_text is built only from the real source symptoms field. Source category and subcategory values are not appended.
Only explicit diagnosis constructions such as "diagnosed as X", "faulty X", or "X fault" are removed; ordinary automotive terms are retained.

Category normalization notes:
The two engine source groups are combined into engine_system_fault. The heterogeneous Liquid Systems source group is split using its actual component name. Unrelated vehicle systems are otherwise kept separate.

Service mapping:
fault_service_mapping.json is business logic only and is not included in the training CSV.

Final assessment:
The processed data is structurally usable for experimentation, but {metrics['usable_records']} records across {len(counts)} classes is too small and imbalanced for a reliable classifier. In particular, visibility, steering, and wheel/tire classes have fewer than five examples. Conflicting identical symptom text also occurs across different fault classes.

{conclusion}
"""
    AUDIT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_REPORT.write_text(render_audit(analysis).rstrip() + additions, encoding="utf-8")


def print_summary(prepared: list[dict[str, str]], metrics: dict[str, int], suitable: bool) -> None:
    classes = sorted({record["fault_category"] for record in prepared})
    assessment = "SUITABLE_FOR_BASELINE_MODEL" if suitable else "INSUFFICIENT_DATA_FOR_RELIABLE_MODEL"
    print("AI 1 DATASET PREPARATION COMPLETE")
    print(f"\nOriginal records:\n{metrics['original_records']}")
    print(f"\nUsable records:\n{metrics['usable_records']}")
    print(f"\nFault classes:\n{len(classes)}")
    print("\nClasses:\n" + "\n".join(classes))
    print(f"\nDuplicate records removed:\n{metrics['duplicate_pairs_removed']}")
    print(f"\nProcessed dataset:\n{PROCESSED_DATASET.relative_to(AI_ROOT).as_posix()}")
    print(f"\nDataset assessment:\n{assessment}")


if __name__ == "__main__":
    dataset_analysis = analyze_dataset(RAW_DATASET)
    processed_records, preparation_metrics = prepare_records(dataset_analysis["records"])
    write_processed_csv(processed_records)
    write_ai2_archive(dataset_analysis["records"])
    write_service_mapping({record["fault_category"] for record in processed_records})
    write_final_audit(dataset_analysis, processed_records, preparation_metrics)
    print_summary(processed_records, preparation_metrics, dataset_analysis["suitable"])
