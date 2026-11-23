---
phase: 04-generation
plan: 02
subsystem: eval-tooling
tags: [eval, smoke-subset, compare, D-416]
requires: [04-01]
provides:
  - eval/subsets.ts (PHASE4_SMOKE_IDS, SUBSETS, resolveIds)
  - --ids / --subset flags on eval:run and eval:batch with subset-scaled credit preflight
  - npm run eval:compare (metrics on common ids for two or more runs)
  - model_raw_response in run records
affects: [04-04 lib.ts, 04-05 smoke runs]
key-files:
  created: [eval/subsets.ts, eval/subsets.test.ts, eval/compare-ids.ts]
  modified: [eval/run.ts, eval/batch.ts, eval/lib.ts, eval/README.md, package.json]
key-decisions:
  - "Compare uses filtered temp copies of responses/grades so old run dirs are never touched"
metrics:
  duration: 15min
  completed: 2026-11-22
---

# Phase 4 Plan 02: Smoke subset and compare tooling Summary

Phase 4 now has a cheap iteration loop: `npm run eval:batch -- --runs 1 --subset phase4-smoke` runs 21 queries (~$1.80), and `npm run eval:compare -- --dir <run> --against <gap run>` gives like-for-like deltas on the same ids.

## Commits
- c70c61f: --ids/--subset selection in eval run and batch, model_raw_response captured
- d6557c8: eval:compare script, package.json script, README docs

## Verification
- `npm run eval:test`: 95 pass, 0 fail (2 new subset tests)
- `npx tsc --noEmit -p .` and `npm run lint`: clean
- Free offline check: compare of 2026-11-22T13-42-12 vs 2026-11-22T11-56-17 wrote a full metrics table (50 common ids); compare.md removed afterwards. No paid calls made.

## Deviations from Plan
None - plan executed as written.

## Notes
- Requirements GEN-01/02/04/05/06 are listed in plan frontmatter but this plan only delivers tooling, so none were marked complete.
- eval/lib.ts: only the one-line `model_raw_response` addition; 04-04 must keep it.

## Known Stubs
None.

## Self-Check: PASSED
