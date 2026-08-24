"""Prepare privacy-minimized, conservatively labeled NHTSA complaints for AI 1."""

from __future__ import annotations

import csv
import hashlib
import json
import random
import re
import sqlite3
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from inspect_nhtsa_dataset import AI_ROOT, detect_delimiter, detect_encoding, find_nhtsa_file, iter_rows

MAPPING_PATH = AI_ROOT / "config" / "nhtsa_component_mapping.json"
FULL_OUTPUT = AI_ROOT / "dataset" / "processed" / "ai1_nhtsa_fault_dataset.csv"
SAMPLE_OUTPUT = AI_ROOT / "dataset" / "processed" / "ai1_nhtsa_training_sample.csv"
DISTRIBUTION_REPORT = AI_ROOT / "reports" / "nhtsa_class_distribution.txt"
DATA_SOURCE = "nhtsa_consumer_complaints"
MAX_PER_CLASS = 2_000
RANDOM_STATE = 42

OUTPUT_COLUMNS = [
    "record_id",
    "source_group_id",
    "symptom_text",
    "fault_category",
    "original_component",
    "vehicle_make",
    "vehicle_model",
    "vehicle_year",
    "data_source",
]

EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
VIN_PATTERN = re.compile(r"\b(?=[A-HJ-NPR-Z0-9]{17}\b)(?=[A-HJ-NPR-Z0-9]*\d)[A-HJ-NPR-Z0-9]+\b", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?<!\d)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\d)")


def load_mapping(path: Path = MAPPING_PATH) -> dict[str, Any]:
    content = json.loads(path.read_text(encoding="utf-8"))
    rules = content.get("rules")
    if not isinstance(rules, list):
        raise ValueError("nhtsa_component_mapping.json must contain an ordered rules array")
    return content


def map_component(component: str, mapping: dict[str, Any]) -> str | None:
    normalized = re.sub(r"\s+", " ", component).strip().upper()
    for rule in mapping["rules"]:
        values = [str(value).upper() for value in rule.get("values", [])]
        match_type = rule.get("match_type")
        matched = (
            normalized in values
            if match_type == "exact"
            else any(normalized.startswith(value) for value in values)
            if match_type == "prefix"
            else False
        )
        if matched:
            category = rule.get("fault_category")
            return None if category == "unmapped" else str(category)
    return None


def clean_narrative(value: str) -> tuple[str, int]:
    """Minimize obvious PII while preserving complaint wording and automotive terms."""
    text = value.replace("\x00", " ")
    redactions = 0
    # Repeat after whitespace normalization because removing one identifier can
    # expose a phone-shaped sequence that was not contiguous in the source.
    for _ in range(2):
        for pattern in (EMAIL_PATTERN, VIN_PATTERN, PHONE_PATTERN):
            text, count = pattern.subn(" ", text)
            redactions += count
        text = re.sub(r"\s+", " ", text).strip()
    text = text.lower()
    return text, redactions


def narrative_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def initialize_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA journal_mode=OFF;
        PRAGMA synchronous=OFF;
        PRAGMA temp_store=FILE;
        CREATE TABLE narratives (
          narrative_hash TEXT PRIMARY KEY,
          narrative TEXT NOT NULL,
          odino TEXT NOT NULL,
          vehicle_make TEXT,
          vehicle_model TEXT,
          vehicle_year TEXT
        );
        CREATE TABLE labels (
          narrative_hash TEXT NOT NULL,
          fault_category TEXT NOT NULL,
          component TEXT NOT NULL,
          PRIMARY KEY (narrative_hash, fault_category, component)
        );
        CREATE INDEX labels_hash_idx ON labels(narrative_hash);
        """
    )


def ingest_source(connection: sqlite3.Connection, source_path: Path, mapping: dict[str, Any]) -> dict[str, Any]:
    encoding = detect_encoding(source_path)
    delimiter = detect_delimiter(source_path, encoding)
    metrics: dict[str, Any] = {
        "filename": source_path.name,
        "encoding": encoding,
        "delimiter": delimiter,
        "raw_records": 0,
        "mapped_component_rows": 0,
        "blank_mapped_narratives": 0,
        "pii_patterns_removed": 0,
        "mapped_components": Counter(),
        "unmapped_components": Counter(),
        "mapped_rows_by_class": Counter(),
    }

    for row, _ in iter_rows(source_path, encoding, delimiter):
        metrics["raw_records"] += 1
        component = row["COMPDESC"]
        category = map_component(component, mapping) if component else None
        if not category:
            metrics["unmapped_components"][component or "<blank>"] += 1
            continue

        metrics["mapped_component_rows"] += 1
        metrics["mapped_components"][(component, category)] += 1
        metrics["mapped_rows_by_class"][category] += 1
        narrative, redactions = clean_narrative(row["CDESCR"])
        metrics["pii_patterns_removed"] += redactions
        if not narrative:
            metrics["blank_mapped_narratives"] += 1
            continue

        digest = narrative_hash(narrative)
        connection.execute(
            "INSERT OR IGNORE INTO narratives VALUES (?, ?, ?, ?, ?, ?)",
            (digest, narrative, row["ODINO"], row["MAKETXT"], row["MODELTXT"], row["YEARTXT"]),
        )
        connection.execute(
            "INSERT OR IGNORE INTO labels VALUES (?, ?, ?)",
            (digest, category, component),
        )
        if metrics["raw_records"] % 25_000 == 0:
            connection.commit()
    connection.commit()
    return metrics


def _unambiguous_query() -> str:
    return """
        SELECT n.narrative_hash, n.narrative, n.odino, n.vehicle_make, n.vehicle_model,
               n.vehicle_year, MIN(l.fault_category) AS fault_category,
               MIN(l.component) AS component
        FROM narratives n
        JOIN labels l ON l.narrative_hash = n.narrative_hash
        GROUP BY n.narrative_hash
        HAVING COUNT(DISTINCT l.fault_category) = 1
        ORDER BY fault_category, n.narrative_hash
    """


def database_quality_metrics(connection: sqlite3.Connection, metrics: dict[str, Any]) -> None:
    metrics["unique_mapped_narratives"] = connection.execute("SELECT COUNT(*) FROM narratives").fetchone()[0]
    metrics["ambiguous_narratives"] = connection.execute(
        "SELECT COUNT(*) FROM (SELECT narrative_hash FROM labels GROUP BY narrative_hash HAVING COUNT(DISTINCT fault_category) > 1)"
    ).fetchone()[0]
    metrics["ambiguous_source_rows"] = connection.execute(
        """
        SELECT COUNT(*) FROM labels
        WHERE narrative_hash IN (
          SELECT narrative_hash FROM labels GROUP BY narrative_hash HAVING COUNT(DISTINCT fault_category) > 1
        )
        """
    ).fetchone()[0]
    metrics["duplicate_narrative_rows"] = (
        metrics["mapped_component_rows"]
        - metrics["blank_mapped_narratives"]
        - metrics["unique_mapped_narratives"]
    )


def record_from_query(row: tuple[Any, ...]) -> dict[str, str]:
    digest, narrative, odino, make, model, year, category, component = row
    return {
        "record_id": f"nhtsa_{odino}_{digest[:12]}",
        "source_group_id": odino,
        "symptom_text": narrative,
        "fault_category": category,
        "original_component": component or "",
        "vehicle_make": make or "",
        "vehicle_model": model or "",
        "vehicle_year": year or "",
        "data_source": DATA_SOURCE,
    }


def write_full_and_sample(connection: sqlite3.Connection, metrics: dict[str, Any]) -> None:
    FULL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    class_counts: Counter[str] = Counter()
    reservoirs: dict[str, list[dict[str, str]]] = defaultdict(list)
    randomizers: dict[str, random.Random] = {}

    with FULL_OUTPUT.open("w", encoding="utf-8", newline="") as full_file:
        writer = csv.DictWriter(full_file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        for query_row in connection.execute(_unambiguous_query()):
            record = record_from_query(query_row)
            writer.writerow(record)
            category = record["fault_category"]
            class_counts[category] += 1
            seen = class_counts[category]
            reservoir = reservoirs[category]
            if len(reservoir) < MAX_PER_CLASS:
                reservoir.append(record)
            else:
                rng = randomizers.setdefault(category, random.Random(f"{RANDOM_STATE}:{category}"))
                replacement_index = rng.randrange(seen)
                if replacement_index < MAX_PER_CLASS:
                    reservoir[replacement_index] = record

    sample = [record for category in sorted(reservoirs) for record in sorted(reservoirs[category], key=lambda item: item["record_id"])]
    with SAMPLE_OUTPUT.open("w", encoding="utf-8", newline="") as sample_file:
        writer = csv.DictWriter(sample_file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(sample)

    metrics["available_by_class"] = class_counts
    metrics["unambiguous_available"] = sum(class_counts.values())
    metrics["sample_by_class"] = Counter(record["fault_category"] for record in sample)
    metrics["training_sample_records"] = len(sample)


def write_distribution_report(metrics: dict[str, Any], mapping: dict[str, Any]) -> None:
    available = metrics["available_by_class"]
    mapped_lines = [
        f"  - {component} -> {category}: {count}"
        for (component, category), count in sorted(metrics["mapped_components"].items())
    ]
    unmapped_lines = [
        f"  - {component}: {count}"
        for component, count in metrics["unmapped_components"].most_common()
    ]
    rule_lines = [
        f"  - {', '.join(rule['values'])} -> {rule['fault_category']}: {rule['reason']}"
        for rule in mapping["rules"]
    ]
    report = f"""NHTSA AI 1 CLASS DISTRIBUTION AND MAPPING AUDIT
================================================
Source filename: {metrics['filename']}
Delimiter: TAB
Encoding: {metrics['encoding']}
Raw component rows: {metrics['raw_records']}
Mapped roadside component rows: {metrics['mapped_component_rows']}
Mapped rows with blank narratives: {metrics['blank_mapped_narratives']}
Unique mapped narratives before ambiguity filtering: {metrics['unique_mapped_narratives']}
Duplicate mapped narrative rows: {metrics['duplicate_narrative_rows']}
Ambiguous multi-class narratives excluded: {metrics['ambiguous_narratives']}
Mapped label/component associations belonging to ambiguous narratives: {metrics['ambiguous_source_rows']}
Available unambiguous unique records: {metrics['unambiguous_available']}
Controlled training sample records: {metrics['training_sample_records']}
Obvious email/phone/VIN patterns removed from narratives: {metrics['pii_patterns_removed']}

Available unique examples per target class before sampling:
{chr(10).join(f'  - {category}: {count}' for category, count in available.most_common())}

Controlled sample distribution (maximum {MAX_PER_CLASS} per class, random_state={RANDOM_STATE}):
{chr(10).join(f'  - {category}: {count}' for category, count in metrics['sample_by_class'].most_common())}

Mapping rules and rationale:
{chr(10).join(rule_lines)}

Actual mapped component descriptions and source-row counts:
{chr(10).join(mapped_lines)}

Unmapped component descriptions and source-row counts:
{chr(10).join(unmapped_lines)}

Privacy and leakage controls:
CDESCR alone supplies symptom_text. COMPDESC is used only for target mapping and original_component provenance.
VIN, city, state, incident state, consumer/operator identity, dealer identity/contact, and geographic fields are never written.
Obvious VIN, email, and telephone patterns embedded in narratives are removed conservatively.
"""
    DISTRIBUTION_REPORT.parent.mkdir(parents=True, exist_ok=True)
    DISTRIBUTION_REPORT.write_text(report, encoding="utf-8")


def prepare_nhtsa() -> dict[str, Any]:
    source_path = find_nhtsa_file()
    mapping = load_mapping()
    temporary = tempfile.NamedTemporaryFile(prefix="ai1_nhtsa_", suffix=".sqlite3", delete=False)
    temporary_path = Path(temporary.name)
    temporary.close()
    try:
        connection = sqlite3.connect(temporary_path)
        try:
            initialize_database(connection)
            metrics = ingest_source(connection, source_path, mapping)
            database_quality_metrics(connection, metrics)
            write_full_and_sample(connection, metrics)
        finally:
            connection.close()
        write_distribution_report(metrics, mapping)
        return metrics
    finally:
        temporary_path.unlink(missing_ok=True)


def print_summary(metrics: dict[str, Any]) -> None:
    print("NHTSA DATASET PREPARATION COMPLETE")
    print(f"Raw records: {metrics['raw_records']}")
    print(f"Mapped roadside component rows: {metrics['mapped_component_rows']}")
    print(f"Ambiguous complaints excluded: {metrics['ambiguous_narratives']}")
    print(f"Duplicate narrative rows removed: {metrics['duplicate_narrative_rows']}")
    print(f"Available unambiguous unique records: {metrics['unambiguous_available']}")
    print(f"Controlled training sample: {metrics['training_sample_records']}")
    print("Sample class distribution:")
    for category, count in metrics["sample_by_class"].most_common():
        print(f"  {category}: {count}")


if __name__ == "__main__":
    print_summary(prepare_nhtsa())
