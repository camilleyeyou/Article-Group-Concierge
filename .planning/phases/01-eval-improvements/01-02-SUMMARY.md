---
phase: 01-eval-improvements
plan: 02
subsystem: eval
tags: [eval, numbers, metrics, tdd]
requires: []
provides:
  - eval/numbers.ts (extractQuantities, sameQuantity, metricValueInContext)
  - npm run eval:test (tsx --test eval/*.test.ts)
affects: [01-03 rubric (grader-side number equivalence)]
tech-stack:
  added: []
  patterns: [pure no-import eval modules tested with node:test via tsx]
key-files:
  created:
    - eval/numbers.ts
    - eval/numbers.test.ts
  modified:
    - eval/lib.ts
    - package.json
key-decisions:
  - "Quantities compare on unit and value (0.5% tolerance); number-free metric values fall back to normalised substring"
patterns-established:
  - "Baseline responses.json is read-only; verify checks against it without writing (sha256 510398ae1121 unchanged)"
requirements-completed: [EVAL-01]
duration: ~10 min
completed: 2026-11-20
---

# Phase 1 Plan 02: Number Normalisation Summary

The deterministic `metrics_not_in_context` check now compares quantities instead of substrings, so "8M+" matches "over 8 million" while "9M" or "40%" vs "40 new markets" are still flagged.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 RED: failing tests | 181e107 | 17 tests, module missing, failed as expected; adds `eval:test` script |
| 1 GREEN: eval/numbers.ts | 110f4ad | 17/17 pass, no imports |
| 2: wire into runAutomatedChecks | 280f388 | Baseline check prints `[]` |

## Verification

- `npm run eval:test`: 23 pass, 0 fail (17 new plus 6 from plan 01)
- `npx tsc --noEmit`: exit 0
- Read-only run of `runAutomatedChecks` over the frozen baseline returns no `metrics_not_in_context` flags (baseline had one: p3-q04 "8M+")
- Baseline `responses.json` sha256 still starts `510398ae1121`
- No paid API calls made

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED
