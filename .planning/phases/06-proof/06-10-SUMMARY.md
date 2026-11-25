---
phase: 06-proof
plan: 10
status: not_executed
reason: user scope change (budget), 2026-11-25
requirements: [PROOF-01]
---

# 06-10 Summary: three counted proof runs — NOT EXECUTED

**Outcome:** Not run, by user decision on 2026-11-25. PROOF-01 is **not met**.

## Why

- OpenRouter credit left after plan 06-07: $17.70, with no further top-ups (user).
- Measured cost of a full 50-query run is $4.81–5.09, so one 75-query run costs about $7.40. Three counted runs (~$22) plus timing exceed the remaining credit.
- The latest full original-50 run (`eval/results/2026-11-25T14-30-56`, code 844ae18, the prompt as restored and deployed as b50bb0c) misses three ready bars:
  - voice: 4.48 (bar ≥ 4.5)
  - responses with any unsupported claim: 14% (bar < 10%)
  - goal_as_result: 1 (bar 0)
- It passes the rest: recall 92% (48/52), 0 hallucinations, 0 invention-bait, 0 capability-not-shown, 0 errors.
- This plan stops at the first failing run, so counted runs on this code would very likely have failed run 1.

## Options the user was offered

1. One 75-query run including held-out (~$10 with timing and demo).
2. No more paid runs (chosen).
3. Two 75-query runs.
4. Pause.

## Consequences

- The 25 held-out queries (frozen, approved in 06-02) have **never been run**. No held-out numbers exist.
- No US-vantage production timing batches were run. The speed bar is reported from the existing production PERF-01/PERF-02 measurements.
- The 06-12 before/after page reports the original-50 numbers and states which bars are missed.

## Commits

None (no work executed).
