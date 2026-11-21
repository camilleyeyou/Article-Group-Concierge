---
phase: 01-eval-improvements
plan: 04
subsystem: eval
tags: [eval, metrics, report, baseline-comparison]
requires:
  - phase: 01-eval-improvements (plan 03)
    provides: classified claims, harness_version, FROZEN_BASELINE_ID, assertWritableRunDir
provides:
  - computeRunMetrics, METRIC_DEFS, summarize, median, findRegradeDir
  - writeReport(dir) with models header, claims-by-kind section, baseline comparison table
affects: [01-05 regrade, 01-06, 01-07, later phases that report deltas]
tech-stack:
  added: []
  patterns: [single metrics module shared by report and comparisons]
key-files:
  created: [eval/metrics.ts, eval/metrics.test.ts]
  modified: [eval/report.ts]
key-decisions:
  - "Median latency uses the standard median (20.1 s for the baseline); the frozen notes' 20.2 s used the upper middle value"
  - "Per-claim counts come from invented_claims for every harness; kinds only when all graded records carry `claims`"
requirements-completed: [EVAL-02, EVAL-07]
duration: 15min
completed: 2026-11-20
---

# Phase 1 Plan 04: Metrics Module and Report Sections Summary

**Shared `computeRunMetrics` for old and new harness grades, plus a report with route/model header, unsupported claims by kind, and a frozen-vs-re-graded-vs-this-run delta table.**

## Accomplishments
- `eval/metrics.ts`: summarize (sample SD), median, computeRunMetrics, METRIC_DEFS (17 metrics), findRegradeDir. Recall, strict fallback, metrics-not-in-context and Strategy Lead are recomputed from responses with current code.
- `eval/metrics.test.ts`: 8 tests (TDD, RED commit first), fixtures in os.tmpdir().
- `eval/report.ts`: `writeReport(dir)` guarded by `assertWritableRunDir`; header shows route, generation, embedding and judge model (or "not recorded"); `## Unsupported claims by kind`; `## Comparison with baseline` with both deltas; CSV gains `claim_kinds` and `strategy_lead_expected_offered`.

## Task Commits
1. Task 1 RED: `9b7569c` (tests)
2. Task 1 GREEN: `ffe43cf` (metrics.ts)
3. Task 2: `0a728f8` (report.ts)

## Verification
- `npm run eval:test`: 39 pass, 0 fail; `tsc --noEmit` clean.
- Baseline via computeRunMetrics: `4.44 3.92 22 38 39/52 20.1 null` as expected.
- Scratch copy report (deleted afterwards) contained the required headings, the `| grounded | 4.44 | – | 4.44 | +0.00 | – |` row, "38 claims in 22 responses", `Route: not recorded`, and the `claude-opus-5-5` judge line.
- Report on the frozen baseline exits 1 with the read-only message; baseline file hashes unchanged (report.md still `5d8fa6f210bb`).

## Deviations from Plan
None in behaviour. Definitional note: median latency is 20.1 s (standard median of 50 values), not the 20.2 s in the frozen notes (upper middle value). Delta rows for latency therefore read 20.1 s on both sides.

## Known Stubs
None.

## Issues Encountered
A pre-tool hook asked for a rollback statement before the scratch-dir `rm -rf`; provided and the delete proceeded.

## Next Phase Readiness
Plan 05 can produce the re-graded baseline copy (`regrade_of` set) and the report will pick it up automatically via `findRegradeDir`. No paid API calls were made.

## Self-Check: PASSED
