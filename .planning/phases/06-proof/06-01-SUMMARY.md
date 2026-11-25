---
phase: 06-proof
plan: 01
subsystem: eval-harness
tags: [eval, held-out, guard, proof]
requires: []
provides:
  - "selectQueries(), isHeldOut(), loadQueriesFile() in eval/lib.ts"
  - "--proof opt-in for eval:run"
  - "HELD_OUT_ID_PATTERN in eval/subsets.ts"
affects: [06-02, 06-07]
tech-stack:
  added: []
  patterns: ["single query-selection entry point; held-out excluded by default"]
key-files:
  created: [eval/heldout.test.ts]
  modified: [eval/lib.ts, eval/run.ts, eval/subsets.ts, eval/generate.ts, eval/recall-offline.ts, eval/recall-bakeoff.ts, eval/teaser-probes.ts, eval/teaser-timing.ts, eval/stream-timing.ts, eval/make-suppression-fixture.ts]
decisions:
  - "Held-out queries are excluded in code (D-602), with no override flag on tuning tools; only eval:run --proof includes them"
  - "generate --force aborts if queries.json already holds held-out queries"
metrics:
  duration: 1min
  completed: 2026-11-24
requirements: [PROOF-01]
---

# Phase 6 Plan 01: Held-out query guard Summary

Code-level guard so the 25 held-out queries (plan 06-02) can live in `eval/queries.json` without any tuning tool ever seeing them; only `eval:run -- --proof` includes them.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 (TDD RED) | 92b8d6a | failing tests in eval/heldout.test.ts |
| 1 (GREEN) | 051acff | held_out field, selectQueries, --proof, HELD_OUT_ID_PATTERN |
| 2 | d6698f2 | all other queries.json consumers guarded; generate --force refuses |

## Verification

`npx tsx --test eval/*.test.ts`: 242 pass, 0 fail (10 new held-out tests). `npx tsc --noEmit -p .` clean. No paid calls.

## Deviations from Plan

None - plan executed as written. Behaviour note: with explicit `ids`, held-out ids without opt-in throw; `heldOutOnly` also counts as opt-in.

## Known Stubs

None.

## Self-Check: PASSED
