---
phase: 03-retrieval
plan: 09
subsystem: eval
tags: [eval, delta-report, recall, prompt-cache, anti-padding]
requires: ["03-07", "03-08"]
provides:
  - "03-EVAL-DELTA.md: every metric vs frozen and re-graded baselines"
affects: [03-10]
key-files:
  created: [.planning/phases/03-retrieval/03-EVAL-DELTA.md]
  modified: []
key-decisions:
  - "Ran the phase-end eval with the Cohere reranker off, after the user chose run-eval despite a failing gate"
requirements-completed: [RETR-04, RETR-05]
metrics:
  duration: 35min
  completed: 2026-11-22
---

# Phase 3 Plan 09: Phase-end eval and delta report Summary

**One full eval (reranker off) shows frozen recall 43/52 (83%), corrected 43/49 (88%): RETR-06 not met. Teaser padding is gone (exactly-4 responses 46/50 to 1/50) and prompt caching hits on 50/50.**

## Task 1: spend decision

Latest gate quoted from 03-08-SUMMARY.md: `GATE (rerank): FAIL (44/52)`. The user explicitly chose "run-eval" (run the ~$4.25 eval and report recall below target), and later decided the Cohere reranker stays off (commit 7d9a7db). The eval ran with `rerank.enabled = false`; RERANK_ENABLED was not set.

## Task 2: runs

- Preflight: Supabase ok, credit $25.57.
- Smoke `2026-11-22T11-54-42` (batch-2026-11-22T11-54-41, $0.06): all 3 ok records had `search_function` hybrid_search_v2, catalogue and catalogue_version, usage, cache_read 10,573 tokens; harness_version 3; public `response` has no usage or catalogueVersion keys.
- Full run `2026-11-22T11-56-17` (batch-2026-11-22T11-56-16): 50/50 ok, all hybrid_search_v2, harness v3.
- Credit after: $21.14. Exact spend $4.43 (smoke $0.06 + full run $4.31 per batch.json, small rounding).
- Dev server started with EVAL_DEBUG from .env.local and stopped afterwards; .env.local and Vercel untouched. Run directories are gitignored, so Task 2 has no commit.

## Task 3: delta report

`03-EVAL-DELTA.md` (commit 09d3f53).

Headline numbers (final vs frozen / re-graded):

| Metric | Final | Frozen | Re-graded |
|---|---|---|---|
| recall_pct | 83% (43/52) | 75% | 75% |
| recall_pct_corrected | 88% (43/49) | 80% | 80% |
| shown_recall_pct | 73% | 75% | 75% |
| teasers_zero_expected_mean | 1.40 | 3.85 | 3.85 |
| prompt_cache_hits | 50/50 | n/a | n/a |
| grounded | 4.54 | 4.44 | 3.92 |
| components | 4.90 | 4.94 | 4.66 |
| responses with unsupported claims | 14 | 22 | 42 |
| hallucinations | 0 | 0 | 0 |
| median latency | 18.0 s | 20.1 s | 20.1 s |

The offline gate (43/52 with the reranker off) matched the eval exactly. Unsupported-claim and generated_tags drops are partly a harness v3 effect (the grader now sees the catalogue); the baselines were not re-graded.

## Requirement outcome

- RETR-04 and RETR-05: met (RETR-04 was already complete; RETR-05 now evidenced: exactly-4 responses 46 to 1 of 50, zero-expected mean 3.8 to 1.40, adjacent work labelled, fallback 4.98).
- RETR-06: not met (83% frozen, 88% corrected, target 90%). Left pending.

## Deviations from Plan

None. The plan's Task 1 checkpoint was pre-resolved by the user; the reranker-off configuration follows the user's post-03-08 decision.

## Known Stubs

None.

## Self-Check: PASSED

03-EVAL-DELTA.md and the run directories exist; commit 09d3f53 exists.
