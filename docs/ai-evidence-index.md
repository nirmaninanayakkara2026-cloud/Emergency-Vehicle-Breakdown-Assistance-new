# AI Evidence Index

- [Simplified AI Assistance implementation and demo](ai-assistance-flow.md)

## AI 1 data preparation

- [Initial dataset audit](../backend/ai/reports/dataset_audit.txt)
- [AI 1 final dataset audit](../backend/ai/reports/ai1_final_dataset_audit.txt)
- [Combined dataset audit](../backend/ai/reports/combined_dataset_audit.txt)
- [NHTSA class distribution](../backend/ai/reports/nhtsa_class_distribution.txt)

## AI 1 training and evaluation

- [AI 1 verification and current failures](ai1-verification.md)
- [Evaluation report](../backend/ai/reports/model_results/ai1_evaluation_report.txt)
- [Model comparison](../backend/ai/reports/model_results/model_comparison.txt)
- [Model metrics](../backend/ai/reports/model_results/model_metrics.csv)
- [Per-class metrics](../backend/ai/reports/model_results/per_class_metrics.csv)
- [Logistic Regression report](../backend/ai/reports/model_results/logistic_regression_classification_report.txt)
- [Logistic Regression confusion matrix](../backend/ai/reports/model_results/logistic_regression_confusion_matrix.png)
- [Linear SVM report](../backend/ai/reports/model_results/linear_svm_classification_report.txt)
- [Linear SVM confusion matrix](../backend/ai/reports/model_results/linear_svm_confusion_matrix.png)
- [Selected model metadata](../backend/ai/models/ai1_model_metadata.json)
- [Prediction tests](../backend/ai/reports/model_results/ai1_prediction_tests.txt)
- [Application predictions](../backend/ai/reports/model_results/application_style_predictions.txt)

## AI 2 knowledge and safety

- [Knowledge audit](../backend/ai/ai2/reports/ai2_knowledge_audit.txt)
- [Excluded records](../backend/ai/ai2/reports/ai2_unmapped_records.txt)
- [Knowledge validator](../backend/ai/ai2/scripts/validate_ai2_knowledge.py)
- [Engine/API safety tests](../backend/ai/ai2/tests/)

AI 1 is statistical classification with explicit confidence policy. AI 2 is a
deterministic validated knowledge engine and does not generate repair steps.
