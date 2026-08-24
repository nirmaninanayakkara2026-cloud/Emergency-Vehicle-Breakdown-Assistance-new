"""Inspect the official headerless NHTSA consumer-complaints flat file safely."""

from __future__ import annotations

import csv
import re
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

AI_ROOT = Path(__file__).resolve().parents[1]
NHTSA_RAW_DIR = AI_ROOT / "dataset" / "raw" / "nhtsa"

# Official NHTSA Complaints File Characteristics, CMPL.txt (April 30, 2026).
# The source flat file is headerless and tab-delimited.
NHTSA_COLUMNS = [
    "CMPLID", "ODINO", "MFR_NAME", "MAKETXT", "MODELTXT", "YEARTXT", "CRASH",
    "FAILDATE", "FIRE", "INJURED", "DEATHS", "COMPDESC", "CITY", "STATE", "VIN",
    "DATEA", "LDATE", "MILES", "OCCURENCES", "CDESCR", "CMPL_TYPE", "POLICE_RPT_YN",
    "PURCH_DT", "ORIG_OWNER_YN", "ANTI_BRAKES_YN", "CRUISE_CONT_YN", "NUM_CYLS",
    "DRIVE_TRAIN", "FUEL_SYS", "FUEL_TYPE", "TRANS_TYPE", "VEH_SPEED", "DOT",
    "TIRE_SIZE", "LOC_OF_TIRE", "TIRE_FAIL_TYPE", "ORIG_EQUIP_YN", "MANUF_DT",
    "SEAT_TYPE", "RESTRAINT_TYPE", "DEALER_NAME", "DEALER_TEL", "DEALER_CITY",
    "DEALER_STATE", "DEALER_ZIP", "PROD_TYPE", "REPAIRED_YN", "MEDICAL_ATTN",
    "VEHICLES_TOWED_YN", "STATE_OF_INCIDENT", "VEHICLE_OPERATOR",
]

IMPORTANT_FIELDS = [
    "ODINO", "COMPDESC", "CDESCR", "MAKETXT", "MODELTXT", "YEARTXT", "CRASH", "FIRE", "MILES"
]
SAFE_SAMPLE_FIELDS = IMPORTANT_FIELDS


def privacy_safe_sample(row: dict[str, str]) -> dict[str, str]:
    sample = {field: row[field] for field in SAFE_SAMPLE_FIELDS}
    narrative = sample["CDESCR"]
    narrative = re.sub(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", "[REDACTED]", narrative, flags=re.IGNORECASE)
    narrative = re.sub(r"\b(?=[A-HJ-NPR-Z0-9]{17}\b)(?=[A-HJ-NPR-Z0-9]*\d)[A-HJ-NPR-Z0-9]+\b", "[REDACTED]", narrative, flags=re.IGNORECASE)
    narrative = re.sub(r"(?<!\d)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\d)", "[REDACTED]", narrative)
    sample["CDESCR"] = narrative[:500] + ("..." if len(narrative) > 500 else "")
    return sample


def find_nhtsa_file(raw_dir: Path = NHTSA_RAW_DIR) -> Path:
    candidates = [
        path for path in raw_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".txt", ".csv", ".tsv", ".lst"}
    ]
    if not candidates:
        raise SystemExit(f"No extracted NHTSA complaint data file found under: {raw_dir}")
    complaint_named = [path for path in candidates if "complaint" in path.name.lower()]
    return max(complaint_named or candidates, key=lambda path: path.stat().st_size)


def detect_encoding(path: Path) -> str:
    with path.open("rb") as source:
        sample = source.read(1_000_000)
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            sample.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue
    return "latin-1"


def detect_delimiter(path: Path, encoding: str) -> str:
    with path.open("r", encoding=encoding, errors="replace", newline="") as source:
        sample = source.read(32_768)
    try:
        return csv.Sniffer().sniff(sample, delimiters="\t,|;").delimiter
    except csv.Error:
        return "\t"


def iter_rows(path: Path, encoding: str, delimiter: str) -> Iterator[tuple[dict[str, str], int]]:
    csv.field_size_limit(10_000_000)
    with path.open("r", encoding=encoding, errors="replace", newline="") as source:
        reader = csv.reader(source, delimiter=delimiter)
        first = True
        for values in reader:
            if first and values and values[0].strip().upper() in {"CMPLID", "ODINO"}:
                first = False
                continue
            first = False
            original_width = len(values)
            if len(values) < len(NHTSA_COLUMNS):
                values.extend([""] * (len(NHTSA_COLUMNS) - len(values)))
            row = {
                column: (values[index].strip() if index < len(values) else "")
                for index, column in enumerate(NHTSA_COLUMNS)
            }
            yield row, original_width


def analyze_nhtsa(path: Path | None = None) -> dict[str, Any]:
    source_path = path or find_nhtsa_file()
    encoding = detect_encoding(source_path)
    delimiter = detect_delimiter(source_path, encoding)
    row_count = 0
    width_counts: Counter[int] = Counter()
    missing = Counter()
    components: Counter[str] = Counter()
    samples: list[dict[str, str]] = []

    for row, width in iter_rows(source_path, encoding, delimiter):
        row_count += 1
        width_counts[width] += 1
        for field in IMPORTANT_FIELDS:
            if not row[field]:
                missing[field] += 1
        if row["COMPDESC"]:
            components[row["COMPDESC"]] += 1
        if len(samples) < 3:
            # Privacy-safe examples intentionally exclude VIN, geography, and identity fields.
            samples.append(privacy_safe_sample(row))

    return {
        "path": source_path,
        "encoding": encoding,
        "delimiter": delimiter,
        "row_count": row_count,
        "column_count": len(NHTSA_COLUMNS),
        "columns": NHTSA_COLUMNS,
        "width_counts": width_counts,
        "missing": missing,
        "components": components,
        "samples": samples,
    }


def delimiter_name(delimiter: str) -> str:
    return {"\t": "TAB", ",": "COMMA", "|": "PIPE", ";": "SEMICOLON"}.get(delimiter, repr(delimiter))


def print_analysis(analysis: dict[str, Any]) -> None:
    print(f"Filename: {analysis['path'].name}")
    print(f"Delimiter: {delimiter_name(analysis['delimiter'])}")
    print(f"Encoding: {analysis['encoding']}")
    print(f"Rows: {analysis['row_count']}")
    print(f"Columns: {analysis['column_count']}")
    print("Column names: " + ", ".join(analysis["columns"]))
    print("Observed row widths: " + ", ".join(f"{width}={count}" for width, count in analysis["width_counts"].items()))
    print("\nImportant field roles:")
    print("  CDESCR: model input candidate (consumer complaint narrative)")
    print("  COMPDESC: target mapping candidate; never added to model input")
    print("  ODINO: source grouping ID for future group-aware splits")
    print("\nPrivacy-safe sample records:")
    for index, sample in enumerate(analysis["samples"], start=1):
        print(f"  {index}. {sample}")
    print("\nMissing values:")
    for field in IMPORTANT_FIELDS:
        count = analysis["missing"][field]
        print(f"  {field}: {count} ({count / analysis['row_count']:.1%})")
    print(f"\nUnique component descriptions: {len(analysis['components'])}")
    print("Component distribution:")
    for component, count in analysis["components"].most_common():
        print(f"  {component}: {count} ({count / analysis['row_count']:.1%})")


if __name__ == "__main__":
    print_analysis(analyze_nhtsa())
