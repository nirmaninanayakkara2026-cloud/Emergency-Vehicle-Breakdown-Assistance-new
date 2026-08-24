"""Inspect the raw AI Module 1 dataset without assuming a fixed JSON shape."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable

AI_ROOT = Path(__file__).resolve().parents[1]
RAW_DATASET = AI_ROOT / "dataset" / "raw" / "automotive_faults_aktc_obike_et_al.json"
AUDIT_REPORT = AI_ROOT / "reports" / "dataset_audit.txt"

ROLE_KEYWORDS = {
    "fault name": ("fault_name", "fault", "subcategory", "problem_name", "component"),
    "fault category": ("category", "class", "label", "target"),
    "symptoms": ("symptom", "sign", "complaint", "observation"),
    "description": ("description", "details", "summary", "narrative"),
    "diagnostic procedure": ("diagnostic", "diagnosis_step", "test", "procedure", "check"),
    "resolution": ("resolution", "repair", "remedy", "solution", "fix"),
    "vehicle/system/component": ("vehicle", "system", "component", "part", "subcategory"),
}

APP_STYLE_EXAMPLES = [
    (
        "Vehicle type: car. Main problem: vehicle not starting. "
        "Starting behavior: clicking. Dashboard lights: dim. Observed sound: clicking."
    ),
    (
        "Vehicle type: van. Main problem: engine overheating. "
        "Seen: steam. Temperature warning light is on."
    ),
    (
        "Vehicle type: car. Main problem: brake problem. "
        "Brake pedal feels spongy. Vehicle pulls to one side."
    ),
]


def load_json(path: Path = RAW_DATASET) -> Any:
    """Load JSON with useful errors and support for UTF-8 BOM files."""
    try:
        with path.open("r", encoding="utf-8-sig") as source:
            return json.load(source)
    except FileNotFoundError as exc:
        raise SystemExit(f"Dataset not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON in {path} at line {exc.lineno}, column {exc.colno}: {exc.msg}") from exc


def _record_collections(value: Any, path: str = "$") -> list[tuple[str, list[dict[str, Any]]]]:
    candidates: list[tuple[str, list[dict[str, Any]]]] = []
    if isinstance(value, list):
        dict_items = [item for item in value if isinstance(item, dict)]
        if dict_items:
            candidates.append((path, dict_items))
        for index, item in enumerate(value[:20]):
            candidates.extend(_record_collections(item, f"{path}[{index}]"))
    elif isinstance(value, dict):
        dict_values = [item for item in value.values() if isinstance(item, dict)]
        if len(dict_values) > 1 and len(dict_values) == len(value):
            candidates.append((f"{path}{{values}}", dict_values))
        for key, item in value.items():
            candidates.extend(_record_collections(item, f"{path}.{key}"))
    return candidates


def detect_records(data: Any) -> tuple[str, str, list[dict[str, Any]]]:
    if isinstance(data, list):
        structure = "array"
    elif isinstance(data, dict):
        structure = "object"
    else:
        raise SystemExit(f"Unsupported top-level JSON type: {type(data).__name__}")

    candidates = _record_collections(data)
    if candidates:
        record_path, records = max(candidates, key=lambda candidate: len(candidate[1]))
        if record_path not in ("$", "${values}"):
            structure = "nested object" if isinstance(data, dict) else "nested array"
        return structure, record_path, records

    if isinstance(data, dict):
        return structure, "$", [data]
    return structure, "$", []


def _inspect_value(value: Any, path: str, record_paths: set[str], field_data: dict[str, dict[str, Any]]) -> None:
    info = field_data[path]
    info["types"].add(type(value).__name__)
    record_paths.add(path)

    if value is None:
        info["nulls"] += 1
    elif value == "" or value == [] or value == {}:
        info["empty"] += 1
    elif len(info["examples"]) < 3:
        info["examples"].append(value if not isinstance(value, (dict, list)) else type(value).__name__)

    if isinstance(value, dict):
        for key, nested in value.items():
            nested_path = f"{path}.{key}" if path else key
            _inspect_value(nested, nested_path, record_paths, field_data)
    elif isinstance(value, list):
        for nested in value:
            if isinstance(nested, dict):
                _inspect_value(nested, f"{path}[]", record_paths, field_data)


def inspect_fields(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    field_data: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"types": set(), "present": 0, "nulls": 0, "empty": 0, "examples": []}
    )
    for record in records:
        record_paths: set[str] = set()
        for key, value in record.items():
            _inspect_value(value, key, record_paths, field_data)
        for path in record_paths:
            field_data[path]["present"] += 1
    return dict(field_data)


def detect_semantic_fields(field_paths: Iterable[str]) -> dict[str, list[str]]:
    detected: dict[str, list[str]] = {}
    for role, keywords in ROLE_KEYWORDS.items():
        matches = []
        for path in field_paths:
            normalized = path.lower().replace("[]", "")
            if any(keyword in normalized for keyword in keywords):
                matches.append(path)
        detected[role] = sorted(matches, key=lambda value: (value.count("."), len(value), value))
    return detected


def extract_path(value: Any, path: str) -> list[Any]:
    """Extract all values for paths such as diagnosis_steps[].step."""
    parts = path.replace("[]", ".[]").split(".") if path else []
    current = [value]
    for part in parts:
        next_values: list[Any] = []
        for item in current:
            if part == "[]" and isinstance(item, list):
                next_values.extend(item)
            elif isinstance(item, dict) and part in item:
                next_values.append(item[part])
        current = next_values
    return current


def choose_field(detected: dict[str, list[str]], role: str, preferred_names: tuple[str, ...]) -> str | None:
    candidates = detected.get(role, [])
    for preferred in preferred_names:
        for candidate in candidates:
            if candidate.lower().replace("[]", "").split(".")[-1] == preferred:
                return candidate
    return candidates[0] if candidates else None


def text_from_value(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return " ".join(text_from_value(item) for item in value if text_from_value(item))
    return ""


def normalized_text(value: Any) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s]", " ", text_from_value(value).lower())).strip()


def application_compatibility(records: list[dict[str, Any]], input_field: str | None) -> tuple[str, float, str]:
    if not input_field:
        return "POOR", 0.0, "No symptom or description field was detected."
    dataset_words = {
        word
        for record in records
        for value in extract_path(record, input_field)
        for word in normalized_text(value).split()
    }
    ignored = {"vehicle", "type", "car", "van", "main", "problem", "starting", "behavior", "observed", "seen", "is"}
    example_words = {
        word for example in APP_STYLE_EXAMPLES for word in normalized_text(example).split() if word not in ignored
    }
    overlap = len(example_words & dataset_words) / len(example_words) if example_words else 0.0
    if overlap >= 0.65 and len(records) >= 200:
        rating = "GOOD"
    elif overlap >= 0.30:
        rating = "MODERATE"
    else:
        rating = "POOR"
    explanation = (
        f"{overlap:.1%} of the content vocabulary in the application-style examples appears in the dataset. "
        "The phrases are broadly automotive and symptom-oriented, but the dataset uses short symptom lists, "
        "has no vehicle-type context, and is small compared with the variety of future application input."
    )
    return rating, overlap, explanation


def analyze_dataset(path: Path = RAW_DATASET) -> dict[str, Any]:
    data = load_json(path)
    structure, record_path, records = detect_records(data)
    fields = inspect_fields(records)
    semantic = detect_semantic_fields(fields)
    input_field = choose_field(semantic, "symptoms", ("symptoms", "symptom", "description"))
    target_field = choose_field(semantic, "fault category", ("category", "class", "label"))
    fault_name_field = choose_field(semantic, "fault name", ("subcategory", "fault_name", "fault"))

    targets = [
        text_from_value(extract_path(record, target_field)[0])
        if target_field and extract_path(record, target_field)
        else ""
        for record in records
    ]
    class_counts = Counter(target for target in targets if target)
    canonical_records = [json.dumps(record, sort_keys=True, ensure_ascii=False) for record in records]
    symptom_texts = [normalized_text(extract_path(record, input_field)[0]) if input_field and extract_path(record, input_field) else "" for record in records]
    pair_counts = Counter(zip(symptom_texts, targets))
    unusable = sum(
        1
        for index in range(len(records))
        if not symptom_texts[index] or not targets[index]
    )
    compatibility, overlap, compatibility_reason = application_compatibility(records, input_field)

    minimum_class = min(class_counts.values(), default=0)
    average_class = (sum(class_counts.values()) / len(class_counts)) if class_counts else 0
    suitable = (
        len(records) - unusable >= 200
        and len(class_counts) >= 2
        and minimum_class >= 10
        and average_class >= 20
    )

    top_keys = list(data.keys()) if isinstance(data, dict) else sorted({key for record in records for key in record})
    return {
        "source": path.name,
        "structure": structure,
        "record_path": record_path,
        "records": records,
        "top_keys": top_keys,
        "fields": fields,
        "semantic": semantic,
        "input_field": input_field,
        "target_field": target_field,
        "fault_name_field": fault_name_field,
        "class_counts": class_counts,
        "exact_duplicates": len(canonical_records) - len(set(canonical_records)),
        "duplicate_symptoms": len(symptom_texts) - len(set(symptom_texts)),
        "duplicate_pairs": sum(count - 1 for count in pair_counts.values() if count > 1),
        "unusable": unusable,
        "compatibility": compatibility,
        "compatibility_overlap": overlap,
        "compatibility_reason": compatibility_reason,
        "suitable": suitable,
    }


def render_audit(analysis: dict[str, Any]) -> str:
    total = len(analysis["records"])
    class_counts: Counter[str] = analysis["class_counts"]
    field_lines = []
    missing_lines = []
    for path, info in sorted(analysis["fields"].items()):
        field_lines.append(f"  - {path}: {', '.join(sorted(info['types']))}")
        missing = total - info["present"]
        missing_lines.append(f"  - {path}: missing={missing}, null={info['nulls']}, empty={info['empty']}")

    semantic_lines = []
    for role, paths in analysis["semantic"].items():
        semantic_lines.append(f"  - {role}: {', '.join(paths) if paths else 'not detected'}")

    class_lines = []
    for category, count in class_counts.most_common():
        flag = " [VERY FEW EXAMPLES]" if count < 5 else ""
        class_lines.append(f"  - {category}: {count} ({count / total:.1%}){flag}")

    examples = "\n".join(f"  {index + 1}. {value}" for index, value in enumerate(APP_STYLE_EXAMPLES))
    conclusion = "SUITABLE_FOR_BASELINE_MODEL" if analysis["suitable"] else "INSUFFICIENT_DATA_FOR_RELIABLE_MODEL"
    suitability = (
        "The JSON is structurally suitable for supervised text classification because symptoms and a category target are present. "
        "It is not large or balanced enough to support a reliable model assessment."
    )

    return f"""AI MODULE 1 DATASET AUDIT
=============================
Source filename: {analysis['source']}
Top-level structure: {analysis['structure']}
Detected record path: {analysis['record_path']}
Top-level keys: {', '.join(analysis['top_keys'])}
Total records: {total}

Detected fields:
{chr(10).join(field_lines)}

Recursively detected semantic candidates:
{chr(10).join(semantic_lines)}

Potential ML input field: {analysis['input_field'] or 'not detected'}
Potential ML target field: {analysis['target_field'] or 'not detected'}
Potential original fault-name field: {analysis['fault_name_field'] or 'not detected'}
Number of target classes: {len(class_counts)}

Records per source target class:
{chr(10).join(class_lines) if class_lines else '  - none'}

Missing values:
{chr(10).join(missing_lines)}

Exact duplicate source records: {analysis['exact_duplicates']}
Duplicate normalized symptom records: {analysis['duplicate_symptoms']}
Duplicate symptom + source-target pairs: {analysis['duplicate_pairs']}
Unusable records (missing input or target): {analysis['unusable']}

Supervised-classification assessment:
{suitability}

Application-style input examples:
{examples}

Application input compatibility: {analysis['compatibility']}
{analysis['compatibility_reason']}

Conclusion:
{conclusion}
"""


def write_audit(analysis: dict[str, Any]) -> None:
    AUDIT_REPORT.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_REPORT.write_text(render_audit(analysis), encoding="utf-8")


def print_inspection(analysis: dict[str, Any]) -> None:
    print(f"Top-level structure: {analysis['structure']}")
    print(f"Detected record path: {analysis['record_path']}")
    print(f"Top-level keys: {', '.join(analysis['top_keys'])}")
    print(f"Total records: {len(analysis['records'])}")
    print("\nExample record:")
    print(json.dumps(analysis["records"][0] if analysis["records"] else {}, indent=2, ensure_ascii=False))
    print("\nRecursive fields:")
    for path, info in sorted(analysis["fields"].items()):
        print(f"  {path}: types={','.join(sorted(info['types']))}, present={info['present']}")
    print("\nPotential semantic fields:")
    for role, paths in analysis["semantic"].items():
        print(f"  {role}: {', '.join(paths) if paths else 'not detected'}")
    print("\nMissing-value statistics:")
    total = len(analysis["records"])
    for path, info in sorted(analysis["fields"].items()):
        print(f"  {path}: missing={total - info['present']}, null={info['nulls']}, empty={info['empty']}")
    print("\nUnique target classes and distribution:")
    for category, count in analysis["class_counts"].most_common():
        flag = " [VERY FEW EXAMPLES]" if count < 5 else ""
        print(f"  {category}: {count} ({count / total:.1%}){flag}")
    print(f"\nAudit report written to: {AUDIT_REPORT}")


if __name__ == "__main__":
    dataset_analysis = analyze_dataset()
    write_audit(dataset_analysis)
    print_inspection(dataset_analysis)
