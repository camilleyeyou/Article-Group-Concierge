---
phase: 06-proof
plan: 09
subsystem: deploy
tags: [deploy, vercel, squash, timing-skipped]
requires: ["06-04", "06-07", "06-08"]
provides:
  - Phase 6 code on production (b50bb0c)
  - eval/timing-batches.json (fixed, unused)
affects: [06-10, 06-11, 06-12]
key-files:
  created: [eval/timing-batches.json, .planning/phases/06-proof/06-DEPLOY.md]
  modified: [.planning/phases/06-proof/06-SPEND.md, .planning/STATE.md]
decisions:
  - "User chose option-a: squash Phase 6 into one commit and push"
  - "Timing batches and dry batch skipped by user decision (budget, $17.70 credit)"
metrics:
  completed: 2026-11-25
---

# Phase 6 Plan 09: Proof code to production Summary

Phase 6 was squashed to one commit (b50bb0c) and pushed to main. The Vercel production deploy (dpl_8ngJFmZTiiz6aYrcAfARAjFJWXKM) is Ready, and one live stream smoke passed. The timing parts were skipped by user decision.

## Tasks

| Task | Result | Commit |
|------|--------|--------|
| 1 Pre-deploy checks, timing batches | 271/271 tests, tsc clean, build ok; PERF_TIMING set, EVAL_DEBUG not set; batches written | 9e65282 |
| 2 Deploy decision | option-a (squash + push), live smoke approved | n/a |
| 3 Deploy and smoke | squash b50bb0c pushed fast-forward; deploy Ready; smoke ok; dry timing batch skipped | b50bb0c |

## Deviations from Plan

**Scope change (user, 2026-11-25):** the dry timing batch, the counted timing batches and the production timing request were skipped (budget). The Task 3 acceptance checks for the dry-batch timing.json and the 06-SPEND dry-batch row do not apply. 06-SPEND.md records $0 and the skip. The speed bar will be reported from existing production PERF measurements. Plan 06-10 will not run, so PROOF-01 is not met.

PERF_TIMING is being switched off in Vercel by the user. This plan did not change it.

## Verification

- Tree check before commit: `git write-tree` equals the 9e65282 tree (d5de4b8c). Rollback point is 9e65282.
- Live smoke (p1-q03, original well_formed, no debug): teasers first, hero, component and final events, no `event: debug`.

## Known Stubs

None.

## Self-Check: PASSED
