---
phase: 01-eval-improvements
plan: 01
subsystem: eval
tags: [config, prompt, eval-debug, openrouter]
requires: []
provides:
  - src/lib/concierge-config.ts shared rules (layout, follow-ups, Strategy Lead trigger)
  - debug.models = { route, generation, embedding } in /api/chat eval debug payload
affects: [01-03 rubric, 01-04 report]
tech-stack:
  added: []
  patterns: [prompt rules rendered from a shared config module; node:test via tsx]
key-files:
  created:
    - src/lib/concierge-config.ts
    - eval/concierge-config.test.ts
  modified:
    - src/lib/orchestrator.ts
    - src/lib/llm-config.ts
    - src/app/api/chat/route.ts
key-decisions:
  - "Keep current Strategy Lead rule (offerOn: ['no_context']); Phase 4 expected to extend it"
patterns-established:
  - "SYSTEM_PROMPT sha256 408483f1...286b is the guard for behaviour-neutral prompt refactors"
requirements-completed: [EVAL-04, EVAL-07]
duration: ~10 min
completed: 2026-11-20
---

# Phase 1 Plan 01: Shared Concierge Config Summary

One shared config module now renders the app prompt's component-count, follow-up and Strategy Lead rules with the prompt byte-identical, and eval debug responses report the provider route and model IDs actually used.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 RED: failing test | 45bffbd | Module missing, test failed as expected |
| 1 GREEN: config + orchestrator refactor | 666d241 | 6/6 tests pass, prompt hash unchanged |
| 2: debug model reporting | 129bef9 | `providerRoute()`, `GENERATION_MODEL`, `debug.models` |

## Verification

- `npx tsx --test eval/concierge-config.test.ts`: 6 pass, 0 fail
- `npx tsc --noEmit`: clean
- SYSTEM_PROMPT sha256 verified before and after: 408483f12f864bd614c77e9b85277aee8bd3a78ff22bf21647bc80b5bfde286b
- EVAL_DEBUG gate unchanged; public (non-debug) response unchanged. No paid API calls made.

## Deviations from Plan

None - plan executed as written. The `GENERATION_MODEL` export (Task 2) was kept out of the Task 1 commit to keep commits atomic.

## Known Stubs

None.

## Self-Check: PASSED
