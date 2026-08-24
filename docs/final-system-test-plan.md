# Final System Test Plan

## Purpose

Verify the completed system without adding new AI behavior. Automated tests use
isolated mocks for databases and external services; mobile presentation checks
include compilation plus a manual device checklist.

## Test groups

1. **Authentication** — registration/login, duplicate email, wrong password,
   missing/invalid/expired JWT.
2. **Smart symptom capture** — starting, tyre, brake, overheating, Not Sure,
   omitted optional description, and non-guided input.
3. **AI 1 diagnosis** — electrical, brake, steering, tyre, ambiguous phrases,
   actual trained-model schema, and confidence policy.
4. **AI clarification** — bounded questions/options, Not Sure, answer submission,
   rerun, two-attempt limit, and optional OpenAI failure.
5. **Provider recommendation** — exact match, distance, filters, fallback labels,
   rejected exclusion, and maximum five.
6. **Provider request handling** — selection, incoming request, accept/reject,
   ETA, and reassignment.
7. **Request tracking** — strict status transitions and refresh-safe rendering.
8. **AI 2 self troubleshooting** — supported/unsupported categories and engine
   controlled step transitions.
9. **Safety controls** — CAUTION confirmation, HIGH blocking, unsafe-condition
   stops, Not Sure, and no source-procedure exposure.
10. **Cost estimation** — valid LKR estimates, disclaimer, separate final cost.
11. **Reviews** — completed-only, one per request, rating validation and average.
12. **Authorization/security** — ownership, selected-provider-only actions,
    hidden scores/secrets/internals, and immutable AI fields.
13. **Failure handling** — AI 1 fallback versus fail-closed AI 2, empty provider
    results, backend/network errors, and optional OpenAI outage.

## Automated execution

```powershell
cd backend
npm run test:verbose

cd ..
python backend/ai/scripts/test_ai1_prediction.py
python -m unittest discover -s backend/ai/ai2/tests -v
python backend/ai/ai2/scripts/validate_ai2_knowledge.py
```

## Manual mobile/device checks

Use [mobile-manual-test-checklist.md](mobile-manual-test-checklist.md). Record the
device, operating system, backend address, date, and observed result. A compiler
or bundle pass does not substitute for physical-device interaction testing.

## Pass criteria

- No failed automated tests.
- Zero critical authorization or AI 2 safety failures.
- No secret, raw stack trace, score, or guessed repair-step exposure.
- Android production bundle completes.
- Demo seeder contains no destructive operation and remains idempotent.
