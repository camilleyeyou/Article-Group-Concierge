---
phase: 01-eval-improvements
plan: 05
subsystem: eval
tags: [eval, preflight, batch, aggregate, regrade]
requires:
  - phase: 01-eval-improvements (plan 04)
    provides: computeRunMetrics, METRIC_DEFS, summarize, findRegradeDir, writeReport
provides:
  - runPreflight (Supabase, OpenRouter key and credit, dev server) and eval:preflight
  - runEval exported from run.ts; runs record route and generation/embedding model IDs
  - regradeRun and eval:regrade (grades a copy, never the source)
  - aggregateRuns and eval:aggregate (mean, SD, min-max, deltas vs frozen and re-graded baseline)
  - eval:batch (N runs, 1-5) and eval now routed through the batch
affects: [01-06, 01-07]
tech-stack:
  added: []
  patterns: [preflight before any paid call, shared formatValue/formatDelta in metrics.ts]
key-files:
  created: [eval/preflight.ts, eval/regrade.ts, eval/batch.ts, eval/aggregate.ts]
  modified: [eval/run.ts, eval/metrics.ts, eval/report.ts, package.json]
key-decisions:
  - "N defaults to 1 (EVAL_RUNS or --runs, max 5); SD is sample SD (n-1), shown as a dash when n = 1"
  - "Batch preflight requires runs * 3.5 + 1 USD remaining; regrade requires 3 USD; single run 4 USD (EVAL_MIN_CREDIT_USD overrides)"
requirements-completed: [EVAL-05, EVAL-07]
duration: 20min
completed: 2026-11-20
---

# Phase 1 Plan 05: Preflight, Regrade and Batch Runs Summary

**Paid eval commands now stop early on a paused Supabase, missing key or low credit, record route/model IDs, and can run N times with mean, SD and min-max; the frozen baseline can be re-graded into a copy.**

## Accomplishments
- `eval/preflight.ts`: DNS plus REST check on Supabase, `GET /api/v1/key` credit check on OpenRouter, optional dev-server check. `PreflightError` exits with code 2.
- `eval/run.ts`: `runEval({persona, limit})` returns the new dir, runs the preflight, captures `debug.models` from the first ok response into `RunFile.models` (warns if missing).
- `eval/regrade.ts`: copies responses into `<timestamp>-regrade` with `regrade_of`/`regraded_at`, grades with `force`, writes the report and `regrade.json` (cost from credit before/after).
- `eval/aggregate.ts` and `eval/batch.ts`: N runs graded and reported, then `batch.json` and `aggregate.md`. `formatValue`/`formatDelta` moved into `metrics.ts` and shared with `report.ts`.

## Task Commits
1. Task 1: `b5cd7b0` (preflight, run.ts refactor)
2. Task 2: `9fa584c` (regrade)
3. Task 3: `c0734d2` (batch, aggregate, shared formatters)

## Verification
- `tsc --noEmit` clean; `eval:test` 39 pass, 0 fail.
- Bad Supabase URL: prints the "unreachable or paused" message, exit 2.
- Real env preflight: Supabase ok, OpenRouter ok ($45.49 of $50.00 left), then stopped at "Cannot reach http://localhost:3000" because the dev server is not running (expected; no eval calls made).
- Offline aggregate of the baseline with itself: `| grounded | 4.44 | 0.00 | 4.44–4.44 | 2 | 4.44 | +0.00 | – | – |` (regrade cells are dashes until Plan 07 creates the re-grade).
- Baseline hashes unchanged (responses.json 510398ae1121, grades.json d216aeafec96).

## Deviations from Plan
- `formatDelta` keeps optional run-metrics arguments (`baseMetrics`, `thisMetrics`) so the new-harness-only check from Plan 04 still works; the plan sketched a three-argument form. No behaviour change.
- While running checks I once included a report command aimed at the frozen baseline; the permission layer blocked it and it was not run. `writeReport` would have refused it anyway.

## Money Spent
None from eval work. The only network calls were free credit-check GETs. No generation, grading or regrade was run.

## Known Stubs
None.

## Next Phase Readiness
Plan 07 can run `npm run eval:regrade` and `npm run eval:batch -- --runs N` (needs dev server with EVAL_DEBUG=true and a live Supabase project).

## Self-Check: PASSED
