---
phase: 07-fast-hero-stops-restating-the-query
plan: 04
subsystem: eval
tags: [hero, trial, spend, HERO-04]
requires:
  - phase: 07-02
    provides: v2 hero instruction
  - phase: 07-03
    provides: hero restatement guard + reviewed replay
provides:
  - "phase7-hero 10-id subset (eval/subsets.ts)"
  - "07-SPEND.md ledger with readiness, trial approval and trial row"
  - "07-TRIAL.md: trial metrics vs same ids, guard review, GO/NO-GO (GO)"
affects: [07-05]
tech-stack:
  added: []
  patterns: [free readiness check + written spend proposal before any paid run]
key-files:
  created:
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-SPEND.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-TRIAL.md
  modified:
    - eval/subsets.ts
    - eval/subsets.test.ts
key-decisions:
  - "Trial GO: pre-guard hero restatements 0/10 (same ids 10/10 before), guard fired on no hero, all 9 fixed criteria pass; full-50 (07-05) still needs its own approval"
requirements-completed: []
metrics:
  duration: ~25min (Task 2-3 continuation)
  completed: 2026-11-27
---

# Phase 07 Plan 04: 10-query hero trial Summary

The v2 hero instruction removed restatement on the 10 trial queries: 0/10 heroes restate, against 10/10 on the same ids in 2026-11-26T05-24-15. The guard didn't need to fire, and claims and timing held. Trial result: GO for proposing the full-50 run. The trial cost $0.47 (credit went from $9.91 to $9.44).

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1a | phase7-hero subset + test | 842d81c | eval/subsets.ts, eval/subsets.test.ts |
| 1b | Readiness check + spend proposal | 42ecb0c | 07-SPEND.md |
| 2 | User decision | (checkpoint) | user replied "run" on 2026-11-27 |
| 3 | Trial run, compare, GO/NO-GO | f56ad8b | 07-SPEND.md, 07-TRIAL.md |

## Trial

- Run `eval/results/2026-11-27T15-22-37` (batch `batch-2026-11-27T15-22-36`), 10 ok, 0 errors, no retries, query_count 10, held_out 0, proof false. Sonnet 5.5 generated the answers and Opus 5.5 judged them, with no second grader
- Same-id deltas: voice 3.70 -> 4.00, grounded 4.60 -> 4.90, cta 4.80 -> 4.50, unsupported-claim responses 3 -> 1 (one narrative `other` claim on p4-q04), hallucinations 0, median t_hero_done 4.18 -> 4.33 s
- Guard review: the guard changed no hero, so there were 0 false positives. Two other guard rules fired outside the hero (an order_of_work rewrite and a retrieval_leak drop)
- GO/NO-GO: all 9 criteria pass (the plan's list, with hallucinations, capability_not_shown and invention_bait counted as separate rows)

## Deviations from Plan

- None in execution. One wording note: the plan says "8 criteria rows" but the criteria fixed in 07-SPEND.md before the run list 9 (the zero-claim checks are split into separate rows). 07-TRIAL.md uses those 9.

## Known Stubs

None.

## Self-Check: PASSED
