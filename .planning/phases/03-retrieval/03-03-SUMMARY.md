---
phase: 03-retrieval
plan: 03
subsystem: eval-harness
tags: [eval, metrics, recall, report]
requires:
  - phase: 03-retrieval
    provides: eval/labels.ts isDisputed, GenerationUsage type (03-02)
provides:
  - RunRecord catalogue / catalogue_version / usage / search_function captured from debug payload
  - recall_pct_corrected, shown_recall_pct, teasers_zero_expected_mean, prompt_cache_hits metrics
  - Report lines for disputed labels, shown recall, teaser padding, cache hits, search function
affects: [03-05, 03-06, 03-10]
key-files:
  modified: [eval/lib.ts, eval/run.ts, eval/metrics.ts, eval/report.ts, eval/metrics.test.ts]
key-decisions:
  - "Frozen recall_pct definition untouched; corrected recall is a separate row"
  - "Missing values print 'n/a' (existing formatValue behaviour), not a dash"
requirements-completed: []
duration: ~15min
completed: 2026-11-22
---

# Phase 3 Plan 03: Eval measurement Summary

**The harness now records usage/catalogue/search function from the debug payload and reports corrected recall (excluding 3 disputed labels), shown recall, teaser padding and prompt-cache hits.**

## Baseline values of the new metrics
Identical for the frozen run (2026-11-20T15-12-31) and the re-graded run (same responses):

| Metric | Value |
|---|---|
| recall_pct | 39/52 (75%) |
| recall_pct_corrected | 39/49 (80%); 3 disputed pairs excluded, all were misses |
| shown_recall_pct | 39/52 (75%) |
| teasers on zero-expected queries | mean 3.85 (n=20) |
| teasers, all queries | mean 3.88 |
| prompt_cache_hits | n/a (no usage recorded) |
| search function | not recorded |

## Verification
- `npm run eval:test`: 64 tests, 64 pass, 0 fail (2 new)
- `npx tsc --noEmit -p .`: clean
- Report rendered against a scratch copy of Phase 2 run 2026-11-21T21-15-13 (in $TMPDIR); all new lines and table rows present. No file under eval/results changed.

## Task Commits
1. Task 1, metrics and record fields: `a6877ff`
2. Task 2, report: `371bd90`

## Deviations from Plan
None in code. Note: `formatValue` already prints `n/a` for null, so no change was needed.

## Notes
- run.ts console warns when a record's search_function is not hybrid_search_v2; this stays noisy until 03-05 adds the debug field.
- RETR-04/05/06 remain pending; they are proven by the phase-end eval.

## Known Stubs
None.

## Self-Check: PASSED
