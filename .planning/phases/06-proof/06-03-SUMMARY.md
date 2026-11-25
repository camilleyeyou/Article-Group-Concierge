---
phase: 06-proof
plan: 03
subsystem: eval-harness
tags: [eval, proof, ready-bar, timing, report]
requires: ["06-01"]
provides:
  - "ProdTimingFile contract (eval/prod-timing-types.ts) for the timing client in 06-04"
  - "phase6Gates, summarizeTiming, timingGates, PROOF_BAR in eval/metrics.ts"
  - "computeRunMetrics(dir, { filter }) and RunMetrics.errors"
  - "eval:batch --proof (75 queries, per-query credit sizing)"
  - "eval:proof-report: ready-bar table, held-out split, share-based baseline deltas, verdict"
affects: [06-04, 06-07]
key-files:
  created: [eval/prod-timing-types.ts, eval/proof-report.ts, eval/proof.test.ts]
  modified: [eval/metrics.ts, eval/batch.ts, eval/preflight.ts, eval/aggregate.ts, package.json]
decisions:
  - "INCOMPLETE takes precedence over FAIL in the verdict (missing inputs mean no verdict); exit 0 PASS, 1 FAIL, 2 INCOMPLETE, 3 INVALID"
  - "D-608 compares code (git diff over src, eval/*.ts, queries, package files, supabase), not HEAD, so planning-doc commits between runs do not invalidate"
metrics:
  duration: n/a
  completed: 2026-11-24
requirements: [PROOF-01, PROOF-02]
---

# Phase 6 Plan 03: Proof measurement layer Summary

One command (`npm run eval:proof-report`) turns 1-3 proof runs, their production timing batches and the static-check file into the D-604/D-605 ready-bar verdict, with held-out split and baseline deltas shown as shares.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | e7aa9e9 | timing contract, filtered metrics, phase6Gates / timingGates, 9 new tests |
| 2 | e89f466 | batch --proof, estimateRunUsd, proof-report CLI, package script |

## Verification

`npx tsx --test eval/*.test.ts`: 252 pass, 0 fail. `tsc --noEmit` clean. Free smoke on run 2026-11-24T10-42-25: exits 2, markdown has `VERDICT: INCOMPLETE (production timing batches; static checks file)` and the `responses with any unsupported claim < 10%` row. No paid calls, no DB writes.

## Deviations from Plan

**[Rule 3 - Blocking]** Adding the optional `opts` parameter to `computeRunMetrics` broke `dirs.map(computeRunMetrics)` in `eval/aggregate.ts` (map passes the index as second argument). Changed to `dirs.map(d => computeRunMetrics(d))`. Included in e7aa9e9.

**[Rule 2]** Added `errors` to `RunMetrics` so the "all queries answered and graded" gate can see error records.

## Notes for later plans

- Smoke run (50 queries, old code) shows voice 4.48, so voice 4.5 is the tightest bar; recall 90.38% on 50 queries sits just above the 90% line.
- Static file shape: `{ site_work_missing, mismatched_videos, checked_at }`.

## Known Stubs

None.

## Self-Check: PASSED
