---
phase: 01-eval-improvements
plan: 03
subsystem: eval
tags: [grader, rubric, claims, frozen-baseline]
requires: ["01-01", "01-02"]
provides:
  - eval/rubric.ts shared rubric, schema and prompt builder (HARNESS_VERSION 2)
  - claim classification (goal_as_result, capability_not_shown, generated_tags, other)
  - assertWritableRunDir guard for the frozen baseline
  - gradeDir() callable by batch/regrade
affects: [01-05, 01-06]
tech-stack:
  added: []
  patterns: [rubric rules rendered from src/lib/concierge-config.ts]
key-files:
  created: [eval/rubric.ts, eval/rubric.test.ts]
  modified: [eval/lib.ts, eval/grade.ts]
key-decisions:
  - "Grader sees only query, retrieved context, automated checks and response"
  - "Old-harness (v1) grades are re-graded on resume"
requirements-completed: [EVAL-01, EVAL-02, EVAL-03, EVAL-04]
duration: 15min
completed: 2026-11-20
---

# Phase 1 Plan 03: Grader rubric rewrite Summary

The Opus grader now sees only what the app saw, classifies every unsupported claim by kind, reads its component-count and Strategy Lead rules from the shared app config, and cannot write into the frozen baseline.

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1. lib.ts types, Strategy Lead checks, baseline guard | 8b2c13b | CLAIM_KINDS, RunModels, strategy_lead_expected/offered, assertWritableRunDir |
| 2. eval/rubric.ts + tests | f988039 | 8 tests; no persona/expected/type leakage |
| 3. grade.ts switch + smoke grade | f75a8a2 | gradeDir(), judge route/harness version recorded |

## Verification

- `npx tsc --noEmit` clean; `npm run eval:test` 31 pass, 0 fail.
- Smoke grade of p3-q04 and p5-q01 via OpenRouter (about $0.10): `SMOKE-OK anthropic/claude-opus-5.5 openrouter`; smoke directory deleted afterwards.
- `npm run eval:grade -- --dir eval/results/2026-11-20T15-12-31` refuses with the frozen-baseline message; baseline hashes unchanged (responses 510398ae1121, grades d216aeafec96).

## Deviations from Plan

None in behaviour. Minor: the grade.ts header comment was reworded so `grep -ci persona eval/grade.ts` returns 0, as the acceptance criterion requires.

## Known Stubs

None.

## Self-Check: PASSED
