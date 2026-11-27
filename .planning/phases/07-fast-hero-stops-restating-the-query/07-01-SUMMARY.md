---
phase: 07-fast-hero-stops-restating-the-query
plan: 01
subsystem: eval
tags: [hero, restatement, detector, metrics, replay]
requires: []
provides:
  - "src/lib/hero-restatement.ts: detectHeroRestatement, HERO_RESTATEMENT_CONFIG, HERO_RESTATEMENT_VERSION, heroRestatementGuardEnabled"
  - "eval/hero-replay.ts: free replay over every saved run"
  - "hero_restates / hero_summary_missing / hero_restatement_guard_changes in METRIC_DEFS (report + compare)"
affects: [07-03 guard fallback, every later eval report]
tech-stack:
  added: []
  patterns: ["pure detector module with single env switch (same as output-guard)"]
key-files:
  created:
    - src/lib/hero-restatement.ts
    - eval/hero-restatement.test.ts
    - eval/hero-replay.ts
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-REPLAY.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-REPLAY.json
  modified:
    - eval/metrics.ts
    - eval/metrics.test.ts
decisions:
  - "Restatement = you_opener OR asking_frame OR verbatim_run (>= 6 shared consecutive words); overlap is informational only"
  - "Detector rules used exactly as planned; replay reproduced the planning simulation, no tuning needed"
metrics:
  duration: "~4 min"
  completed: 2026-11-26
---

# Phase 07 Plan 01: Hero restatement detector and before rate Summary

Pure, free detector (you-opener, asking-frame, 6-word verbatim run) for the HeroBlock challengeSummary, replayed over all saved runs (user-seen hero restates the query in 50/50 of 2026-11-26T05-24-15 vs 16/50 at baseline) and wired into every report as `hero_restates`.

## Tasks

| Task | Name | Commits | Files |
|---|---|---|---|
| 1 | Restatement detector, test-first | 3744ead (RED), d4d97d3 (GREEN) | src/lib/hero-restatement.ts, eval/hero-restatement.test.ts |
| 2 | Free replay over every saved run | 63e4687 | eval/hero-replay.ts, 07-HERO-REPLAY.md/.json |
| 3 | hero_restates metric | d742bb1 (RED), af67128 (GREEN) | eval/metrics.ts, eval/metrics.test.ts |

## Before rates (from 07-HERO-REPLAY.md)

| Run | Seen restates | Graded restates |
|---|---|---|
| 2026-11-20T15-12-31 (baseline) | 16/50 | 16/50 |
| 2026-11-25T14-30-56 (Phase 6 ref) | 50/50 | 14/50 |
| 2026-11-26T05-24-15 (06.1 confirm) | 50/50 | 50/50 |

Signal counts in 2026-11-26T05-24-15 (seen): you_opener 40, asking_frame 49, verbatim_run 18; mean overlap 0.53. These match the planning-time simulation exactly (50/50, 50/50, 16/50; fictional example not flagged).

Grader agreement in 2026-11-26T05-24-15: label 30, TP 30, FP 20, FN 0. Agreement in older runs is weak because the loose label regex mostly catches other repetition; it is informational (see Notes in the replay file).

## Verification

- `npx tsx --test eval/hero-restatement.test.ts`: 12/12 pass (incl. fictional-example and "Your partners" negatives, 5 vs 6 word threshold)
- `npm run -s eval:test`: 321/321 pass; `npm run -s type-check`: clean
- Free compare `2026-11-26T05-24-15 --against 2026-11-20T15-12-31`: `hero_restates (user-seen challengeSummary) | 50 | 16 | +34` — the 50 equals the replay's Seen restates figure
- compare.md restored from backup; `cmp` exits 0
- `find eval/results -type f -newer <marker>` lists nothing except `2026-11-26T05-24-15/compare.md`, whose content is byte-identical after restore (only its mtime changed, because the compare rewrote it before the restore). No other saved file was touched.
- No network, DB, or model calls; $0 spent.

## Deviations from Plan

None in behaviour. Small notes:
- The hero MetricDefs are placed right after `narrative_in_range` as specified. `computeHero` is exported as a helper.
- The baseline row's commit reads `6f16e6a` from its responses.json `git_commit` (STATE.md lists the baseline code as `a5b2722`); the replay reports what the file says.
- The 2026-10-27T13-38-48 run has no HeroBlock heroes, so it shows 0/0.

## Known Stubs

None. `hero_restatement_guard_changes` reads 0 until the guard rule lands in 07-03, by design.

## Self-Check: PASSED
