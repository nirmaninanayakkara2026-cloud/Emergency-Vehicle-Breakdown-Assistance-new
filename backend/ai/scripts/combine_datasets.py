"""Combine primary and secondary AI 1 data with provenance-aware deduplication."""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from inspect_secondary_dataset import SECONDARY_DATASET, analyze_secondary
from prepare_secondary_dataset import load_mapping, prepare_secondary_records

AI_ROOT = Path(__file__).resolve().parents[1]
PRIMARY_DATASET = AI_ROOT / "dataset" / "processed" / "ai1_fault_dataset.csv"
SECONDARY_PROCESSED = AI_ROOT / "dataset" / "processed" / "ai1_secondary_fault_dataset.csv"
COMBINED_DATASET = AI_ROOT / "dataset" / "processed" / "ai1_combined_fault_dataset.csv"
ROADSIDE_DATASET = AI_ROOT / "dataset" / "processed" / "ai1_roadside_training_dataset.csv"
TAXONOMY_PATH = AI_ROOT / "config" / "fault_taxonomy.json"
AUDIT_REPORT = AI_ROOT / "reports" / "combined_dataset_audit.txt"

COLUMNS = [
    "record_id",
    "symptom_text",
    "fault_category",
    "original_fault_name",
    "diagnosis",
    "diagnostic_procedure",
    "data_source",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            return [{key: (value or "").strip() for key, value in row.items()} for row in csv.DictReader(source)]
    except FileNotFoundError as exc:
        raise SystemExit(f"Required processed dataset not found: {path}") from exc


def normalize_symptom_text(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"[^a-z0-9\s'-]", " ", text)
    return re.sub(r"\s+", " ", text).strip(" .,-")


def primary_to_common(record: dict[str, str]) -> dict[str, str]:
    fault_name = record.get("original_fault_name", "")
    return {
        "record_id": record.get("record_id", ""),
        "symptom_text": normalize_symptom_text(record.get("symptom_text", "")),
        "fault_category": record.get("fault_category", ""),
        "original_fault_name": fault_name,
        "diagnosis": fault_name,
        "diagnostic_procedure": record.get("diagnostic_procedure", ""),
        "data_source": "primary_automotive_fault_dataset",
    }


def deduplicate(
    primary: list[dict[str, str]], secondary: list[dict[str, str]]
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    retained: list[dict[str, str]] = []
    global_pairs: dict[tuple[str, str], str] = {}
    metrics: dict[str, Any] = {
        "dataset1_duplicates_removed": 0,
        "dataset2_duplicates_removed": 0,
        "cross_dataset_duplicates_removed": 0,
        "dataset1_exact_symptom_repetitions": 0,
        "dataset2_exact_symptom_repetitions": 0,
        "cross_dataset_exact_symptom_overlaps": 0,
    }

    primary_texts = Counter(normalize_symptom_text(row["symptom_text"]) for row in primary)
    secondary_texts = Counter(normalize_symptom_text(row["symptom_text"]) for row in secondary)
    metrics["dataset1_exact_symptom_repetitions"] = sum(count - 1 for count in primary_texts.values() if count > 1)
    metrics["dataset2_exact_symptom_repetitions"] = sum(count - 1 for count in secondary_texts.values() if count > 1)
    metrics["cross_dataset_exact_symptom_overlaps"] = len(set(primary_texts) & set(secondary_texts))
    secondary_variants: dict[tuple[str, str], dict[str, set[str]]] = defaultdict(
        lambda: {"diagnoses": set(), "procedures": set()}
    )
    for row in secondary:
        pair = (normalize_symptom_text(row.get("symptom_text", "")), row.get("fault_category", ""))
        if row.get("diagnosis", ""):
            secondary_variants[pair]["diagnoses"].add(row["diagnosis"])
        if row.get("diagnostic_procedure", ""):
            secondary_variants[pair]["procedures"].add(row["diagnostic_procedure"])
    metrics["secondary_pairs_with_multiple_diagnoses"] = sum(
        len(values["diagnoses"]) > 1 for values in secondary_variants.values()
    )
    metrics["secondary_pairs_with_multiple_procedures"] = sum(
        len(values["procedures"]) > 1 for values in secondary_variants.values()
    )

    for source_name, rows in (("dataset1", primary), ("dataset2", secondary)):
        local_pairs: set[tuple[str, str]] = set()
        for row in rows:
            normalized = normalize_symptom_text(row.get("symptom_text", ""))
            category = row.get("fault_category", "")
            if not normalized or not category:
                continue
            pair = (normalized, category)
            if pair in local_pairs:
                metrics[f"{source_name}_duplicates_removed"] += 1
                continue
            local_pairs.add(pair)
            if pair in global_pairs and global_pairs[pair] != source_name:
                metrics["cross_dataset_duplicates_removed"] += 1
                continue
            global_pairs[pair] = source_name
            retained.append({column: row.get(column, "") for column in COLUMNS})

    classes_by_text: dict[str, set[str]] = defaultdict(set)
    for row in retained:
        classes_by_text[row["symptom_text"]].add(row["fault_category"])
    metrics["conflicting_symptom_texts_retained"] = {
        text: sorted(classes) for text, classes in classes_by_text.items() if len(classes) > 1
    }
    return retained, metrics


def write_csv(path: Path, records: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(records)


def data_label(count: int) -> str:
    if count < 20:
        return "VERY LOW DATA"
    if count < 50:
        return "LOW DATA"
    if count < 100:
        return "ACCEPTABLE FOR SIMPLE BASELINE"
    return "GOOD FOR BASELINE"


def render_distribution(counts: Counter[str], total: int) -> str:
    return "\n".join(
        f"  - {category}: {count} ({count / total:.1%}) [{data_label(count)}]"
        for category, count in counts.most_common()
    )


def write_audit(
    primary_count: int,
    secondary_metrics: dict[str, Any],
    combined: list[dict[str, str]],
    roadside: list[dict[str, str]],
    duplicate_metrics: dict[str, Any],
    roadside_classes: set[str],
) -> tuple[str, list[str]]:
    combined_counts = Counter(row["fault_category"] for row in combined)
    roadside_counts = Counter(row["fault_category"] for row in roadside)
    excluded = len(combined) - len(roadside)
    recommended = sorted(category for category, count in roadside_counts.items() if count >= 50)
    suitable = len(recommended) >= 2 and len(roadside) >= 200
    assessment = "SUITABLE_FOR_BASELINE_MODEL" if suitable else "INSUFFICIENT_DATA_FOR_RELIABLE_MODEL"
    conflicting = duplicate_metrics["conflicting_symptom_texts_retained"]

    report = f"""AI MODULE 1 COMBINED DATASET AUDIT
==================================
Dataset 1 usable records: {primary_count}
Dataset 2 original records: {secondary_metrics['original_records']}
Dataset 2 usable records before deduplication: {secondary_metrics['usable_records']}
Dataset 2 unique rows retained in combination: {sum(1 for row in combined if row['data_source'] == 'secondary_diagnostic_dataset')}
Combined records: {len(combined)}
Roadside-training records: {len(roadside)}
Number of roadside fault classes: {len(roadside_counts)}
Unmapped Dataset 2 records: {secondary_metrics['unmapped_records']}
Excluded non-roadside records: {excluded}

Duplicate audit:
  - Dataset 1 exact symptom repetitions: {duplicate_metrics['dataset1_exact_symptom_repetitions']}
  - Dataset 1 symptom + fault duplicates removed: {duplicate_metrics['dataset1_duplicates_removed']}
  - Dataset 2 exact symptom repetitions: {duplicate_metrics['dataset2_exact_symptom_repetitions']}
  - Dataset 2 symptom + fault duplicates removed: {duplicate_metrics['dataset2_duplicates_removed']}
  - Cross-dataset exact symptom overlaps: {duplicate_metrics['cross_dataset_exact_symptom_overlaps']}
  - Cross-dataset symptom + fault duplicates removed: {duplicate_metrics['cross_dataset_duplicates_removed']}
  - Conflicting identical symptom texts retained with different targets: {len(conflicting)}
  - Secondary unique pairs with multiple diagnosis values: {duplicate_metrics['secondary_pairs_with_multiple_diagnoses']}
  - Secondary unique pairs with multiple repair procedures: {duplicate_metrics['secondary_pairs_with_multiple_procedures']}

Combined class distribution:
{render_distribution(combined_counts, len(combined))}

Roadside class distribution:
{render_distribution(roadside_counts, len(roadside))}

Roadside taxonomy classes:
{', '.join(sorted(roadside_classes))}

Excluded non-roadside/low-priority classes:
{', '.join(sorted(set(combined_counts) - roadside_classes))}

Target leakage controls:
The secondary symptom_text uses only Problem Description. Diagnosis, repair procedure, severity, repair status, results, cost-like fields, and vehicle brand are not added to model input. Diagnosis and repair procedure remain archive/provenance columns only.

Data quality assessment:
Although Dataset 2 has 10,000 complete source rows, it contains only 22 distinct symptom + mapped-fault pairs. Deduplication therefore removes 9,978 repeated training pairs. All 22 pairs are associated with multiple diagnosis and repair-procedure values, so those fields must not be treated as unique ground truth for the symptom phrase. The combined file retains one traceable source example while the full secondary processed file preserves every variant. No roadside class reaches the project-level 50-record threshold for an acceptable simple baseline. The real combined data remains insufficient for a reliable multi-class classifier.

Recommended model classes: {json.dumps(recommended)}
Exploratory classes with at least 20 real rows: {json.dumps(sorted(category for category, count in roadside_counts.items() if count >= 20))}

Dataset assessment:
{assessment}
"""
    AUDIT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_REPORT.write_text(report, encoding="utf-8")
    return assessment, recommended


def print_summary(
    primary_count: int,
    secondary_usable: int,
    combined: list[dict[str, str]],
    roadside: list[dict[str, str]],
    assessment: str,
) -> None:
    counts = Counter(row["fault_category"] for row in roadside)
    print("AI 1 COMBINED DATASET PREPARATION COMPLETE")
    print(f"\nDataset 1 usable: {primary_count}")
    print(f"\nDataset 2 usable: {secondary_usable}")
    print(f"\nCombined usable: {len(combined)}")
    print(f"\nRoadside training records: {len(roadside)}")
    print(f"\nRoadside fault classes: {len(counts)}")
    print("\nClass distribution:")
    for category, count in counts.most_common():
        print(f"{category}: {count} ({count / len(roadside):.1%}) [{data_label(count)}]")
    print(f"\nDataset assessment:\n{assessment}")


if __name__ == "__main__":
    primary_rows = [primary_to_common(row) for row in read_csv(PRIMARY_DATASET)]
    secondary_rows = read_csv(SECONDARY_PROCESSED)
    secondary_analysis = analyze_secondary(SECONDARY_DATASET)
    expected_secondary, secondary_metrics = prepare_secondary_records(secondary_analysis, load_mapping())
    if len(expected_secondary) != len(secondary_rows):
        raise ValueError("Processed secondary dataset is stale; run prepare_secondary_dataset.py again")

    taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    roadside_classes = set(taxonomy["ROADSIDE_MODEL_CLASSES"])
    combined_rows, duplicate_metrics = deduplicate(primary_rows, secondary_rows)
    known_classes = roadside_classes | set(taxonomy["NON_ROADSIDE_OR_LOW_PRIORITY"])
    unknown_classes = {row["fault_category"] for row in combined_rows} - known_classes
    if unknown_classes:
        raise ValueError(f"Combined records contain classes missing from fault_taxonomy.json: {sorted(unknown_classes)}")
    roadside_rows = [row for row in combined_rows if row["fault_category"] in roadside_classes]
    write_csv(COMBINED_DATASET, combined_rows)
    write_csv(ROADSIDE_DATASET, roadside_rows)
    assessment, _ = write_audit(
        len(primary_rows),
        secondary_metrics,
        combined_rows,
        roadside_rows,
        duplicate_metrics,
        roadside_classes,
    )
    print_summary(
        len(primary_rows),
        secondary_metrics["usable_records"],
        combined_rows,
        roadside_rows,
        assessment,
    )
