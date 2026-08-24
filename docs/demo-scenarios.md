# Demonstration Scenarios

## Demo 1 — AI mechanic recommendation

1. Log in as the demo driver.
2. Choose car and vehicle not starting.
3. Record clicking and dim dashboard lights in Guided Symptom Capture.
4. Submit near the Colombo demo coordinates.
5. Explain AI 1's electrical/starting prediction and confidence.
6. Show the electrical specialist ranking, distance, rating, ETA, and explanation.
7. Select the provider, accept from the provider account, and advance tracking.

Talking point: provider ranking is transparent business logic, not another ML model.

## Demo 2 — Confidence-aware clarification

1. Enter “vehicle making strange noise.”
2. Show `needsMoreInformation` rather than a forced diagnosis.
3. Answer one bounded clarification question, including the Not Sure path.
4. Show updated diagnostic text and rerun prediction.
5. Continue to suitable providers or a safe general fallback.

Talking point: OpenAI only asks bounded questions; it does not select faults, risk,
repair instructions, or provider scores.

## Demo 3 — Safety-aware self assistant

1. Choose a brake problem or report smoke during a CAUTION guide.
2. Show AI 1 categorization followed by AI 2's deterministic risk decision.
3. For brake/HIGH, show professional assistance with no detailed steps.
4. Alternatively confirm CAUTION, then report smoke to trigger an immediate stop.
5. Press Stop & Request Mechanic and show preserved symptoms/service prefill.

Talking point: safety rules fail closed; outages and uncertainty never create guessed
repair instructions.
