"""Train and evaluate the two AI 1 baseline text classifiers."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib
import matplotlib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    ConfusionMatrixDisplay,
    accuracy_score,
    classification_report,
    precision_recall_fscore_support,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

matplotlib.use("Agg")
import matplotlib.pyplot as plt


RANDOM_STATE = 42
AI_ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = AI_ROOT / "dataset" / "processed" / "ai1_final_training_dataset.csv"
MODELS_DIR = AI_ROOT / "models"
RESULTS_DIR = AI_ROOT / "reports" / "model_results"
REQUIRED_COLUMNS = {"symptom_text", "fault_category", "source_group_id"}
MODEL_FILES = {
    "Logistic Regression": MODELS_DIR / "ai1_logistic_regression.joblib",
    "Linear SVM": MODELS_DIR / "ai1_linear_svm.joblib",
}
CONFUSION_FILES = {
    "Logistic Regression": "logistic_regression_confusion_matrix.png",
    "Linear SVM": "linear_svm_confusion_matrix.png",
}
REPORT_FILES = {
    "Logistic Regression": "logistic_regression_classification_report.txt",
    "Linear SVM": "linear_svm_classification_report.txt",
}
APPLICATION_EXAMPLES = [
    "vehicle does not start dashboard lights are weak clicking sound",
    "engine temperature warning came on vehicle overheating and fluid appears to be leaking",
    "steering suddenly became difficult while driving",
    "brake pedal feels soft and vehicle takes longer to stop",
    "tyre is completely flat and vehicle pulls to one side",
]
AMBIGUOUS_EXAMPLE = "vehicle making strange noise and not working properly"


def ensure_output_directories() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def load_dataset() -> pd.DataFrame:
    """Load, audit, and minimally clean the final AI 1 dataset."""
    data = pd.read_csv(DATASET_PATH)
    missing_columns = REQUIRED_COLUMNS.difference(data.columns)
    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing_columns)}")

    print(f"Raw dataset shape: {data.shape}")
    print(f"Missing symptom_text: {int(data['symptom_text'].isna().sum())}")
    print(f"Missing target labels: {int(data['fault_category'].isna().sum())}")
    print(f"Missing source groups: {int(data['source_group_id'].isna().sum())}")
    print(f"Duplicated symptom text: {int(data['symptom_text'].duplicated().sum())}")

    clean = data.dropna(subset=list(REQUIRED_COLUMNS)).copy()
    for column in REQUIRED_COLUMNS:
        clean[column] = clean[column].astype(str).str.strip()
    usable = (
        clean["symptom_text"].ne("")
        & clean["fault_category"].ne("")
        & clean["source_group_id"].ne("")
    )
    dropped = int((~usable).sum())
    clean = clean.loc[usable].reset_index(drop=True)
    print(f"Unusable rows dropped: {dropped}")
    print(f"Final training dataset shape: {clean.shape}")
    print("Class distribution:")
    print(clean["fault_category"].value_counts().sort_index().to_string())
    return clean


def create_split(data: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Return the first deterministic group-aware stratified fold."""
    splitter = StratifiedGroupKFold(
        n_splits=5, shuffle=True, random_state=RANDOM_STATE
    )
    train_indices, test_indices = next(
        splitter.split(
            data["symptom_text"],
            data["fault_category"],
            groups=data["source_group_id"],
        )
    )
    train_groups = set(data.iloc[train_indices]["source_group_id"])
    test_groups = set(data.iloc[test_indices]["source_group_id"])
    overlap = train_groups.intersection(test_groups)

    print(f"Train records: {len(train_indices)}")
    print(f"Test records: {len(test_indices)}")
    print(f"Unique train groups: {len(train_groups)}")
    print(f"Unique test groups: {len(test_groups)}")
    print(f"Group overlap: {len(overlap)}")
    if overlap:
        raise RuntimeError("Group leakage detected between training and test data")

    train_classes = set(data.iloc[train_indices]["fault_category"])
    test_classes = set(data.iloc[test_indices]["fault_category"])
    expected_classes = set(data["fault_category"])
    if train_classes != expected_classes or test_classes != expected_classes:
        raise RuntimeError("At least one fault class is absent from a split")
    return train_indices, test_indices


def make_vectorizer() -> TfidfVectorizer:
    return TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.98,
        sublinear_tf=True,
        max_features=50000,
    )


def build_models() -> dict[str, Pipeline]:
    return {
        "Logistic Regression": Pipeline(
            [
                ("tfidf", make_vectorizer()),
                (
                    "classifier",
                    LogisticRegression(
                        max_iter=2000,
                        class_weight="balanced",
                        random_state=RANDOM_STATE,
                    ),
                ),
            ]
        ),
        "Linear SVM": Pipeline(
            [
                ("tfidf", make_vectorizer()),
                (
                    "classifier",
                    LinearSVC(class_weight="balanced", random_state=RANDOM_STATE),
                ),
            ]
        ),
    }


def evaluate_model(
    name: str,
    model: BaseEstimator,
    x_test: pd.Series,
    y_test: pd.Series,
    classes: list[str],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    predictions = model.predict(x_test)
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, predictions, labels=classes, zero_division=0
    )
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(
        y_test, predictions, average="macro", zero_division=0
    )
    _, _, weighted_f1, _ = precision_recall_fscore_support(
        y_test, predictions, average="weighted", zero_division=0
    )
    metrics = {
        "model": name,
        "accuracy": float(accuracy_score(y_test, predictions)),
        "macro_precision": float(macro_precision),
        "macro_recall": float(macro_recall),
        "macro_f1": float(macro_f1),
        "weighted_f1": float(weighted_f1),
    }
    per_class = []
    for index, fault_category in enumerate(classes):
        row = {
            "model": name,
            "fault_category": fault_category,
            "precision": float(precision[index]),
            "recall": float(recall[index]),
            "f1_score": float(f1[index]),
            "support": int(support[index]),
        }
        per_class.append(row)
        if row["f1_score"] < 0.50:
            print(f"WARNING: {fault_category} has weak classification performance.")

    report_text = classification_report(
        y_test, predictions, labels=classes, digits=4, zero_division=0
    )
    (RESULTS_DIR / REPORT_FILES[name]).write_text(report_text, encoding="utf-8")
    print(f"\n{name}\n{report_text}")

    display_labels = [label.replace("_", " ") for label in classes]
    figure, axis = plt.subplots(figsize=(13, 11))
    ConfusionMatrixDisplay.from_predictions(
        y_test,
        predictions,
        labels=classes,
        display_labels=display_labels,
        cmap="Blues",
        xticks_rotation=45,
        colorbar=False,
        ax=axis,
    )
    axis.set_title(f"AI 1 {name} Confusion Matrix")
    figure.tight_layout()
    figure.savefig(RESULTS_DIR / CONFUSION_FILES[name], dpi=170)
    plt.close(figure)
    return metrics, per_class


def select_model(metrics_by_name: dict[str, dict[str, Any]]) -> tuple[str, str]:
    logistic_f1 = metrics_by_name["Logistic Regression"]["macro_f1"]
    svm_f1 = metrics_by_name["Linear SVM"]["macro_f1"]
    difference = abs(logistic_f1 - svm_f1)
    if logistic_f1 >= svm_f1:
        return "Logistic Regression", "Highest Macro F1 score."
    if difference <= 0.005:
        return (
            "Logistic Regression",
            "Macro F1 scores differ by no more than 0.005; Logistic Regression was "
            "preferred because it directly provides probability estimates.",
        )
    return "Linear SVM", "Highest Macro F1 score."


def metric_block(metrics: dict[str, Any]) -> str:
    return (
        f"Accuracy: {metrics['accuracy']:.6f}\n"
        f"Macro Precision: {metrics['macro_precision']:.6f}\n"
        f"Macro Recall: {metrics['macro_recall']:.6f}\n"
        f"Macro F1: {metrics['macro_f1']:.6f}\n"
        f"Weighted F1: {metrics['weighted_f1']:.6f}"
    )


def application_predictions(name: str, model: BaseEstimator) -> str:
    inputs = APPLICATION_EXAMPLES + [AMBIGUOUS_EXAMPLE]
    predictions = model.predict(inputs)
    lines = ["AI 1 APPLICATION-STYLE PREDICTIONS", ""]
    if name == "Logistic Regression":
        confidences = model.predict_proba(inputs).max(axis=1)
        values = [f"Confidence: {value:.6f}" for value in confidences]
    else:
        scores = model.decision_function(inputs)
        values = [f"Decision score: {scores[i].max():.6f}" for i in range(len(inputs))]

    for index, (input_text, prediction, value) in enumerate(
        zip(inputs, predictions, values), start=1
    ):
        lines.extend(
            [
                f"Example {index}{' (ambiguous)' if input_text == AMBIGUOUS_EXAMPLE else ''}",
                f"Input: {input_text}",
                f"Predicted fault: {prediction}",
                value,
            ]
        )
        if input_text == AMBIGUOUS_EXAMPLE:
            lines.append(
                "Note: This input lacks specific symptoms; the prediction is uncertain "
                "and should not be treated as definitely correct."
            )
        lines.append("")
    output = "\n".join(lines)
    print(f"\n{output}")
    (RESULTS_DIR / "application_style_predictions.txt").write_text(
        output + "\n", encoding="utf-8"
    )
    return output


def save_reports_and_selection(
    data: pd.DataFrame,
    train_indices: np.ndarray,
    test_indices: np.ndarray,
    models: dict[str, BaseEstimator],
    metrics_rows: list[dict[str, Any]],
    per_class_rows: list[dict[str, Any]],
) -> tuple[str, dict[str, Any], str, str]:
    metrics_by_name = {row["model"]: row for row in metrics_rows}
    selected_name, selection_reason = select_model(metrics_by_name)
    selected_metrics = metrics_by_name[selected_name]
    selected_model = models[selected_name]

    pd.DataFrame(metrics_rows).to_csv(RESULTS_DIR / "model_metrics.csv", index=False)
    pd.DataFrame(per_class_rows).to_csv(
        RESULTS_DIR / "per_class_metrics.csv", index=False
    )

    comparison = ["AI 1 BASELINE MODEL COMPARISON", ""]
    for name in ("Logistic Regression", "Linear SVM"):
        comparison.extend([name, "", metric_block(metrics_by_name[name]), ""])
    comparison.extend(
        ["BEST MODEL:", selected_name, "", "SELECTION REASON:", selection_reason]
    )
    (RESULTS_DIR / "model_comparison.txt").write_text(
        "\n".join(comparison) + "\n", encoding="utf-8"
    )

    selected_per_class = [
        row for row in per_class_rows if row["model"] == selected_name
    ]
    weakest = min(selected_per_class, key=lambda row: row["f1_score"])
    strongest = max(selected_per_class, key=lambda row: row["f1_score"])
    major_class_failed = any(row["f1_score"] == 0.0 for row in selected_per_class)
    assessment = (
        "ACCEPTABLE_BASELINE"
        if selected_metrics["macro_f1"] >= 0.70 and not major_class_failed
        else "NEEDS_IMPROVEMENT"
    )

    joblib.dump(selected_model, MODELS_DIR / "ai1_fault_classifier.joblib")
    metadata = {
        "model_name": selected_name,
        "algorithm": type(selected_model.named_steps["classifier"]).__name__,
        "input": "symptom_text",
        "target": "fault_category",
        "classes": sorted(data["fault_category"].unique().tolist()),
        "training_records": int(len(train_indices)),
        "testing_records": int(len(test_indices)),
        "accuracy": selected_metrics["accuracy"],
        "macro_f1": selected_metrics["macro_f1"],
        "weighted_f1": selected_metrics["weighted_f1"],
        "random_state": RANDOM_STATE,
        "dataset": DATASET_PATH.name,
        "selection_reason": selection_reason,
        "model_assessment": assessment,
    }
    (MODELS_DIR / "ai1_model_metadata.json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    application_output = application_predictions(selected_name, selected_model)

    train_counts = data.iloc[train_indices]["fault_category"].value_counts().sort_index()
    test_counts = data.iloc[test_indices]["fault_category"].value_counts().sort_index()
    full_counts = data["fault_category"].value_counts().sort_index()
    report = [
        "AI 1 BASELINE MODEL EVALUATION REPORT",
        "",
        f"Dataset: {DATASET_PATH.name}",
        f"Dataset size: {len(data)}",
        f"Train size: {len(train_indices)}",
        f"Test size: {len(test_indices)}",
        f"Fault classes: {data['fault_category'].nunique()}",
        "Group-aware split: StratifiedGroupKFold, first fold, random_state=42",
        "Group overlap: 0 (confirmed)",
        "ML input: symptom_text only",
        "Target: fault_category",
        "",
        "FULL CLASS DISTRIBUTION",
        full_counts.to_string(),
        "",
        "TRAIN CLASS DISTRIBUTION",
        train_counts.to_string(),
        "",
        "TEST CLASS DISTRIBUTION",
        test_counts.to_string(),
        "",
        "LOGISTIC REGRESSION RESULTS",
        metric_block(metrics_by_name["Logistic Regression"]),
        "",
        "LINEAR SVM RESULTS",
        metric_block(metrics_by_name["Linear SVM"]),
        "",
        f"Selected model: {selected_name}",
        f"Selection reason: {selection_reason}",
        f"Weakest-performing class: {weakest['fault_category']} (F1={weakest['f1_score']:.6f})",
        f"Strongest-performing class: {strongest['fault_category']} (F1={strongest['f1_score']:.6f})",
        f"Model assessment: {assessment}",
        "",
        "LIMITATIONS",
        "- cooling_system_fault has significantly fewer training examples than most other classes.",
        "- Metrics estimate performance only on the deterministic held-out fold of the current data.",
        "- Complaint narratives can be vague, incomplete, or mention symptoms from multiple systems.",
        "- A classifier prediction is not a mechanical diagnosis or a safety guarantee.",
        "- Low-confidence and out-of-scope handling must be designed before production use.",
        "",
        application_output,
    ]
    (RESULTS_DIR / "ai1_evaluation_report.txt").write_text(
        "\n".join(report) + "\n", encoding="utf-8"
    )
    return selected_name, selected_metrics, weakest["fault_category"], assessment


def run_evaluation(
    data: pd.DataFrame,
    train_indices: np.ndarray,
    test_indices: np.ndarray,
    models: dict[str, BaseEstimator],
) -> tuple[str, dict[str, Any], str, str]:
    x_test = data.iloc[test_indices]["symptom_text"]
    y_test = data.iloc[test_indices]["fault_category"]
    classes = sorted(data["fault_category"].unique().tolist())
    metrics_rows: list[dict[str, Any]] = []
    per_class_rows: list[dict[str, Any]] = []
    for name, model in models.items():
        metrics, class_metrics = evaluate_model(name, model, x_test, y_test, classes)
        metrics_rows.append(metrics)
        per_class_rows.extend(class_metrics)
    return save_reports_and_selection(
        data, train_indices, test_indices, models, metrics_rows, per_class_rows
    )


def evaluate_saved_models() -> None:
    """Load saved pipelines and regenerate evaluation artifacts without training."""
    ensure_output_directories()
    data = load_dataset()
    train_indices, test_indices = create_split(data)
    missing = [str(path) for path in MODEL_FILES.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Train the models first; missing files: {missing}")
    models = {name: joblib.load(path) for name, path in MODEL_FILES.items()}
    selected, metrics, weakest, assessment = run_evaluation(
        data, train_indices, test_indices, models
    )
    print_completion(
        len(train_indices), len(test_indices), selected, metrics, weakest, assessment
    )


def print_completion(
    train_size: int,
    test_size: int,
    selected: str,
    selected_metrics: dict[str, Any],
    weakest: str,
    assessment: str,
) -> None:
    metrics = pd.read_csv(RESULTS_DIR / "model_metrics.csv").set_index("model")
    print("\nAI 1 MODEL TRAINING COMPLETE")
    print(f"Training records: {train_size}")
    print(f"Testing records: {test_size}")
    print("Models compared: 2")
    print(f"Logistic Regression Macro F1: {metrics.loc['Logistic Regression', 'macro_f1']:.6f}")
    print(f"Linear SVM Macro F1: {metrics.loc['Linear SVM', 'macro_f1']:.6f}")
    print(f"Selected model: {selected}")
    print(f"Selected model accuracy: {selected_metrics['accuracy']:.6f}")
    print(f"Selected model Macro F1: {selected_metrics['macro_f1']:.6f}")
    print(f"Selected model Weighted F1: {selected_metrics['weighted_f1']:.6f}")
    print(f"Weakest class: {weakest}")
    print(f"Model assessment: {assessment}")


def main() -> None:
    ensure_output_directories()
    data = load_dataset()
    train_indices, test_indices = create_split(data)
    x_train = data.iloc[train_indices]["symptom_text"]
    y_train = data.iloc[train_indices]["fault_category"]
    models = build_models()
    for name, model in models.items():
        print(f"\nTraining {name}...")
        model.fit(x_train, y_train)
        joblib.dump(model, MODEL_FILES[name])
        print(f"Saved {MODEL_FILES[name]}")
    selected, metrics, weakest, assessment = run_evaluation(
        data, train_indices, test_indices, models
    )
    print_completion(
        len(train_indices), len(test_indices), selected, metrics, weakest, assessment
    )


if __name__ == "__main__":
    main()
