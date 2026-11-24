---
phase: 05-speed
plan: 09
subsystem: eval
tags: [eval, speed, streaming, perf, d-513]
requires: [05-06, 05-07, 05-08]
provides:
  - 05-EVAL-DELTA.md with PERF-01/PERF-02 (provisional) and D-513 verdicts
  - generation mode reverted to default
affects: [05-10]
key-files:
  created: [.planning/phases/05-speed/05-EVAL-DELTA.md]
  modified: [src/lib/concierge-config.ts]
decisions:
  - "D-513 regressed on 4 gates under adaptive_effort:low; mode reverted to default (unmeasured)"
  - "PERF-01/PERF-02 local FAIL is provisional (distance-inflated); final verdict by production smoke in 05-10"
metrics:
  completed: 2026-11-23
  eval_cost_usd: 3.73
---

# Phase 5 Plan 09: Phase-end eval and verdict Summary

One full streaming-path eval (run `2026-11-23T19-00-37`, $3.73, 50/50 ok, Opus only) showed local speed misses (t_teasers median 2331 ms vs 1500; t_hero_first median 4166 ms vs 4000, both provisional) and a D-513 quality regression under `adaptive_effort:low` (4 gates failed), so the mode was reverted to `default`.

## Tasks

| Task | Status |
|---|---|
| 1 UI check and go/no-go | User approved the paid run (option `run`). The UI human check is NOT done; recorded as pending. Health curl and startup log line were not captured. |
| 2 Full eval | Done by the orchestrator before this session; credit $29.45 to $25.72, batch cost_usd $3.73. |
| 3 Verdict | 05-EVAL-DELTA.md written; revert applied. |

## Commits

- a83b0ba fix(05-09): revert generation mode to default after D-513 regression
- (follow-up) docs(05-09): correct failed-gate count in config comment
- (follow-up) docs(05-09): phase 5 eval delta

## Deviations

- Commit a83b0ba's comment initially said "5 gates"; actual is 4. Amend was blocked by a permission hook, so a follow-up commit corrected the comment (no workaround).
- The plan's acceptance expected p4-q03 among missed fallback ids; in this run it is not a fallback query (context judged relevant), so it is not listed as missed.
- The 05-09 "run folder newer than TIMING" and EVAL_SECOND_GRADER guard checks were done by the orchestrator, not re-verified here.

## Pending for the user

UI check queries (cybersecurity clients; Wiz CNAPP bait), reduced-motion check, owner view on the teaser-grid shift (D-503), PERF-03 health capture, and the 05-10 production smoke for the final speed verdict. The revert to `default` is unmeasured.

## Self-Check: PASSED
