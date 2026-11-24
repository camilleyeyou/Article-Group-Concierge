---
phase: 05-speed
plan: 08
subsystem: generation
tags: [timing, thinking-mode, perf-02, openrouter]
requires:
  - phase: 05-speed
    provides: stream-timing.ts, stream-smoke.ts (05-07), generation config knob (05-01), stream route (05-05)
provides:
  - 05-TIMING.md (timings, pass-through and cache evidence, decision)
  - generation mode set to adaptive_effort:low in concierge-config.ts
affects: [05-09]
key-files:
  modified: [src/lib/concierge-config.ts]
  created: [.planning/phases/05-speed/05-TIMING.md]
key-decisions:
  - "adaptive_effort:low chosen: median t_hero_first 1438 ms vs 2181 (between_tools) and 12299 (default); cache read 12160 intact; pass-through confirmed"
requirements-completed: []
completed: 2026-11-23
---

# Phase 5 Plan 08: Thinking-mode timing Summary

**Timed default, between_tools and adaptive_effort:low through the real streaming path; adaptive_effort:low cuts median hero-first from 12.3 s to 1.4 s with the prompt cache intact, so it is now the configured mode pending the D-513 eval in 05-09.**

| Mode | t_hero_first ms | t_complete ms | Output tokens | cache_read | Cost |
| --- | --- | --- | --- | --- | --- |
| default | 12299 | 15955 | 2146 | 12160 | 0.0332 |
| between_tools | 2181 | 8797 | 1208 | 12159 | 0.0247 |
| adaptive_effort:low | 1438 | 8154 | 1231 | 12160 | 0.0240 |

Route smoke (local, mode adaptive_effort:low): suppressed 5.7 s, hero 7.2 s, final 14.3 s, no debug event. First hero is dominated by cold retrieval (~3-5 s).

## Commits
- 4c3bfa7 feat(05-08): set generation thinking mode from timing run

## Spend
About $0.37 total (timing $0.257, two smokes ~$0.03 each); credit $29.85 to $29.48.

## Deviations from Plan
- Ran two smoke calls instead of one: the first (mode default) output was only captured at its tail, so I repeated it after the config change to record teasers/suppressed before hero. Within budget.
- PERF-02 RISK recorded: projected hero-first 1438 + 3655 retrieval = ~5.1 s > 4 s. No gate changed; reported for 05-09.

## Known Stubs
None.

## Self-Check: PASSED
eval:test 208/208, tsc clean, lint clean, config/equivalence tests 28/28; 05-TIMING.md and commit 4c3bfa7 exist; dev server stopped.
