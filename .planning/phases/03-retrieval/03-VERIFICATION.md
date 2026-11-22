---
phase: 03-retrieval
verified: 2026-11-22T00:00:00Z
status: gaps_found
score: 5/6 requirements verified (RETR-06 not met); 4/5 roadmap success criteria met
gaps:
  - truth: "Expected case-study recall is >= 90% (RETR-06; success criterion 2)"
    status: failed
    reason: "Frozen recall 43/52 (83%), corrected for 3 disputed labels 43/49 (88%). Target 47/52. Cohere rerank-5-fast was built (src/lib/rerank.ts) and gives 44/52, still short; user chose to keep it off (rerank.enabled=false)."
    artifacts:
      - path: "src/lib/concierge-config.ts"
        issue: "retrieval.rerank.enabled = false"
    missing:
      - "Another recall lever: Haiku listwise rerank, re-chunking (needs re-index and user approval), or query rewriting"
      - "Misses are mostly rank-cutoff misses just under the 6-study cap: Google Workspace, CrowdStrike, AIG, J.P. Morgan, ADP, Android virtual event, plus 3 disputed labels"
---

# Phase 3: Retrieval Verification Report

**Phase Goal:** The concierge finds the case studies a prospect would expect to see, at 90% recall or better.
**Status:** gaps_found. The mechanism requirements are met, but the headline goal (90% recall) is not.
**Re-verification:** No, initial verification.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `hybrid_search_v2` alongside untouched `hybrid_search`; OR keywords, weighting, RRF; CrowdStrike query returns | VERIFIED | Migration `supabase/migrations/005_hybrid_search_v2.sql` adds v2 only; `hybridSearchV2` in src/lib/supabase.ts called by `retrieveContext`; check-hybrid-v2 8/8 PASS (03-10); CrowdStrike marketecture queries p1-q06 and p1-q10 gained in the eval |
| 2 | Recall >= 90%, no 0.15 cutoff, no false intent matches | FAILED (partial) | No 0.15 cutoff and whole-word intent are done (78/78 unit tests pass). Recall is 83% frozen / 88% corrected against the 90% target |
| 3 | Catalogue is a cached prefix; cache hits visible in usage | VERIFIED | `prompt_cache_hits` 50/50 in the eval, mean 10,573 cache-read tokens; check-prompt-cache PASS (03-05) |
| 4 | Fewer than 4 relevant studies: show only what exists | VERIFIED | Exactly-4-teaser responses fell from 46/50 to 1/50; zero-expected-query teaser mean 3.8 to 1.40; adjacent work labelled; fallback 4.98 |
| 5 | Eval rerun with per-metric deltas vs baseline | VERIFIED | 03-EVAL-DELTA.md lists every metric against frozen and re-graded baselines. Caveat: the grounded, components and generated_tags movement is partly a harness v3 effect, because the baselines were not re-graded under v3 |

**Score:** 4/5 truths verified.

## Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| RETR-01 | 03-01, 03-03, 03-04, 03-10 | SATISFIED | v2 function exists additively; v2 used on 50/50 eval records; live production smoke test returned normally (indirect evidence: the route does not expose which RPC ran) |
| RETR-02 | 03-02, 03-06, 03-03 | SATISFIED | Whole-word intent matching with plurals, covered by unit tests; used only as a soft boost |
| RETR-03 | 03-03, 03-04, 03-06 | SATISFIED | No cutoff; 6 case studies + 2 articles per query |
| RETR-04 | 03-03, 03-05, 03-06, 03-09 | SATISFIED | Cached catalogue block; hits 50/50 |
| RETR-05 | 03-02, 03-03, 03-04, 03-05, 03-06 | SATISFIED | See truth 4. Caveat: shown recall is 38/52 (73%), below the 75% baseline, because 5 retrieved studies are deliberately not shown under relevant_only |
| RETR-06 | 03-07, 03-08 | NOT SATISFIED | 43/52 (83%) frozen, 43/49 (88%) corrected, against 47/52. REQUIREMENTS.md correctly leaves it unchecked and Pending. Cohere rerank gives 44/52 and is off by user decision |

All six IDs appear in plan frontmatter and in REQUIREMENTS.md. There are no orphaned requirements.

## Free Checks Run

| Check | Result |
|---|---|
| `npm run eval:test` | 78/78 pass |
| `npx tsc --noEmit -p .` | clean |
| Migration 005 present; defines `hybrid_search_v2` only | yes |
| `rerank.enabled` in concierge-config.ts | false |
| 0.15 cutoff string in src/lib | none |

The paid eval, DB-backed gate scripts and the live deploy were not re-run. Their results are taken from the 03-EVAL-DELTA.md, 03-09 and 03-10 summaries, so they are unverified here.

## Anti-Patterns and Process Notes

- Phase 3 shipped as 2 commits (853bbe4 plus the 120ab9d build fix), not one. The Vercel lint step failed on the first push. The per-phase single-commit rule was not met, and amending would have required a force-push.
- Rollback precondition (03-10): the 20 held chunks (5 company_info, 15 excluded LinkedIn) are only filtered by v2. If production ever falls back to `hybrid_search_exact`, or v2 is missing (the code has that fallback), this content would surface. Remove or relabel the chunks before any rollback past Phase 3.
- Remaining unsupported claims: 14 responses (10 goal-stated-as-result). Phase 4 owns these. Hallucinations: 0.

## Human Verification

None needed for the status. The user has already made the rerank-off decision.

## Gaps Summary

The only gap is RETR-06 and the matching half of success criterion 2. Retrieval mechanics, caching, anti-padding and reporting are delivered and verified. Recall improved from 75% to 83% (88% corrected) but stays under 90%. Closing it needs another lever (Haiku listwise rerank, re-chunking, query rewriting, or enabling the Cohere rerank for +1, which still falls short), or an explicit decision to accept or defer the target.

---

_Verified: 2026-11-22_
_Verifier: Claude (gsd-verifier)_
