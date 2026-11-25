---
phase: 06-proof
plan: 04
subsystem: eval-harness
tags: [eval, proof, timing, sse, github-actions]
requires: ["06-01", "06-03"]
provides:
  - "encodeSseComment and PERF_TIMING-only ': perf' / ': perf-final' SSE comments from the stream route"
  - "StreamCapture.perf (ProdPerfFlags) parsed by consumeChatStream; stopAfterHeroDone option"
  - "eval/prod-timing.ts: makeBatches, --make-batches, --batch/--dry US-vantage timing client writing ProdTimingFile"
  - ".github/workflows/prod-timing.yml: secret-free workflow_dispatch runner"
affects: [06-07, 06-09]
key-files:
  created: [eval/prod-timing.ts, eval/prod-timing.test.ts, .github/workflows/prod-timing.yml]
  modified: [src/lib/stream-events.ts, src/app/api/chat/stream/route.ts, eval/stream-client.ts, eval/stream-client.test.ts, package.json]
decisions:
  - "Timing batches draw from all 75 queries (includeHeldOut: true), 3 x 20 (10/4/2/2/2) plus 2 dry ids, as in the plan; timing records latency only so this is not tuning"
  - "Early stop after hero_done is done by cancelling the response reader inside consumeChatStream (no AbortController); orch_cached stays null for those requests and rag_cache_hit carries the cache signal"
metrics:
  duration: n/a
  completed: 2026-11-25
requirements: [PROOF-01]
---

# Phase 6 Plan 04: US-vantage production timing Summary

With PERF_TIMING on, every stream response now carries cache and instance flags as SSE comments, and a timing client plus a GitHub Actions workflow can run a cache-safe batch from a US runner against production. Nothing was run against production in this plan.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | 23496ad | encodeSseComment; route emits `perf` and `perf-final` comments only inside `if (perfTiming)`; eval client parses them; 7 new tests including a route-source guard test |
| 2 | 744aa10 | eval/prod-timing.ts, 6 tests, `eval:prod-timing` script, stream-client `stopAfterHeroDone` |
| 3 | ec67e02 | prod-timing.yml (workflow_dispatch, contents: read, no secrets) |

## Verification

- `npx tsx --test eval/prod-timing.test.ts eval/stream-client.test.ts eval/stream-events.test.ts eval/stream-equivalence.test.ts`: all pass (17 in the two touched files; 24 across the stream suites before the last additions).
- `npx tsc --noEmit -p .` clean.
- `--batch 1` with no timing-batches.json exits 2 with the expected message before any network call.
- Workflow YAML parses; check prints `ok`; no `secrets.` reference.
- Real-pool test: 75 queries give batches of 20/20/20 plus 2 dry ids, all disjoint (nothing written to disk; 06-09 creates eval/timing-batches.json).

## Deviations from Plan

**1. [Corrected back to plan]** An initial version limited batches to the 50 non-held-out queries (14 per batch) on the basis of a repo note. At the orchestrator's instruction (the note was wrong; D-606a and plan line 140 use the full set, and timing records latency only) it was corrected: `--make-batches` uses `includeHeldOut: true`, and the default quota is the plan's 10/4/2/2/2 (20 per batch, 2 dry ids). A test checks the real 75-query pool gives 3 disjoint batches of 20. The quota parameter and `defaultQuota` helper remain but are not the CLI default.

**2. [Rule 3] Route emits through a local `sendComment` helper**, so the literal grep `encodeSseComment('perf'` in the plan's acceptance criteria does not match. Equivalent check: `sendComment('perf'` and `sendComment('perf-final'` appear once each, both after an `if (perfTiming)`, enforced by a test.

**3. [Rule 2] Workflow passes inputs through `env` (BATCH, EXPECT_COMMIT)** rather than interpolating `${{ inputs.* }}` into the shell script, to avoid script injection from dispatch inputs.

**4. [Rule 3]** `consumeChatStream` gained an optional 4th parameter (`stopAfterHeroDone`) so the timing client can stop at `hero_done` without an AbortController; existing callers are unaffected.

## Notes for later plans

- The workflow only runs once it is on `main`; 06-09 handles that with the user's deploy decision. `PERF_TIMING=true` must be set on production for the flags to appear (06-09; not set here). Without it `perf` is null and the cache-safe gate fails with `missing_perf`.
- `--expect-commit` is recorded in the file only; it is not verified against a production endpoint.
- The vantage check relies on ipinfo.io; an unknown location refuses.

## Known Stubs

None.

## Self-Check: PASSED
