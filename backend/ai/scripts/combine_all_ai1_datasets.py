"""Combine the three real AI 1 sources with group IDs and conservative deduplication."""

from __future__ import annotations

import csv
import json
import re
import statistics
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

AI_ROOT = Path(__file__).resolve().parents[1]
EXISTING_ROADSIDE = AI_ROOT / "dataset" / "processed" / "ai1_roadside_training_dataset.csv"
NHTSA_SAMPLE = AI_ROOT / "dataset" / "processed" / "ai1_nhtsa_training_sample.csv"
FINAL_OUTPUT = AI_ROOT / "dataset" / "processed" / "ai1_final_training_dataset.csv"
FINAL_AUDIT = AI_ROOT / "reports" / "ai1_final_dataset_audit.txt"
NHTSA_REPORT = AI_ROOT / "reports" / "nhtsa_class_distribution.txt"
TAXONOMY_PATH = AI_ROOT / "config" / "fault_taxonomy.json"

FINAL_COLUMNS = ["record_id", "source_group_id", "symptom_text", "fault_category", "data_source"]
SOURCE_PRIORITY = {
    "primary_automotive_fault_dataset": 0,
    "secondary_diagnostic_dataset": 1,
    "nhtsa_consumer_complaints": 2,
}


def read_csv(path: Path) -> list[dict[str, str]]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            return [{key: (value or "").strip() for key, value in row.items()} for row in csv.DictReader(source)]
    except FileNotFoundError as exc:
        raise SystemExit(f"Required input not found: {path}") from exc


def normalize_for_duplicate(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"[^a-z0-9\s'-]", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")


def existing_record_to_final(record: dict[str, str]) -> dict[str, str]:
    record_id = record.get("record_id", "")
    return {
        "record_id": record_id,
        "source_group_id": record_id,
        "symptom_text": record.get("symptom_text", ""),
        "fault_category": record.get("fault_category", ""),
        "data_source": record.get("data_source", ""),
    }


def nhtsa_record_to_final(record: dict[str, str]) -> dict[str, str]:
    return {
        "record_id": record.get("record_id", ""),
        "source_group_id": record.get("source_group_id", ""),
        "symptom_text": record.get("symptom_text", ""),
        "fault_category": record.get("fault_category", ""),
        "data_source": record.get("data_source", ""),
    }


def deduplicate_all(records: list[dict[str, str]]) -> tuple[list[dict[str, str]], dict[str, Any]]:
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    invalid_records = 0
    for record in records:
        normalized = normalize_for_duplicate(record["symptom_text"])
        if not normalized or not record["fault_category"] or not record["record_id"]:
            invalid_records += 1
            continue
        grouped[normalized].append(record)

    retained = []
    duplicate_records_removed = 0
    cross_source_duplicates_removed = 0
    ambiguous_groups_excluded = 0
    ambiguous_records_excluded = 0
    for normalized, group in grouped.items():
        classes = {record["fault_category"] for record in group}
        if len(classes) > 1:
            ambiguous_groups_excluded += 1
            ambiguous_records_excluded += len(group)
            continue

        ordered = sorted(
            group,
            key=lambda record: (
                SOURCE_PRIORITY.get(record["data_source"], 99),
                record["record_id"],
            ),
        )
        retained.append(ordered[0])
        if len(ordered) > 1:
            duplicate_records_removed += len(ordered) - 1
            first_source = ordered[0]["data_source"]
            cross_source_duplicates_removed += sum(
                record["data_source"] != first_source for record in ordered[1:]
            )

    retained.sort(key=lambda record: (record["fault_category"], record["data_source"], record["record_id"]))
    return retained, {
        "invalid_records": invalid_records,
        "duplicate_records_removed": duplicate_records_removed,
        "cross_source_duplicates_removed": cross_source_duplicates_removed,
        "ambiguous_groups_excluded": ambiguous_groups_excluded,
        "ambiguous_records_excluded": ambiguous_records_excluded,
    }


def write_final(records: list[dict[str, str]]) -> None:
    FINAL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with FINAL_OUTPUT.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=FINAL_COLUMNS)
        writer.writeheader()
        writer.writerows(records)


def report_number(label: str) -> int:
    report = NHTSA_REPORT.read_text(encoding="utf-8")
    match = re.search(rf"^{re.escape(label)}:\s*([\d,]+)$", report, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"Could not find '{label}' in {NHTSA_REPORT}")
    return int(match.group(1).replace(",", ""))


def write_audit(
    input_source_counts: Counter[str],
    retained: list[dict[str, str]],
    metrics: dict[str, Any],
    roadside_classes: set[str],
) -> tuple[str, Counter[str], Counter[str]]:
    source_counts = Counter(record["data_source"] for record in retained)
    class_counts = Counter(record["fault_category"] for record in retained)
    counts = list(class_counts.values())
    minimum = min(counts, default=0)
    maximum = max(counts, default=0)
    median = statistics.median(counts) if counts else 0
    weak_classes = sorted(category for category in roadside_classes if class_counts[category] < 100)
    suitable = set(class_counts) == roadside_classes and not weak_classes
    assessment = "SUITABLE_FOR_BASELINE_MODEL" if suitable else "INSUFFICIENT_DATA_FOR_RELIABLE_MODEL"
    recommended = sorted(category for category in roadside_classes if class_counts[category] >= 100)
    smallest_class, smallest_count = min(class_counts.items(), key=lambda item: item[1]) if class_counts else ("none", 0)

    report = f"""AI MODULE 1 FINAL THREE-SOURCE DATASET AUDIT
============================================
Total records: {len(retained)}
Fault classes: {len(class_counts)}
Minimum examples in a class: {minimum}
Median examples per class: {median:g}
Maximum examples in a class: {maximum}
Smallest class: {smallest_class} - {smallest_count}

Input records by source before final deduplication:
{chr(10).join(f'  - {source}: {count}' for source, count in input_source_counts.items())}

Retained records by source:
{chr(10).join(f'  - {source}: {count}' for source, count in source_counts.items())}

Retention summary:
  - Primary retained: {source_counts['primary_automotive_fault_dataset']}
  - Secondary retained: {source_counts['secondary_diagnostic_dataset']}
  - NHTSA retained: {source_counts['nhtsa_consumer_complaints']}
  - Cross-source duplicates removed: {metrics['cross_source_duplicates_removed']}
  - Final records: {len(retained)}

Records by class:
{chr(10).join(f'  - {category}: {count} ({count / len(retained):.1%})' for category, count in class_counts.most_common())}

Final deduplication and conflict handling:
  - Invalid records excluded: {metrics['invalid_records']}
  - Exact/clearly identical duplicate records removed: {metrics['duplicate_records_removed']}
  - Cross-source duplicates removed: {metrics['cross_source_duplicates_removed']}
  - Conflicting normalized-text groups excluded: {metrics['ambiguous_groups_excluded']}
  - Records excluded from conflicting groups: {metrics['ambiguous_records_excluded']}

Group-aware split preparation:
NHTSA source_group_id is ODINO. Primary and secondary source_group_id use their original record IDs.
Future train/test splitting must group on source_group_id so one original complaint cannot cross split boundaries.

Privacy and target leakage:
The final dataset contains no VIN, city, state, contact, identity, make, model, year, component-label, or repair fields.
NHTSA symptom_text comes only from privacy-minimized CDESCR; COMPDESC is never prepended to model input.

Classes below 100 examples: {json.dumps(weak_classes)}
Recommended model classes: {json.dumps(recommended)}

Assessment rule:
SUITABLE only when all nine retained roadside classes have at least 100 unique real examples after deduplication and conflict exclusion.

Dataset assessment:
{assessment}
"""
    FINAL_AUDIT.parent.mkdir(parents=True, exist_ok=True)
    FINAL_AUDIT.write_text(report, encoding="utf-8")
    return assessment, source_counts, class_counts


def combine_all() -> dict[str, Any]:
    existing = [existing_record_to_final(record) for record in read_csv(EXISTING_ROADSIDE)]
    nhtsa = [nhtsa_record_to_final(record) for record in read_csv(NHTSA_SAMPLE)]
    all_records = existing + nhtsa

    taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    roadside_classes = set(taxonomy["ROADSIDE_MODEL_CLASSES"])
    unexpected = {record["fault_category"] for record in all_records} - roadside_classes
    if unexpected:
        raise ValueError(f"Final AI 1 inputs contain non-roadside classes: {sorted(unexpected)}")

    retained, metrics = deduplicate_all(all_records)
    write_final(retained)
    input_source_counts = Counter(record["data_source"] for record in all_records)
    assessment, source_counts, class_counts = write_audit(
        input_source_counts, retained, metrics, roadside_classes
    )
    return {
        "assessment": assessment,
        "source_counts": source_counts,
        "class_counts": class_counts,
        "final_records": len(retained),
        "fault_classes": len(class_counts),
        "metrics": metrics,
    }


def print_summary(results: dict[str, Any]) -> None:
    class_counts = results["class_counts"]
    smallest_class, smallest_count = min(class_counts.items(), key=lambda item: item[1])
    print("AI 1 NHTSA DATA PREPARATION COMPLETE")
    print(f"\nNHTSA raw records: {report_number('Raw component rows')}")
    print(f"\nMapped roadside records: {report_number('Mapped roadside component rows')}")
    print(f"\nAmbiguous complaints excluded: {report_number('Ambiguous multi-class narratives excluded')}")
    print(f"\nDuplicate narratives removed: {report_number('Duplicate mapped narrative rows')}")
    print(f"\nNHTSA training sample: {report_number('Controlled training sample records')}")
    print(f"\nFinal combined records: {results['final_records']}")
    print(f"\nFault classes: {results['fault_classes']}")
    print("\nClass distribution:")
    for category, count in class_counts.most_common():
        print(f"  {category}: {count}")
    print(f"\nSmallest class: {smallest_class} - {smallest_count}")
    print(f"\nDataset assessment:\n{results['assessment']}")


if __name__ == "__main__":
    print_summary(combine_all())
