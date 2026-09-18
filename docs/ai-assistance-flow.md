# Simplified AI Assistance

Implemented on 2026-09-13 using the existing mobile screens, Node controllers,
MongoDB session model, AI 1 pipeline, Python AI 2 knowledge base, OpenAI client,
and mechanic-request flow. No agents, additional database, framework or package
dependencies were introduced.

## Driver flow

The AI Assistance screen first offers:

- **I know basic vehicle problems**: nine system categories, including Other.
- **I need help identifying the problem**: twelve observable symptoms, including
  smoke/steam, leaking liquid, shaking, warning lights and Not sure.

Each choice opens the existing guided capture screen with two relevant questions
and one danger-sign question. Additional text is optional. The old extra
see/hear/smell/feel page is skipped for this flow to avoid repeated answers.
The normal mechanic-request capture screen keeps its existing choices.

After reviewing the answers, the driver receives a possible problem and suitable
guidance. CAUTION guides show the existing safety acknowledgement screen first.
The guidance screen shows the current instruction and any relevant observations,
with Problem Solved, Still Not Fixed, Ask AI for More Help and Request Mechanic.
It does not present a continuous chatbot conversation.

## Backend and AI 1

`selfAssistantController` dispatches requests containing a valid `driverType`
to `simpleAssistanceService`. The service uses ordinary functions and conditionals:

1. Check original text and structured observations for danger.
2. Send a clear symptom description to the existing AI 1 HTTP service.
3. For the technical path, retain the explicitly selected category.
4. Narrow clicking/slow cranking plus weak lights to a possible weak 12V battery
   or connection issue. This is a symptom rule, not a confirmed diagnosis.
5. Request the best matching local guide within the category.
6. Use OpenAI only when no useful local guide exists; a high-risk local guide
   recommends professional help and is never bypassed with generated repairs.

The saved AI 1 model and training data are unchanged. Caller preprocessing removes
explicit absent hazards such as “No fuel smell” from classification text because
TF-IDF can otherwise treat them as positive evidence. It also normalizes tyre/tire
spelling. The original text remains available for safety checks and session storage.
Uncertain predictions use the existing single clarification round, with questions
that differ from the initial capture questions.

## Local knowledge base

The 87 existing guides were reused without rewriting their source procedures.
Guide matching now ignores generic category words and requires more relevant
evidence before choosing a component. The existing `/ai2/find-guide` endpoint
accepts `include_steps: true` for this flow and returns only public approved steps;
HIGH-risk guides return no repair steps. Older callers still receive metadata.

Empty guides or instructions containing unresolved placeholders such as “named
area” or “source check” are treated as not useful and use the fallback. Approved
result branches remain authoritative. Still Not Fixed advances directly only
when all approved outcomes lead to the same next check; otherwise it asks for the
needed observation or recommends a mechanic when no safe steps remain.

When a useful local guide can identify an observation but contains no approved
driver action for that result, the saved observation is sent to the same controlled
OpenAI fallback. Valid generated steps then continue in the guided interface. If
the model declines, returns an unsafe action, is unavailable, or the category is
too risky, the session ends with professional assistance instead.

For common low-risk gaps, GPT selects from backend-owned action packs instead of
writing the procedure. These currently cover a single low-load starting retry,
tyre-pressure adjustment, washer-fluid refill, owner-serviceable cabin or engine
air filters, and an owner-serviceable same-rating fuse. Applicability checks remove
these options when the report contains relevant damage or danger signs.

## OpenAI fallback and optional explanation

`aiTroubleshootingHelpService` reuses the existing client factory, configured
`OPENAI_API_KEY` / `OPENAI_MODEL`, timeout and text sanitization. It uses the
Responses API with a strict JSON schema and `store: false`, following the
[official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

Fallback responses contain a risk value, professional-help flag, at most four
short steps and an explanation. The backend validates types, lengths and risk,
and rejects specialist/dangerous actions before displaying any generated text.
Malformed output, refusal, timeout or unavailable configuration produces a usable
professional-help result rather than an application error.

Danger reports use a separate structured OpenAI request. The model can return only
IDs from a backend-owned list of immediate actions such as switching off, leaving
a smoking vehicle, avoiding traffic and requesting recovery. The backend converts
those IDs to fixed text and always adds the actions required for the detected
hazard. Invalid output, timeout or missing configuration uses the same fixed safety
actions without interrupting the professional-help result. GPT never supplies
free-form repair instructions for a dangerous problem.

Overheating remains a stopped, professional-help-required state. When the driver
selected the technical path, OpenAI writes a short human-friendly cold-engine
action list using a separate strict schema. Backend validation requires safe
shutdown, a completely cold engine, the hot-cap warning, handbook use, visual leak
inspection, conditional specified-coolant top-up, and recovery criteria. Unsafe or
incomplete output is replaced with the fixed reviewed list. The nontechnical path
receives only the immediate stop-and-recovery actions.

The optional Help endpoint sends the saved problem, vehicle type, current step,
existing steps and the driver's question. It returns one explanation and never
interprets an answer, advances a step or marks a repair complete. If optional
help is offline, the current local guide remains available.

## Safety and outcomes

Shared Node/Python rules cover smoke/fire, fuel leaks/smells, burning/sparks,
damaged batteries, brake/steering failure, overheating/red temperature warnings,
serious fluid leaks, unsafe road positions, critical indicators and high-voltage
references. Explicit negative observations such as “not overheating” and “don't
smell fuel” are excluded; affirmative “brakes are not working” is still dangerous.

New danger reports in initial capture, optional help or step observations stop
guidance before further repair instructions and display immediate safety actions.
The OpenAI repair-help path also prohibits repair guidance for
brake, steering, fuel, transmission and drivetrain categories. CAUTION alone is
not an automatic escalation. Not sure gives an explanation and keeps the current
step available.

Problem Solved sets `status: resolved`, `resolved: true` and `completedAt` on the
existing MongoDB session, which also stores the identified problem, category,
driver type and `LOCAL_KB` or `OPENAI` source. An observation such as clean battery
terminals does not automatically mark the original problem solved.

Request Mechanic reuses the existing prefill, session ownership checks and provider
request flow. The booking controller retains the session's saved diagnosis and
mechanic category, avoiding a contradictory second classification of the same text.

## Compatibility and removed chat behaviour

The existing `TroubleshootingConversationScreen` route now renders a compact
guidance screen. Transcript rendering, message interpretation confirmation and the
always-open chat composer were removed from that screen. The optional help area
only opens when requested.

Legacy backend conversation functions remain to support previously saved sessions
and older clients. New sessions cannot use the old message/action-confirm/step
endpoints to bypass guided controls. No database migration is required.

## Files for this implementation

| Area | Files |
| --- | --- |
| New entry choices and questions | `mobile/src/data/assistanceOptions.js` |
| Entry and capture UI | `mobile/src/screens/driver/SelfBreakdownAssistantScreen.js`, `GuidedSymptomCaptureScreen.js`, `AIClarificationScreen.js` |
| Guidance UI | `mobile/src/screens/driver/TroubleshootingConversationScreen.js` |
| Shared UI/navigation | `mobile/src/components/symptom/MainProblemGrid.js`, `mobile/src/navigation/DriverNavigator.js` |
| Mobile payload/API helpers | `mobile/src/services/symptomCaptureService.js`, `selfAssistantService.js`, `mobile/src/utils/selfAssistantFlow.js` |
| New simple backend services | `backend/src/services/simpleAssistanceService.js`, `aiTroubleshootingHelpService.js` |
| Controllers/routes | `backend/src/controllers/selfAssistantController.js`, `breakdownRequestController.js`, `backend/src/routes/selfAssistantRoutes.js` |
| Existing session model | `backend/src/models/TroubleshootingSession.js` |
| AI 2 client/API/matching | `backend/src/services/ai2TroubleshootingService.js`, `backend/ai/app.py`, `backend/ai/ai2/services/troubleshooting_engine.py` |
| Safety | `backend/src/services/troubleshootingSafetyService.js`, `backend/ai/ai2/services/safety.py`, `backend/ai/ai2/config/conversation_safety.json` |
| Tests | `backend/tests/simpleAssistance.test.js`, `mobile/test/selfAssistantNavigation.test.js`, `backend/ai/ai2/tests/test_ai2_api.py`, `test_troubleshooting_engine.py` |
| Documentation | This file and `docs/ai-evidence-index.md` |

Earlier AI 1 verification/report changes in this workspace belong to the preceding
check, not to model retraining for this feature.

## Verification and demonstration

Final verification results:

| Check | Result |
| --- | --- |
| Full Node backend suite | 171/171 passed |
| Python AI 2 engine/API suite | 26/26 passed |
| AI Assistance mobile suite | 36/36 passed |
| Full mobile suite | 64/65 passed; one existing booking-history whitespace assertion |
| Babel compilation | All 10 changed mobile source files compiled |
| Real local HTTP exercise | Both driver battery paths passed |
| Live OpenAI fallback | Battery retry, tyre pressure and engine air-filter action packs passed |
| Git whitespace/error check | Passed |

Run backend tests from `backend` with `node --test`. Run mobile tests from `mobile`
with `npm test`. From `backend/ai`, run:

```powershell
.\venv\Scripts\python.exe -m unittest discover -s ai2/tests -v
```

The new backend tests cover both battery paths using the actual local Python guide,
the saved AI 1 model with preprocessed input, missing guides, controlled OpenAI
responses, constrained danger-action selection, fixed safety fallback,
dangerous/negative text, explanation, Not sure, resolution, local and generated
step progression, ownership, stale steps, legacy endpoint rejection and mechanic
handoff. MongoDB writes are represented by validated Mongoose documents stored in
test memory. Automated OpenAI tests use mocks. Separate live calls verified the
configured model selects the reviewed battery and tyre action packs.

A temporary real FastAPI HTTP service was also exercised through the Node
controller for both driver paths: classification, local guide lookup, CAUTION
acknowledgement, guidance and resolution all passed. The service was stopped after
the check.

To demonstrate a driver-resolved battery path in the app:

1. Choose **I need help identifying the problem**.
2. Select **Vehicle will not start**.
3. Select **I hear a clicking sound**, **Weak or dim**, and **None of these** for danger signs.
4. In the optional description enter: `The vehicle clicks and the dashboard lights are dim. I see no smoke and smell nothing unusual.`
5. Review symptoms and continue.
6. Read and acknowledge the CAUTION screen.
7. Follow the visible-terminal check and select **Clean terminals**.
8. When asked whether the starting problem is resolved, select **Still Not Fixed**.
9. The GPT fallback displays the reviewed four-step low-load starting retry. Follow it in order.
10. If the vehicle starts, select **Problem Solved**. The session is saved as resolved without requesting a mechanic.

The tyre-pressure path is another useful supervisor demonstration. Choose the tyre/wheel
problem, report a pressure warning or low pressure with no visible tyre damage, then
select the low/high-pressure observation. GPT returns the reviewed steps to find the
manufacturer's specified pressure, use a gauge and inflator, refit the valve cap, and
check whether the pressure drops again.

Restart the Node backend, Python AI service and mobile development session to load
the changes.

## Limitations

- AI 1 still has the previously documented category accuracy limitations. This
  implementation does not retrain the model or confirm a damaged component.
- Basic keyword rules and output checks are intentionally conservative and are
  not a complete language/safety proof. More real driver wording needs validation.
- Local knowledge has limited driver-level repairs; many guides correctly end in
  professional assistance after a visual check.
- Live OpenAI output was exercised directly. Physical-device interaction and a live
  production MongoDB deployment were not exercised in this session.
- The broader mobile suite has a pre-existing whitespace-sensitive assertion in
  `test/jobCompletionFlow.test.js:25`. It also fails against the original HEAD
  version of `MyRequestsScreen.js`; the matching navigation code is split across
  lines. This unrelated test and booking-history screen were left unchanged.
