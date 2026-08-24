# Final System Test Report

Date: 2026-08-24  
Environment: Windows PowerShell, Node.js 22.14.0, Python virtual environment, Expo Android export

## Result

The automated final-system validation passed with no failed checks. The code is
ready for a configured demonstration environment. Physical-device interaction,
live MongoDB seeding, and live third-party OpenAI behavior remain explicit manual
or environment-dependent checks; they are not reported as completed.

| Area | Evidence | Result |
|---|---:|---|
| Authentication and authorization | registration/login, duplicate email, wrong password, missing/invalid/expired JWT, ownership and role boundaries | PASS |
| Smart symptom capture | five guided symptom groups plus optional non-guided input | PASS |
| AI 1 | eight real artifact prediction scenarios; backend integration and fallback tests | PASS |
| Optional clarification | high-confidence bypass, bounded output, unavailable-service path, attempt limit | PASS |
| AI 2 | 16 Python engine tests and 13 Node integration tests; 92 guides validated | PASS |
| Provider flow | filtering, ranking, maximum five, selection, rejection, lifecycle and review | PASS |
| Cost estimates | all 10 configured LKR service ranges | PASS |
| Mobile source | Babel compilation of all 56 JS/JSX source files | PASS |
| Android production bundle | 933 modules bundled and exported successfully | PASS |
| Demo fixtures | one driver and ten provider fixtures; safe import and idempotent upsert structure | PASS |
| Secret scan | no API-token or private-key patterns in source/config/docs | PASS |

## Automated Suite Totals

| Suite | Passed | Failed |
|---|---:|---:|
| `backend/test/finalSystem.test.js` | 24 | 0 |
| `backend/test/aiIntegration.test.js` | 11 | 0 |
| `backend/test/ai2Integration.test.js` | 13 | 0 |
| `backend/test/providerFlow.test.js` | 14 | 0 |
| `backend/test/symptomCapture.test.js` | 6 | 0 |
| AI 2 Python unit tests | 16 | 0 |
| AI 1 scripted artifact predictions | 8 | 0 |
| **Total automated checks** | **92** | **0** |

The 56-file mobile compilation and Android production export are additional
build validations and are not included in the 92-test total.

## AI 1 Prediction Evidence

| Scenario | Prediction | Confidence behavior | Result |
|---|---|---|---|
| Battery/electrical | `electrical_system_fault` | medium, no clarification | PASS |
| Cooling/overheating | `engine_system_fault` | ambiguous, clarification requested | PASS |
| Steering | `steering_system_fault` | high | PASS |
| Brake | `brake_system_fault` | high | PASS |
| Tyre/wheel | `wheel_tire_fault` | low, clarification requested | PASS |
| Transmission | `drivetrain_fault` | high, related service group | PASS |
| Fuel | `fuel_system_fault` | high | PASS |
| Vague noise | `electrical_system_fault` | low, ambiguous, clarification requested | PASS |

The runtime emitted a non-failing scikit-learn artifact compatibility warning:
runtime 1.8.0 versus training artifact 1.9.0. Predictions completed successfully,
but aligning the runtime version before a production deployment is recommended.

## Safety and Failure Handling

- AI 1 unavailability falls back to deterministic service mapping.
- OpenAI clarification is optional; an unavailable service does not block the request.
- AI 2 unavailability fails closed and returns no invented repair steps.
- High-risk AI 2 outcomes do not create an active repair process.
- Smoke/danger input stops an active troubleshooting session immediately.
- Internal provider ranking scores and API keys are not returned to mobile clients.

Critical safety failures: **0**  
Critical security failures: **0**

## Environment-Dependent Checks

- `npm run seed:demo` was not executed against a live database because the test
  environment did not provide an authorized `MONGO_URI` and `DEMO_PASSWORD`.
  The script syntax, fixture coverage, no-write import behavior, and idempotent
  upsert implementation passed automated inspection.
- The physical-device checklist in `docs/mobile-manual-test-checklist.md` remains
  for a human tester using the final demonstration network and device.
- Live OpenAI clarification requires `OPENAI_API_KEY`; the no-key/unavailable path
  passed and remains non-blocking by design.

## Final Summary

```text
FINAL SYSTEM VALIDATION
Backend tests: PASS
AI 1 tests: PASS
AI 2 tests: PASS
Provider flow tests: PASS
Mobile build validation: PASS
Demo data fixture validation: PASS
API key exposure: NONE FOUND
Critical security failures: 0
Critical safety failures: 0
Total automated tests: 92
Passed: 92
Failed: 0
Ready for project demonstration: YES (after environment configuration)
```
