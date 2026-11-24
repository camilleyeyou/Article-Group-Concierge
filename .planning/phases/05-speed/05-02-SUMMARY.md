---
phase: 05-speed
plan: 02
subsystem: api
tags: [health-check, openrouter, preflight, instrumentation]
requires:
  - phase: 05-speed
    provides: CONCIERGE_CONFIG.health thresholds (05-01)
provides:
  - checkProviderHealth() and runStartupHealthCheck() in src/lib/provider-health.ts
  - generationModelId() in llm-config
  - provider field on admin /api/health
  - non-blocking startup health log
affects: [05-05, 05-09, 05-10]
tech-stack:
  added: []
  patterns: [one shared report-only health check used by route, startup and eval preflight]
key-files:
  created: [src/lib/provider-health.ts, eval/provider-health.test.ts]
  modified: [src/lib/llm-config.ts, eval/preflight.ts, src/app/api/health/route.ts, src/instrumentation.ts, next.config.js]
key-decisions:
  - "Spendable credit is the minimum of limit_remaining and effective_budget.remaining_usd; /api/v1/credits is not used (management key only)"
  - "OpenRouter slow/down/5xx/timeout only warns, never fails, so health never blocks chat"
  - "Preflight keeps its per-run minimum and original error messages; health warns below $5"
requirements-completed: []
duration: 25min
completed: 2026-11-23
---

# Phase 5 Plan 02: Provider Health Summary

**One tested checkProviderHealth() reports route, models, key validity and credit, and is reused by the admin /api/health route, a fire-and-forget startup log and the eval preflight.**

## Accomplishments
- `provider-health.ts` returns ok/warn/fail with a plain-language reason and never throws. 11 mocked-fetch tests cover every branch plus the preflight error message.
- `eval/preflight.ts` `checkOpenRouter` now delegates to the shared check and maps to the existing `PreflightError` messages.
- `/api/health` (admin-only) includes `provider`; the public `GET /api/chat` probe is untouched.
- `instrumentation.ts` runs the startup check unawaited and warms the catalogue memo; `instrumentationHook: true` added to next.config.js.

## Live check (free GET /api/v1/key, no model calls)
- Dev log: `[provider-health] WARN: OpenRouter credit $4.85 is below $5.00 (route openrouter, model anthropic/claude-sonnet-5.5)`
- `/api/health`: `warn openrouter anthropic/claude-sonnet-5.5` (credit $4.85 left)

## Task Commits
1. Task 1 checkProviderHealth and preflight reuse: b746c73
2. Task 2 health wired into /api/health and startup: 8217923

## Verification
- `npm run eval:test`: 152 pass, 0 fail
- `npx tsc --noEmit`: clean
- `npm run lint`: no warnings or errors

## Deviations from Plan
None - plan executed as written. (The preflight's non-ok-HTTP branch was simplified to `httpStatus !== null && key.valid !== true`, behaviourally equal to the plan's mapping.) `npm run eval:preflight` was not run because it also needs a dev server and Supabase; the preflight path is covered by the mocked test.

## Notes
- Credit is at $4.85, below the $5 warn line and the ~$3.50 per-eval-run cost leaves little headroom; top-up should be considered before Phase 5 eval runs.
- PERF-01..03 are intentionally not marked complete (pending phase verification).

## Known Stubs
None.

## Self-Check: PASSED
