# Conversational troubleshooting implementation

The existing Expo → Express/MongoDB → Python AI 1/AI 2 architecture is retained. OpenAI interprets driver replies; the backend chooses approved steps, checks safety, and records the outcome. No new dependency, collection, dataset, or trained model was introduced.

## What changed

Previously, all 122 terminal answer options in 92 guides requested a mechanic. “Clean terminals” and “Correct pressure” were normal observation labels, not instructions to clean terminals or adjust pressure. Checklist completion could never reach the existing resolution screen.

Four explicitly configured normal-observation branches now ask whether the original problem has actually resolved. They cover battery terminal observation, tyre pressure, and two washer observations. A normal check alone does not establish a repair. The driver must explicitly confirm resolution, with no outstanding reported danger. If unresolved, a stored next approved step is used; otherwise the assistant explains why professional help is needed.

The knowledge audit also identified technical procedures incorrectly admitted by the old source filter. Thirteen such steps were removed from driver guidance, including balance-shaft, glow-plug, sensor, belt-tension and combined inspection/replacement procedures. Five guides consequently have no approved driver step. All 99 original archive records remain intact. The generated knowledge now has **87 guides, 93 steps, 6 LOW / 19 CAUTION / 62 HIGH guides**; exclusions are documented in the generated audit files.

## State and safety ownership

`troubleshootingStateService.js` derives the conversation state from the existing session status and phase, avoiding two independently editable state machines:

| Existing session state | Conversation state |
| --- | --- |
| `awaiting_safety_confirmation` | `SAFETY_CONFIRMATION` |
| `in_progress` / instruction phase | `TROUBLESHOOTING` |
| `in_progress` / result phase | `VERIFYING_ACTION` |
| Pending interpretation or clarification | `CLARIFICATION` |
| `awaiting_resolution_confirmation` | `CHECKING_RESOLUTION` |
| `resolved` | `RESOLVED` |
| `professional_help_required` | `ESCALATED` |

Initial symptom capture, classification and low-confidence clarification continue to use the existing screens and APIs. A conversation session is created once guidance is selected (or when danger is reported).

Backend rules check the raw message and structured initial symptoms before calling GPT or the classifier. Shared JSON rules are used by Node and Python for smoke/fire, fuel hazards, electrical burning, battery damage, brake/steering failure, overheating, unsafe locations and critical indicators. Explicit local negation and word boundaries avoid cases such as “no smoke” or “engine misfire” being treated as fire. These are bounded English rules, not an exhaustive hazard detector.

An additional possible danger identified by GPT pauses the flow for an explicit safety answer. The model cannot bypass a rule, mark a repair complete, select a new procedure or remove a backend safety decision. The legacy result endpoint also rejects resolution while a possible danger awaits clarification.

## Conversation and API behavior

The authenticated driver-only route `POST /api/self-assistant/:sessionId/message` accepts:

```json
{
  "message": "The terminals look shiny with no deposits",
  "stepId": "step_1",
  "expectedState": "VERIFYING_ACTION"
}
```

Alternatively, send a current `selectedResult`. The response retains `status`, `session`, `currentStep` / `nextStep` and adds derived `state`, `options`, `resolved`, `escalate`, `escalationReason` and `pendingInterpretation`.

- Explicit action confirmation is still required before a check result can be submitted. Free text cannot silently mark a physical check complete.
- Unambiguous approved answer labels can be handled without GPT. Common yes/no resolution replies are understood locally.
- GPT interpretations produce a confirmation question. Only the driver's confirmation advances the approved option.
- The first “Not Sure” produces a simpler, approved question. Continued uncertainty offers a different approved observation where one is explicitly configured (washer level → recall prior spray behavior). Otherwise, clarification is bounded and eventually stops with an insufficient-information reason.
- Completed and uncertain checks are recorded by step ID and result. The state manager refuses to re-enter a completed check.
- Invalid input does not finish a check or escalate the session. Temporary AI-service failures preserve the current check for retry.
- State/step checks reject stale chat requests, and Mongoose optimistic concurrency prevents silently overwriting concurrent saves.

## Database changes

The existing `TroubleshootingSession` collection gains optional/defaulted fields:

- `messages`: role, content, step ID and timestamp; bounded to the latest 120 entries.
- `lastMessage`: the current assistant prompt for restoring a session.
- `clarificationCount`: uncertainty attempts for the current check.
- `pendingInterpretation`: a proposed approved answer or pending safety clarification.
- `resumeStep`: the next approved check to use if the driver reports the issue unresolved.
- `escalationReason`: a reason such as `approved_steps_exhausted` or `driver_confirmed_danger`.

Existing `completedSteps`, predicted fault, symptoms, guide ID, safety confirmation and timestamps are reused. No data migration is required. Existing documents receive defaults when hydrated. Already-running sessions retain their previously saved step snapshot; new sessions use the regenerated guide metadata.

## OpenAI integration

The existing `OPENAI_API_KEY`, `OPENAI_MODEL`, SDK, client timeout/retry settings, sanitization and Responses API are reused. The new interpretation call uses strict structured output with an enum of current allowed answers. It receives the current question/instruction, symptoms, completed checks and at most 12 recent messages. Email/phone patterns are redacted and text is bounded. Responses use `store: false`.

Output is checked for allowed keys, valid option values and an evidence phrase actually present in the latest message. Generated repair instructions are never rendered. Explanations and clarification wording come from the approved guide text and backend templates; GPT can request clarification or propose an interpretation. This intentionally constrains the model's wording rather than claiming that free-form repair text can be made safe by a prompt alone.

API failure, malformed output or missing configuration falls back to the approved question/options. One live call with synthetic text was successful: “The terminals look shiny with no deposits” → proposed `clean_terminals`. No real driver data was used for that check.

References: [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Frontend

The existing troubleshooting screen now has a text input, persisted messages, interpretation-confirmation controls, simpler clarification, and inline resolution verification. It retains action confirmation and the existing stop/mechanic controls. Resuming a session restores its actual current question, including pending resolution. Confirmed success uses the existing result screen with “Problem Resolved” and no mechanic recommendation. Professional-help outcomes retain the mechanic flow and request prefill.

## Verification

- Backend: `node --test` — **133 passed**.
- Python: `python -m unittest discover -s backend/ai/ai2/tests -v` — **22 passed**.
- Knowledge validator — **PASS**.
- Mobile: `node --test test/*.test.js` — **56 passed, 1 existing failure**.
- The remaining mobile failure is `jobCompletionFlow.test.js`, “history routes completed work to completion details and home excludes it from active activity.” Its whitespace-sensitive assertion fails against the original `HEAD` version of `MyRequestsScreen.js`. The test, that screen and `DriverHomeScreen.js` are unchanged by this feature.
- Changed mobile screens were compiled through Babel successfully.
- A temporary real FastAPI server passed HTTP checks for guide matching, start, resolution verification, uncertainty and smoke-stop responses; it was stopped afterwards.
- One live OpenAI interpretation request passed using synthetic text.

The new backend conversation tests call the real Python guide engine. MongoDB persistence is replaced in those tests with serialized/reloaded Mongoose documents, including schema validation. They cover successful resolution from symptom selection, unresolved continuation, exhaustion, smoke before GPT, uncertainty, independent clarification, conversation memory, stale requests, invalid results, unsupported corrosion repair, model-output validation and pending-danger resolution gates. Live MongoDB concurrency and a physical-phone walkthrough have not been exercised.

## Example conversations

Successful resolution:

1. Driver: “Car won't start, clicking sound and dim lights.”
2. Backend selects the battery guide and requests safety confirmation.
3. Assistant presents the existing visual terminal check. Driver selects “Done — I Checked.”
4. Driver: “The terminals look shiny with no deposits.”
5. Assistant: “Did you mean: Clean terminals?” Driver confirms.
6. Assistant asks whether the starting problem is already resolved, explicitly saying not to start the engine just to answer.
7. Driver: “Yes, it started.”
8. Session becomes `resolved`; the existing success screen appears without a mechanic recommendation.

Unresolved continuation:

1. Driver completes the washer-level observation and selects “Sufficient fluid level.”
2. Assistant asks whether the original washer problem is resolved.
3. Driver: “No, still not working.”
4. Assistant advances to the distinct approved question about previously observed washer spray; it does not repeat the level check.
5. If the problem still remains after the final approved observation, the assistant explains that the available checks are exhausted and recommends professional help.

Danger:

1. Driver, at any active chat phase: “There is smoke coming from the battery.”
2. Backend safety rules stop the flow before GPT is called.
3. Assistant advises keeping away, contacting local emergency services if there is fire/immediate danger, and obtaining professional assistance. No mechanical step follows.

## Remaining scope

This is an observation-and-verification implementation. It does not add battery cleaning, disconnection, tightening, tyre inflation or vehicle restart procedures that the source did not safely establish. Corroded terminals still escalate because this knowledge base does not contain an approved driver cleaning procedure. Only the three explicitly configured guides gain resolution branches in this change. Further repair-capable paths require reviewed, vehicle-appropriate guidance and corresponding tests; source diagnosis labels must not be promoted to repair instructions.

Matching uses deterministic symptom/keyword scoring within the classifier's category. It is not a full diagnostic engine, and existing one-round low-confidence symptom clarification remains in place. Resolution records the driver's report; it does not certify roadworthiness. Restart the Python and Node development services to load the updated engine, generated knowledge and session handling, and reload the mobile app.

## Files changed

Backend:

- `backend/src/controllers/selfAssistantController.js`
- `backend/src/models/TroubleshootingSession.js`
- `backend/src/routes/selfAssistantRoutes.js`
- `backend/src/services/clarificationService.js`
- `backend/src/services/troubleshootingLanguageService.js` (new)
- `backend/src/services/troubleshootingSafetyService.js` (new)
- `backend/src/services/troubleshootingStateService.js` (new)

Python, knowledge and safety configuration:

- `backend/ai/app.py`
- `backend/ai/ai2/services/troubleshooting_engine.py`
- `backend/ai/ai2/services/safety.py` (new)
- `backend/ai/ai2/config/conversation_overrides.json` (new)
- `backend/ai/ai2/config/conversation_safety.json` (new)
- `backend/ai/ai2/config/risk_rules.json`
- `backend/ai/ai2/scripts/prepare_ai2_knowledge.py`
- `backend/ai/ai2/scripts/validate_ai2_knowledge.py`
- `backend/ai/ai2/knowledge/troubleshooting_knowledge_base.json` (regenerated)
- `backend/ai/ai2/reports/ai2_knowledge_audit.txt` (regenerated)
- `backend/ai/ai2/reports/ai2_unmapped_records.txt` (regenerated)

Mobile:

- `mobile/src/screens/driver/TroubleshootingConversationScreen.js`
- `mobile/src/screens/driver/SelfAssistantResultScreen.js`
- `mobile/src/screens/driver/SelfBreakdownAssistantScreen.js`
- `mobile/src/services/selfAssistantService.js`
- `mobile/src/utils/selfAssistantFlow.js`

Tests and documentation:

- `backend/tests/conversationalTroubleshooting.test.js` (new)
- `backend/tests/ai2Integration.test.js`
- `backend/ai/ai2/tests/test_troubleshooting_engine.py`
- `backend/ai/ai2/tests/test_ai2_api.py`
- `mobile/test/selfAssistantNavigation.test.js`
- `docs/conversational-troubleshooting.md` (this report)
