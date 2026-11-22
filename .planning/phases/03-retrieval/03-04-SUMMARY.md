---
phase: 03-retrieval
plan: 04
subsystem: retrieval
tags: [hybrid-search-v2, rrf, recall, offline-gate]
requires:
  - phase: 03-retrieval
    provides: hybrid_search_v2 (03-01), config/intent exports (03-02)
provides:
  - hybridSearchV2() and rewritten retrieveContext() on one v2 call
  - eval/recall-offline.ts + npm run eval:recall-offline (free recall gate)
affects: [03-05, 03-06, 03-07, 03-08]
key-files:
  created: [eval/recall-offline.ts]
  modified: [src/lib/supabase.ts, package.json]
key-decisions:
  - "Case studies first then articles, each in RRF order; no cross-type sort (RRF scores are per-type ranks)"
  - "Intent is a soft boost only; include_company_info only when isAboutAG(query)"
requirements-completed: [RETR-03]
duration: ~25min
completed: 2026-11-22
---

# Phase 3 Plan 04: Retrieval on v2 Summary

**retrieveContext now makes one hybrid_search_v2 call with soft whole-word intent, no 0.15 cutoff, and a 6 case-study + 2 article cap; a free offline script measures recall through that real code path.**

## Offline recall (migration 005 live)
```
embeddings seeded: 50, missing: 0
case-study count distribution: {"6":50}
zero-expected queries: n=20, mean case studies 6.00
search function: hybrid_search_v2 (50/50)
pass 1 recall (frozen): 43/52 (83%)   corrected: 43/49 (88%)
pass 2 recall (frozen): 43/52 (83%)   identical to pass 1: yes
GATE (D-303, frozen >= 47/52): FAIL
```
Baseline was 39/52 (75%), so +4 pairs, but the 47/52 gate is not met. Misses (9 pairs, 7 queries): p1-q02 (Renew Home), p1-q03 (Google Workspace positioning), p1-q05 (Chorus), p1-q07 (CrowdStrike, Chorus), p2-q03 (AIG), p2-q05 (J.P. Morgan, ADP keynotes), p3-q10 (Android virtual event). Three of the 9 missed pairs are disputed labels (all three still miss), so corrected recall is 43/49 (88%) with 6 real misses. The gate decision and any reranker (RETR-06) fall to Plans 03-07/03-08.

Observation: every query returns exactly 6 case studies, including the 20 zero-expected queries. That is padding by design of the cap; Plan 03-06 (teaser policy) must keep relevant_only so it does not become teaser padding.

## Verification
- `npm run eval:test`: 64 tests, 64 pass, 0 fail
- `npx tsc --noEmit -p .`: clean (route.ts unchanged)
- No `minRelevanceScore`, `* 1.1`, "include top 2" or `0.15` in src/lib/supabase.ts; hybrid_search_exact path kept (1 rpc call), PGRST202 handled twice

## Task Commits
1. Task 1, hybridSearchV2 + retrieveContext rewrite: `a6522d1`
2. Task 2, offline recall gate: `823fb70`

## Deviations from Plan
None. Plan executed as written. The offline run is the only measurement; no paid eval or generation was run.

## Known Stubs
None. The RETR-06 rerank hook is a comment marker only, by plan.

## Self-Check: PASSED
