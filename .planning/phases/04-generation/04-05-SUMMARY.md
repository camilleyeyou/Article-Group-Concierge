---
phase: 04-generation
plan: 05
subsystem: eval-smoke
tags: [smoke, prompt, eval, D-416]
requires: [04-02, 04-03, 04-04]
provides:
  - 04-SMOKE.md with SMOKE VERDICT GO WITH GAPS
key-files:
  modified: [src/lib/orchestrator.ts, eval/prompt.test.ts, .planning/phases/04-generation/04-SMOKE.md]
key-decisions:
  - "One prompt revision between rounds: narrative must not restate the StrategyCard; no inferred principle/scope/deliverable"
metrics:
  duration: 25min
  completed: 2026-11-22
---

# Phase 4 Plan 05: Smoke Summary

Two smoke rounds on the 21-query phase4-smoke subset: claims fell from 13 (gap run) to 3 and 4, Strategy Lead 11/11, narrative in range 20/21, no hallucination, layout or recall regression. Verdict: GO WITH GAPS (see 04-SMOKE.md).

## User approval
Task 2 option id `two-rounds` -- "Up to two rounds (max ~$4) (Recommended)". Credit before $15.97.

## Runs
| Round | Run id | cost_usd | Credit after |
|---|---|---|---|
| 1 | 2026-11-22T22-17-35 | 1.65 | 14.32 |
| 2 | 2026-11-22T22-28-23 | 1.71 | 12.28 |

Total $3.36. Run directories created: 2 (plus 2 batch dirs). Nothing pushed.

## Deviations
- The plan says to stop the dev server at the end; the orchestrator instruction to leave it running took precedence.
- GEN requirements not marked complete (04-06 full eval confirms them).

## Commits
- c6a9627: smoke results and prompt tweak

## Self-Check: PASSED
