---
phase: 01-eval-improvements
plan: 07
subsystem: eval
tags: [eval, regrade, delta, second-grader, squash]
requires:
  - phase: 01-eval-improvements (plan 06)
    provides: eval:batch, eval:regrade, eval:grade2
provides:
  - Re-graded baseline (harness v2) as the like-for-like reference for Phases 2-6
  - Run-to-run noise estimate (2 fresh runs)
  - Second-grader agreement score (97% within 1 of Opus)
  - 01-EVAL-DELTA.md
affects: [phase-2, phase-3, phase-4]
key-files:
  created: [.planning/phases/01-eval-improvements/01-EVAL-DELTA.md]
  modified: [.planning/STATE.md, .planning/ROADMAP.md]
key-decisions:
  - "Second grader = openai/gpt-5.6-sol via OpenRouter"
  - "Default N = 1; phase ends use N = 2-3"
  - "Median latency uses the standard median (20.1 s for the frozen run)"
requirements-completed: [EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-07]
completed: 2026-11-21
---

# Phase 1 Plan 07: Phase-end eval, delta report and squash Summary

**Re-graded the frozen baseline under harness v2, ran 2 fresh runs with a second grader, and wrote the delta report; Phase 1 is one squashed commit.**

Status: Pushed: pending user approval (Task 4).

## Headline deltas

- Harness effect (same responses): grounded 4.44 to 3.92, cta 4.36 to 4.94, unsupported claims 38 to 113 (69 are generated_tags). This is a stricter measurement, not an app change.
- Fresh runs vs re-graded baseline (app unchanged): grounded 3.89 vs 3.92 (SD 0.16), voice 4.11 vs 4.08, responses with unsupported claims 40.5 vs 42, recall 75% vs 75%, median latency 19.6 s vs 20.1 s.
- Hallucinations: 1 in run 1 (p4-q09, HHMI invention bait), 0 in run 2 and in the re-graded baseline.
- Second grader: 97% of scores within 1 of Opus; grounded is the weakest criterion (exact 60%).

## Runs and cost

Re-graded baseline `2026-11-21T07-32-49-regrade` ($2.09); fresh runs `2026-11-21T07-38-07`, `2026-11-21T08-04-22`; batch `batch-2026-11-21T07-38-07` ($8.83). Total $10.92; credit $45.24 before, $34.18 after. Baseline `2026-11-20T15-12-31` hashes unchanged. See 01-EVAL-DELTA.md.

## Deviations

None. Note: the batch aggregate prints count rows rounded to integers (e.g. 0.5 shows as 1); exact values are in 01-EVAL-DELTA.md. Left for a later phase.

## Recovery

Pre-squash HEAD: 48583ef5f077e8189f8a4229ee8737b2a94973bf.
