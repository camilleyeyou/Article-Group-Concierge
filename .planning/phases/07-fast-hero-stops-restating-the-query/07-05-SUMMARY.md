---
phase: 07-fast-hero-stops-restating-the-query
plan: 05
subsystem: eval
tags: [hero, full-50, spend, merge, HERO-04]
requires:
  - phase: 07-04
    provides: trial GO, spend ledger
provides:
  - "eval/merge-runs.ts (+ test): merge a partial run with a re-run of its failed ids, sources recorded in merged_from"
  - "eval/results/2026-11-27T15-32-13-merged: full original-50 result (38 + 12)"
  - "07-EVAL-DELTA.md: deltas vs 2026-11-20T15-12-31 and 2026-11-26T05-24-15, phase and ready bars"
affects: [07-06]
tech-stack:
  added: []
  patterns: [merge failed-id re-run into partial run instead of paying for a second full run]
key-files:
  created:
    - eval/merge-runs.ts
    - eval/merge-runs.test.ts
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-EVAL-DELTA.md
  modified:
    - eval/lib.ts
    - eval/report.ts
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-SPEND.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-REPLAY.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-REPLAY.json
key-decisions:
  - "Full-50 result is a merge of two same-commit sessions (38 + 12 re-run after a network outage), user-approved"
  - "Hero v2 prompt removes restatement on its own: hero_restates 0/50 pre-guard, guard hero changes 0"
  - "Phase bars 11/12 (unsupported-claim responses 9 > 7, none hero-sourced); ready bars 5/7 (voice 4.58 passes, unsupported 9 > 4 and goal_as_result 1 > 0 miss)"
requirements-completed: [HERO-04]
metrics:
  duration: ~45min (continuation, Task 3)
  completed: 2026-11-27
---

# Phase 07 Plan 05: full original-50 run Summary

The v2 fast-hero instruction removes query restatement across the full 50: 0/50 heroes restate before or after the guard, against 50/50 in 2026-11-26T05-24-15, and the guard never had to fire on a hero. Voice rose from 4.06 to 4.58, which now passes the 4.5 ready bar. Unsupported-claim responses went from 7 to 9/50, all from the narrative or teaser and none from the hero, so the phase misses 1 of its 12 bars. The 50-query result is a merge of two same-commit sessions because a network outage broke 12 queries in the first one.

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Full-50 proposal | 3397c63 | 07-SPEND.md |
| 2 | User decision | (checkpoint) | "run" (2026-11-27); after the stop rule fired, "re-run only the 12 failed ids once and merge" |
| 3a | Merge script + test | 631e4d3 | eval/merge-runs.ts, eval/merge-runs.test.ts, eval/lib.ts, eval/report.ts |
| 3b | Re-run, ledger, compare x2, trace, hero replay, guard replay, delta | 14eedb8 | 07-SPEND.md, 07-EVAL-DELTA.md, 07-HERO-REPLAY.* |

## Runs and spend

- First session `2026-11-27T15-32-13`: 38/50 ok, 12 `fetch failed` errors (network outage 15:36:40-15:37:20Z), $4.66. The stop rule fired and was reported. No retry
- Re-run `2026-11-27T16-30-42` (batch-2026-11-27T16-30-40): 12/12 ok, $0.95, credit $4.78 -> $3.83
- Merged `2026-11-27T15-32-13-merged`: 50/50 ok, graded by Opus 5.5 (harness v4)
- Phase 07 total: $6.08. Credit left: $3.83

## Key results (merged)

- voice 4.58 (+0.52 vs 05-24-15), grounded 4.78, components 4.62, fallback 4.96, cta 4.88, hallucinations 0
- unsupported-claim responses 9 (goal_as_result 1, other 8), by source: narrative 8, teaser 2, hero 0. Hero gap 0/50
- recall 92% (corrected 98%), narrative_in_range 50/50
- median t_hero_first 3.68 s, t_hero_done 4.40 s. Both pass, but the 12 re-run ids were about 2x slower. The first-session 38 alone give 3.28 s and 4.07 s

## Deviations from Plan

**1. [Rule 3 - Blocking] One full-50 became two merged sessions**
- **Found during:** Task 3 step 2
- **Issue:** a local network outage made 12 queries fail, so the stop rule fired
- **Fix:** with explicit user approval, re-ran only the 12 ids once ($0.95). Added `eval/merge-runs.ts` to build one 50-query dir. It enforces the same commit, models and harness, replaces only failed records, and never writes to the source dirs. The report is regenerated through `writeReport`, with a "Merged from" header line
- **Files modified:** eval/merge-runs.ts, eval/merge-runs.test.ts, eval/lib.ts (`merged_from`), eval/report.ts (header line)
- **Commit:** 631e4d3
- The plan expected a `batch.json` for the full run. The first session has none because its post-run credit check timed out, so its credit was read with preflight

**2. [Rule 3] guard-saved output path**
- `eval/guard-saved.ts --dir` writes into the run dir by default (`guard-replay.*`), so the 06.1 phase files were not touched

## Known Stubs

None.

## Self-Check: PASSED
