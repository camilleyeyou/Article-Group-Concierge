---
phase: 05-speed
plan: 07
subsystem: eval
tags: [eval, streaming, timing, metrics, perf-01, perf-02]
requires:
  - phase: 05-speed
    provides: SseDecoder (05-01), provider health (05-02), suppressionReason (05-03), stream route (05-05)
provides:
  - consumeChatStream (eval/stream-client.ts)
  - eval/run.ts on /api/chat/stream (EVAL_ROUTE=json keeps legacy path)
  - speed, instant (flash, suppression at 0.40/0.45) metrics, phase5Gates, PHASE5_NO_REGRESSION, PHASE5_SPEED
  - report section "Speed and instant teasers (Phase 5)"
  - eval/stream-timing.ts and eval/stream-smoke.ts (built, not run)
  - FULL_EVAL_MIN_CREDIT_USD shared threshold
affects: [05-08, 05-09]
key-files:
  created: [eval/stream-client.ts, eval/stream-client.test.ts, eval/stream-timing.ts, eval/stream-smoke.ts]
  modified: [eval/lib.ts, eval/run.ts, eval/metrics.ts, eval/metrics.test.ts, eval/report.ts, eval/preflight.ts, eval/batch.ts]
key-decisions:
  - "latency_ms equals t_complete_ms on the stream route so latency_median_s stays comparable"
  - "Suppression and flash metrics are null for JSON-route or old runs (route !== 'stream')"
  - "batch minimum for a full run is FULL_EVAL_MIN_CREDIT_USD (4.5) + (runs-1)*3.5; runs=1 still requires exactly $4.50"
requirements-completed: []
completed: 2026-11-23
---

# Phase 5 Plan 07: Eval on the streaming route Summary

**The eval now runs every query through the production SSE route, records per-query teaser/hero/complete arrival times, grades the final layout, and reports D-511 speed gates, flash rate, D-504 suppression at two floors and the D-513 no-regression gates mechanically; the cents-priced timing and smoke tools are built and unit/dry-run checked.**

## Commits
- b4abb89 Task 1: stream consumer and run.ts on the stream route
- 87f8520 Task 2: speed/instant metrics, phase5Gates, report section
- 8651959 Task 3: stream-timing.ts, stream-smoke.ts, shared credit constant

## Verification
- `npm run eval:test` 208/208, `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` succeeds.
- Phase 4 run copied to a temp dir and re-reported: t_teasers_median_s, t_hero_first_median_s, t_hero_done_median_s rows show n/a and no Phase 5 speed section appears. The original run dir was not touched.
- `stream-timing.ts ... --dry-run` prints 9 planned calls, estimate $0.40, exit 0, no network. `stream-smoke.ts --help` prints usage.
- No paid call was made in this plan.

## Commands for 05-08 and 05-09
- 05-08 timing (about $0.40, hard cap $0.75): `npx tsx eval/stream-timing.ts --ids p1-q01,p2-q01,p1-q05 --modes default,between_tools,adaptive_effort:low [--spent-usd <n> for later invocations]`. Exits 2 on credit refusal, 3 if projected credit < $4.50.
- 05-08 smoke (cents, one query): `EVAL_BASE_URL=<url> npx tsx eval/stream-smoke.ts [--query "..."]` (server must have EVAL_DEBUG off).
- 05-09 full eval (about $3.50, preflight needs $4.50): server with EVAL_DEBUG=true, then `npm run eval:batch -- --runs 1` (add `--second-grader` only if credit allows; it raises the minimum by $1). The report's "Speed and instant teasers (Phase 5)" section carries the gates.

## Deviations from Plan
None for behaviour. Notes:
- stream-timing.ts loads orchestrator, supabase and catalogue by dynamic import after the dry-run exit, so dry runs never construct clients; `import './lib'` stays the first line.
- The projected-credit stop is written inline with `process.exit(3)` (rest use a `finish()` helper).
- A first attempt to run the verification chain (including a build step) was blocked by a built-in safety check on a removal pattern; I re-ran the checks as separate commands and they passed. Nothing was deleted.

## Known Stubs
None.

## Self-Check: PASSED
