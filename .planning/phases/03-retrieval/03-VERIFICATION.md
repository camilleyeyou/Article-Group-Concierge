---
phase: 03-retrieval
verified: 2026-11-22T00:00:00Z
status: passed
score: 6/6 requirements verified; 5/5 roadmap success criteria met
re_verification:
  previous_status: gaps_found
  previous_score: 5/6 requirements (RETR-06 not met); 4/5 success criteria
  gaps_closed:
    - "Expected case-study recall >= 90% (RETR-06): frozen 47/52 (90%), corrected 47/49 (96%) via cap8 (maxCaseStudies 6 -> 8)"
  gaps_remaining: []
  regressions: []
---

# Phase 3: Retrieval Verification Report

**Phase Goal:** The concierge finds the case studies a prospect would expect to see, at 90% recall or better.
**Status:** passed
**Re-verification:** Yes, after gap closure plans 03-11..03-13.

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `hybrid_search_v2` alongside untouched `hybrid_search`; CrowdStrike query returns | VERIFIED (regression check) | Unchanged since the prior verification. The gap run reports `hybrid_search_v2` on 100 mentions in responses.json (50/50 records) |
| 2 | Recall >= 90%, no 0.15 cutoff, no false intent matches | VERIFIED | eval/results/2026-11-22T13-42-12/report.md: expected recall 47/52 (90%), corrected 47/49 (96%). `maxCaseStudies: 8` at src/lib/concierge-config.ts:53, used in src/lib/supabase.ts:495 and 505. Offline bake-off (03-BAKEOFF.md) gives cap8 = 47/52 on both passes, and the eval reproduces it exactly with the same 5 misses |
| 3 | Catalogue is a cached prefix; cache hits visible | VERIFIED (regression check) | Gap run `prompt_cache_hits` 50/50 per 03-GAP-EVAL-DELTA.md |
| 4 | Fewer than 4 relevant studies: show only what exists | VERIFIED | RETR-05 guard after cap8: `teasers_zero_expected_mean` 1.45 (limit 1.70), exactly-4-teaser responses 1/50 (limit 3). report.md line 38 confirms 1.45 |
| 5 | Eval rerun with per-metric deltas vs baseline | VERIFIED | 03-EVAL-DELTA.md and 03-GAP-EVAL-DELTA.md; report.md has the baseline comparison table with recall rows (75% -> 90%) |

**Score:** 5/5

## Requirements Coverage

| Requirement | Source Plan(s) | Status | Evidence |
|---|---|---|---|
| RETR-01 | 03-01, 03-03, 03-04, 03-10 | SATISFIED | v2 function additive; used on 50/50 records |
| RETR-02 | 03-02, 03-03, 03-04, 03-06 | SATISFIED | Whole-word intent, unit tests pass |
| RETR-03 | 03-04, 03-07 | SATISFIED | No cutoff; top-k caps now 8 case studies + 2 articles |
| RETR-04 | 03-03, 03-05, 03-06, 03-09 | SATISFIED | Cache hits 50/50 |
| RETR-05 | 03-02, 03-03, 03-06, 03-09 | SATISFIED | Guard passes post-cap8 (see truth 4). Shown recall 41/52 (79%), up from 73% |
| RETR-06 | 03-07, 03-08, 03-09, 03-11, 03-12, 03-13 | SATISFIED | 47/52 frozen (90%), 47/49 corrected (96%); target 47/52 met exactly |

All six IDs appear in plan frontmatter and in REQUIREMENTS.md, which marks all of them Complete. No orphaned requirements.

## Free Checks Run (no spend)

| Check | Result |
|---|---|
| `npm run eval:test` | 81/81 pass (was 78) |
| `npx tsc --noEmit -p .` | clean |
| `maxCaseStudies` in config | 8; `rerank.enabled` false |
| Gap-run report.md recall, zero-expected teasers, route, hallucinations | 47/52, 47/49, 1.45, openrouter, 0/50 (matches the delta doc) |
| `git log origin/main -1` | 2faba11 (the fix is pushed) |

Paid evals, DB-backed gate scripts and live deploy checks were not re-run. They are taken from the 03-BAKEOFF.md, 03-GAP-EVAL-DELTA.md and 03-12/03-13 summaries and from the committed eval artifacts.

## Notes and Residual Risks (non-blocking)

- Zero margin: recall is exactly at the frozen gate (47/52). Any retrieval or corpus change could drop it below 90%. Of the 5 remaining misses, 3 are disputed labels (Renew Home, Chorus x2). The real misses are AIG and J.P. Morgan.
- Recall is deterministic offline and was reproduced by the eval, but it is one eval run. Generation-quality metrics were within noise.
- Cost and latency: cap8 adds about $0.00088 per query of generation input. Median latency is 19.0 s against 18.0 s for the Phase 3 final run. Phase 5 owns latency.
- Process notes carried from the prior report: Phase 3 shipped as multiple commits (853bbe4, 120ab9d, 2faba11 and the docs commits), not one. This departs from the single-commit-per-phase rule.
- Rollback precondition (03-10): 20 held chunks are filtered only by v2. Do not fall back to `hybrid_search_exact` without removing them.
- Remaining unsupported claims: 14 responses (7 goal-stated-as-result). Phase 4 owns these. Hallucinations: 0.
- Uncommitted files in the working tree (`.planning/STATE.md`, `03-13-SUMMARY.md` and others) are bookkeeping for the orchestrator to commit.

## Human Verification

None required.

## Gaps Summary

None. The RETR-06 gap is closed: recall reached the 90% target, and the RETR-05 anti-padding guard still holds.

---

_Verified: 2026-11-22_
_Verifier: Claude (gsd-verifier)_
