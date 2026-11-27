---
phase: 07-fast-hero-stops-restating-the-query
plan: 06
subsystem: planning-close
tags: [hero, guard, eval, squash, deploy]
requires: [07-05]
provides: [phase outcome record, single squashed phase commit, push + deploy check + live smoke]
affects: [STATE, ROADMAP, REQUIREMENTS, 07-SPEND]
key-files:
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-SPEND.md
decisions:
  - "Phase 7 closed with gaps: 11 of 12 phase bars and 5 of 7 ready bars pass; PRIMARY pre-guard restatement 0/50 PASS"
  - "User chose squash, push, deploy check and live smoke (~$0.07)"
metrics:
  completed: 2026-11-27
  duration: 30min
---

# Phase 7 Plan 06: Outcome record, squash, push and smoke Summary

Recorded the Phase 7 outcome (the fast hero no longer restates the query: 0/50 pre-guard, was 50/50) and squashed Phase 7 into one commit on top of be92924 for push.

## Outcome

Full-50 run `2026-11-27T15-32-13-merged` (code 3397c63; 38 ok records from `2026-11-27T15-32-13` + 12 re-run ids from `2026-11-27T16-30-42`). Trial `2026-11-27T15-22-37`: GO, 0/10 restates.

Pre-guard restatement (PRIMARY): 0/50 PASS; post-guard hero_restates 0/50; guard removed 0 summaries, trimmed 0.

| Metric | Baseline 2026-11-20T15-12-31 | 2026-11-26T05-24-15 | New |
|---|---|---|---|
| hero_restates | 16 | 50 | 0 |
| voice | 3.92 | 4.06 | 4.58 |
| unsupported-claim responses | 22 | 7 | 9 |
| goal_as_result | n/a | 2 | 1 |
| grounded | 4.44 | 4.82 | 4.78 |
| recall | 75% | 92% | 92% |
| median t_hero_first | n/a | 3.5 s | 3.7 s |
| median t_hero_done | n/a | 4.2 s | 4.4 s |

- Phase bars 11/12 (miss: unsupported-claim responses 9 > 7, none hero-sourced). Ready bars 5/7 (misses: unsupported-claim responses 9 > 4, goal_as_result 1 > 0; voice now PASS).
- Guard replay 450 changes, 0 false positives; live hero_restatement changes 0/50.
- Residual risk: on the stream route a hero summary removed by the guard is visible for a few seconds until `final` arrives (no buffering, PERF-02).
- Spend $6.08; credit left $3.83 before the live smoke.

## STATE frontmatter values

- `grep -c "^### Phase " .planning/ROADMAP.md` = 8 -> total_phases 8 (unchanged)
- `find .planning/phases -name "*-PLAN.md" | wc -l` = 69; total_plans was already 69 (includes Phase 7), unchanged
- `find .planning/phases -name "*-SUMMARY.md" | wc -l` = 69 with this file -> completed_plans 69
- completed_phases 7 -> 8, following how 06.1 (also closed with gaps) was counted as complete

## Push decision

User chose "Squash, push, deploy check and live smoke" (2026-11-27). Push, deploy and smoke results are recorded below after the push.

## Deviations from Plan

- completed_phases incremented although the phase closed with gaps, because 06.1 (closed with gaps) was counted that way; the plan text allowed either reading.
- Phase files beyond the plan's list (eval/lib.ts, eval/merge-runs.ts, eval/merge-runs.test.ts, eval/report.ts, added in 07-05) are included in the squash, since they are Phase 7 work.
