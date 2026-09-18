# AI Module 1 — Fault Classification Dataset

AI Module 1 converts driver-reported symptoms into a likely vehicle fault category using a saved text classifier. It does not recommend a specific mechanic directly.

The intended separation is:

```text
driver symptoms → predicted vehicle fault → service-category mapping → provider recommendation
```

The trained model is exposed through FastAPI and called by the Node backend.

## Dataset

The supplied automotive-fault dataset is attributed in its filename to AKTC, Obike et al. No source URL or additional citation metadata is present in the downloaded file, so none is inferred here.

- Raw JSON: `dataset/raw/automotive_faults_aktc_obike_et_al.json`
- Processed CSV: `dataset/processed/ai1_fault_dataset.csv`
- Secondary raw CSV: `dataset/raw/car_diagnostic_cases.csv`
- Secondary processed CSV: `dataset/processed/ai1_secondary_fault_dataset.csv`
- Complete combined CSV: `dataset/processed/ai1_combined_fault_dataset.csv`
- Roadside training CSV: `dataset/processed/ai1_roadside_training_dataset.csv`
- Future AI 2 source archive: `dataset/processed/ai2_troubleshooting_archive.json`
- NHTSA full mapped dataset: `dataset/processed/ai1_nhtsa_fault_dataset.csv`
- NHTSA controlled sample: `dataset/processed/ai1_nhtsa_training_sample.csv`
- Final three-source training dataset: `dataset/processed/ai1_final_training_dataset.csv`
- Audit report: `reports/dataset_audit.txt`
- Combined audit report: `reports/combined_dataset_audit.txt`
- NHTSA class/mapping report: `reports/nhtsa_class_distribution.txt`
- Final three-source audit: `reports/ai1_final_dataset_audit.txt`
- Separate business mapping: `config/fault_service_mapping.json`

The future model target is `fault_category`; its principal input is `symptom_text`. Optional source-backed fields such as the original fault name and diagnostic procedure are retained for traceability but are not added to `symptom_text`.

`fault_service_mapping.json` is not training data. It converts a future predicted fault category to an existing backend service type after inference, keeping fault prediction separate from mechanic recommendation.

## Setup and commands

From the AI directory:

```bash
cd backend/ai
python -m venv venv
```

Activate in Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

If PowerShell blocks local scripts for the current terminal session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

For Command Prompt instead, use `venv\Scripts\activate.bat`.

Install the small data-processing dependency set:

```bash
pip install -r requirements.txt
```

Inspect the source structure and produce the initial audit:

```bash
python scripts/inspect_dataset.py
```

Prepare the standardized CSV, normalized category mapping, and final audit:

```bash
python scripts/prepare_dataset.py
```

Inspect and prepare the secondary diagnostic cases, then combine both sources:

```bash
python scripts/inspect_secondary_dataset.py
python scripts/prepare_secondary_dataset.py
python scripts/combine_datasets.py
```

Inspect and prepare the official NHTSA complaint flat file, then build the final three-source dataset:

```bash
python scripts/inspect_nhtsa_dataset.py
python scripts/prepare_nhtsa_dataset.py
python scripts/combine_all_ai1_datasets.py
```

The NHTSA scripts use the official headerless, tab-delimited complaint layout. `CDESCR` supplies the narrative input, `COMPDESC` is used only for conservative target mapping, and `ODINO` is preserved as `source_group_id` for future group-aware train/test splitting. The NHTSA contribution is capped at 2,000 unique records per class with `random_state = 42`; minority classes are not oversampled.

The field positions follow NHTSA's official complaints data dictionary: `https://static.nhtsa.gov/odi/ffdd/cmpl/CMPL.txt`. Privacy-sensitive flat-file fields such as VIN, city, state, operator identity, and dealer contact details are not written to AI 1 data.

The common roadside/non-roadside taxonomy is documented in `config/fault_taxonomy.json`. Actual secondary source classifications and mapping rationale are documented in `config/secondary_category_mapping.json`.

The complete combined file retains low-priority classes. The roadside file filters them for the emergency-breakdown use case without deleting them from the source or complete processed data.

The secondary source has many repeated symptom templates. Its processed file preserves all usable source rows and provenance; the combination step reports and removes repeated `symptom_text` + `fault_category` training pairs.

The preparation script removes only duplicate `symptom_text` + `fault_category` pairs. It does not oversample, synthesize, or fabricate records.

## AI 1 baseline training

Train and compare the Logistic Regression and Linear SVM baselines from the AI directory:

```powershell
.\venv\Scripts\python.exe scripts\train_ai1_models.py
```

Re-evaluate the saved pipelines without retraining:

```powershell
.\venv\Scripts\python.exe scripts\evaluate_ai1_model.py
```

The complete pipelines are saved under `models/`. Metrics, classification reports,
application-style predictions, and confusion matrices are written to
`reports/model_results/`. The split is the first deterministic fold from a
group-aware stratified five-fold split, and `symptom_text` is the only model input.

Prepare and exercise the reusable local prediction service:

```powershell
.\venv\Scripts\python.exe scripts\test_ai1_prediction.py
```

This command checks seven expected fault categories and one ambiguous-input
case, writes the prediction report, and exits with code 1 if a check fails.
These are illustrative examples, not a held-out accuracy benchmark. The current
model fails the cooling and transmission examples; successful inference alone
does not establish correct classification. See the
[AI 1 verification report](../../docs/ai1-verification.md) for verified results.

The prediction service loads the selected pipeline once per Python process. It
keeps fault prediction separate from the fault-to-service mapping and returns
top-three probabilities, prediction margin, confidence level, ambiguity, and a
`needs_more_information` flag. Confidence levels are application heuristics,
not statistical-certainty or repair-safety ratings.

## FastAPI service

Start AI 1 from the AI directory:

```powershell
.\venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Available endpoints:

- `GET /health`
- `POST /predict-fault` with `{ "symptom_text": "..." }`

Prediction text is required, whitespace-trimmed, and limited to 3,000
characters. FastAPI delegates prediction to `services/ai1_prediction_service.py`;
it does not contain a second copy of the model logic.
