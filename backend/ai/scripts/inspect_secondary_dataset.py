"""Inspect the secondary diagnostic CSV without assuming its column names."""

from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path
from typing import Any

AI_ROOT = Path(__file__).resolve().parents[1]
SECONDARY_DATASET = AI_ROOT / "dataset" / "raw" / "car_diagnostic_cases.csv"

FIELD_KEYWORDS = {
    "problem description": ("problem description", "description", "complaint", "problem"),
    "symptoms": ("symptom", "observation", "sign"),
    "problem classification": ("problem classification", "classification", "category", "class"),
    "diagnosis": ("diagnosis", "diagnostic result", "fault"),
    "severity": ("severity", "urgency", "priority"),
    "repair procedure": ("how to fix", "repair procedure", "procedure", "solution used", "repair"),
}


def _normalized_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def load_csv(path: Path = SECONDARY_DATASET) -> tuple[list[str], list[dict[str, str]]]:
    try:
        with path.open("r", encoding="utf-8-sig", newline="") as source:
            sample = source.read(8192)
            source.seek(0)
            try:
                dialect = csv.Sniffer().sniff(sample)
            except csv.Error:
                dialect = csv.excel
            reader = csv.DictReader(source, dialect=dialect)
            if not reader.fieldnames:
                raise SystemExit(f"CSV has no header row: {path}")
            columns = [column.strip() for column in reader.fieldnames]
            rows = []
            for source_row in reader:
                rows.append({(key or "").strip(): (value or "").strip() for key, value in source_row.items()})
            return columns, rows
    except FileNotFoundError as exc:
        raise SystemExit(f"Secondary dataset not found: {path}") from exc
    except UnicodeDecodeError as exc:
        raise SystemExit(f"Secondary dataset is not valid UTF-8: {path}") from exc


def detect_candidate_fields(columns: list[str]) -> dict[str, list[str]]:
    candidates: dict[str, list[str]] = {}
    for role, keywords in FIELD_KEYWORDS.items():
        matches = []
        for column in columns:
            normalized = _normalized_name(column)
            if any(keyword == normalized or keyword in normalized for keyword in keywords):
                matches.append(column)
        candidates[role] = sorted(
            matches,
            key=lambda column: (
                next(
                    (index for index, keyword in enumerate(keywords) if keyword in _normalized_name(column)),
                    len(keywords),
                ),
                len(column),
            ),
        )
    return candidates


def choose_candidate(candidates: dict[str, list[str]], role: str) -> str | None:
    values = candidates.get(role, [])
    return values[0] if values else None


def normalized_row(row: dict[str, str], columns: list[str]) -> tuple[str, ...]:
    return tuple(re.sub(r"\s+", " ", row.get(column, "")).strip().lower() for column in columns)


def analyze_secondary(path: Path = SECONDARY_DATASET) -> dict[str, Any]:
    columns, rows = load_csv(path)
    candidates = detect_candidate_fields(columns)
    classification_field = choose_candidate(candidates, "problem classification")
    missing = {
        column: sum(1 for row in rows if not row.get(column, "").strip())
        for column in columns
    }
    class_counts = Counter(
        row.get(classification_field, "").strip()
        for row in rows
        if classification_field and row.get(classification_field, "").strip()
    )
    canonical = [normalized_row(row, columns) for row in rows]
    description_field = choose_candidate(candidates, "problem description") or choose_candidate(candidates, "symptoms")
    descriptions = [
        re.sub(r"\s+", " ", row.get(description_field, "")).strip().lower()
        for row in rows
    ] if description_field else []
    description_class_pairs = [
        (description, row.get(classification_field, "").strip().lower())
        for description, row in zip(descriptions, rows)
    ] if classification_field else []
    return {
        "path": path,
        "columns": columns,
        "rows": rows,
        "candidates": candidates,
        "classification_field": classification_field,
        "missing": missing,
        "class_counts": class_counts,
        "exact_duplicates": len(canonical) - len(set(canonical)),
        "duplicate_descriptions": len(descriptions) - len(set(descriptions)),
        "duplicate_description_class_pairs": (
            len(description_class_pairs) - len(set(description_class_pairs))
        ),
    }


def print_analysis(analysis: dict[str, Any]) -> None:
    rows = analysis["rows"]
    print(f"Rows: {len(rows)}")
    print(f"Columns: {len(analysis['columns'])}")
    print("Column names: " + ", ".join(analysis["columns"]))
    print("\nExample records:")
    for index, row in enumerate(rows[:3], start=1):
        print(f"  {index}. {row}")
    print("\nCandidate fields:")
    for role, fields in analysis["candidates"].items():
        print(f"  {role}: {', '.join(fields) if fields else 'not detected'}")
    print("\nMissing values:")
    for column, count in analysis["missing"].items():
        print(f"  {column}: {count} ({count / len(rows):.1%})" if rows else f"  {column}: {count}")
    print("\nUnique problem classifications:")
    for category, count in analysis["class_counts"].most_common():
        print(f"  {category}: {count} ({count / len(rows):.1%})")
    print(f"\nExact duplicate full records: {analysis['exact_duplicates']}")
    print(f"Duplicate normalized problem descriptions: {analysis['duplicate_descriptions']}")
    print(
        "Duplicate normalized problem-description + classification pairs: "
        f"{analysis['duplicate_description_class_pairs']}"
    )


if __name__ == "__main__":
    print_analysis(analyze_secondary())
