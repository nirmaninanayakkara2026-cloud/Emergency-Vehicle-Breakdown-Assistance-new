# AI 1 verification — 2026-09-12

AI 1 loads and works through the backend HTTP connection, but it does not
consistently identify the expected vehicle fault category.

## Saved-model evaluation

Recomputed predictions using the deployed `ai1_fault_classifier.joblib` on the
existing deterministic held-out fold, without retraining or replacing models:

- Test records: 3,054; training records: 12,213.
- Accuracy: 81.5652%; macro F1: 0.787142.
- Source-group overlap and exact symptom-text overlap between splits: both 0.
- Results reproduce the saved model metadata. They estimate performance on this
  dataset and fold, not accuracy for all driver descriptions.
- The existing per-class report shows transmission F1 of 0.596950 and cooling
  F1 of 0.636364. Cooling has only 128 training examples.

## Application examples

Ran the real prediction service against the repository's existing examples:

| Example | Expected category | Actual category | Model confidence | Outcome |
| --- | --- | --- | --- | --- |
| Weak lights, clicking, will not start | Electrical | Electrical | 67.3% | Pass |
| High temperature, steam, coolant leak | Cooling | Engine | 48.9% | Fail; requests clarification |
| Steering difficult to turn | Steering | Steering | 99.6% | Pass |
| Soft brake pedal, longer stopping | Brake | Brake | 86.6% | Pass |
| Flat front tyre | Wheel/tyre | Wheel/tyre | 20.9% | Pass; requests clarification |
| Gear hesitation, transmission slipping | Transmission | Drivetrain | 87.9% | Fail; no clarification requested |
| Fuel smell, power loss, fuel leak | Fuel | Fuel | 96.1% | Pass |
| Vague noise, not working properly | Request more information | Requests more information | 22.2% | Pass |

Five of seven category checks pass; including the ambiguity check, six of eight
checks pass. These examples are illustrative expectations, not independently
confirmed mechanical diagnoses or an accuracy benchmark. Model confidence is
not the probability that a repair diagnosis is correct.

Additional probes found:

- Changing only `tyre` to `tire` in the flat-front-tyre example raises confidence
  from 20.9% to 75.3% and removes the clarification flag.
- `engine temperature warning came on vehicle overheating and fluid appears to
  be leaking` returns engine at 46.3%, with no clarification request.
- Nonsense, `hello`, and `my car is fine no problems` still receive an electrical
  category, although all three request more information. The classifier has no
  explicit unknown/no-fault output.

## Integration checks

- All 23 backend AI integration and symptom-capture tests pass.
- Started a temporary local FastAPI server and called it through the real Node
  `aiDiagnosisService` over HTTP. Steering classification, the normalized result
  contract, backend-built starting symptoms, and vague-input handling pass.
- Health reports AI 1 loaded. Six invalid HTTP inputs return 422: missing text,
  empty text, whitespace, numeric text, null, and text over 3,000 characters.
- Real-service checks confirm that explicit `transmission_problem`,
  `engine_overheating`, and `flat_tyre` selections produce the expected fault and
  mechanic category through the existing structured routing policy.

Structured routing is separate from model accuracy: its result uses
`predictionSource: structured_problem`. Free-text AI-first categories still
expose the model's classification errors. Cooling and engine share the same
mechanic mapping, but drivetrain maps to general mechanic while transmission
maps to transmission mechanic.

The HTTP checks used an isolated temporary service that was stopped afterward.
This does not verify the currently running mobile app, deployed service
configuration, or database-backed flow. FastAPI TestClient was unavailable
because its httpx2 dependency was missing; actual HTTP checks were used instead.

## Repeatable checks and remaining work

From `backend`:

```powershell
node --test tests/aiIntegration.test.js tests/symptomCapture.test.js
```

From `backend/ai`:

```powershell
.\venv\Scripts\python.exe scripts/test_ai1_prediction.py
```

The prediction script now checks expected outputs, records PASS/FAIL, and exits
with code 1 for the two reproduced category mismatches. Previously it printed
predictions and declared readiness without checking correctness. Details are in
[the generated prediction report](../backend/ai/reports/model_results/ai1_prediction_tests.txt).

The model and runtime classification rules were not changed. Improving them
requires evaluating consistent transmission/drivetrain labels, more cooling
examples, spelling coverage, and uncertain/unknown-input handling against a
separate representative validation set. The observed failures remain open.
