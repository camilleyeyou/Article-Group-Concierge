# Phase 3 gap closure eval delta (RETR-06)

Date: 2026-11-22. Gap run `2026-11-22T13-42-12` at code commit `a76726f` (cap8: `maxCaseStudies` 6 -> 8, reranker off, everything else unchanged).

**Headline: frozen recall is 47/52 (90%) against 43/52 (83%) in the Phase 3 final run and 39/52 (75%) at baseline. The frozen target (47/52, D-306) is met exactly. Corrected recall (`recall_pct_corrected`) is 47/49 (96%). The RETR-05 guard (D-307) passes: `teasers_zero_expected_mean` 1.45 (limit 1.70), exactly-4-teaser responses 1/50 (limit 3). Hallucinations 0/50.**

## Route and models

| Item | Value |
|---|---|
| Route | `openrouter` (local dev server with EVAL_DEBUG; never set in production) |
| Generation model | `anthropic/claude-sonnet-5.5` |
| Judge | `anthropic/claude-opus-5.5` via openrouter (harness v3) |
| Search function | `hybrid_search_v2` on 50/50 records |
| Shipped lever | cap8 (D-305 bake-off winner, 47/52 frozen offline on both passes; offline gate printed PASS on the shipped default) |
| Reranker | none (disabled; `grep -c RERANK_ENABLED .env.local` = 0; 0 rerank fallbacks) |

## Runs

| Item | Id |
|---|---|
| Frozen baseline (harness v1) | `2026-11-20T15-12-31` |
| Phase 3 final run | `2026-11-22T11-56-17` |
| Smoke run (p5, 3 queries) | `2026-11-22T13-40-39`, batch `batch-2026-11-22T13-40-39`, $0.07 |
| **Gap run (full, 50 queries)** | `2026-11-22T13-42-12`, batch `batch-2026-11-22T13-42-12`, $4.29 |

Credit: $20.87 before the smoke run, $16.04 after the full run, so about $4.83 in total (batch.json cost: $0.07 + $4.29 = $4.36; the remainder is OpenRouter credit-read rounding/lag and the offline gate run). One smoke and one full run only. 50/50 queries succeeded and were graded.

## Metrics table

Noise figures from STATE.md: grounded SD 0.16, voice SD 0.04, responses with unsupported claims 39-42, recall 75% stable (earlier runs). One run only, so deltas are read against those.

| Metric | Gap run | Frozen 2026-11-20T15-12-31 | Δ vs frozen | Phase 3 final 2026-11-22T11-56-17 | Δ vs Phase 3 final | Beyond noise? |
|---|---|---|---|---|---|---|
| grounded | 4.60 | 4.44 | +0.16 | 4.54 | +0.06 | No |
| components | 4.88 | 4.94 | -0.06 | 4.90 | -0.02 | No |
| fallback | 4.94 | 4.50 | +0.44 | 4.98 | -0.04 | No vs Phase 3 final |
| cta | 5.00 | 4.36 | +0.64 | 4.94 | +0.06 | No |
| voice | 4.18 | 3.92 | +0.26 | 4.14 | +0.04 | No (SD 0.04, borderline) |
| hallucinations | 0 | 0 | 0 | 0 | 0 | No |
| responses_with_unsupported_claims | 14 | 22 | -8 | 14 | 0 | No |
| unsupported_claims_total | 15 | 38 | -23 | 15 | 0 | No |
| claims: goal_as_result | 7 | n/a | n/a | 10 | -3 | Within noise |
| claims: capability_not_shown | 2 | n/a | n/a | 1 | +1 | No |
| claims: generated_tags | 0 | n/a | n/a | 0 | 0 | No |
| claims: other | 6 | n/a | n/a | 4 | +2 | No |
| recall_pct (frozen) | 90% (47/52) | 75% | +15 pp | 83% (43/52) | +7 pp | Yes (recall was 75% in every earlier run, deterministic offline) |
| recall_pct_corrected | 96% (47/49) | 80% | +16 pp | 88% (43/49) | +8 pp | Yes |
| shown_recall_pct | 79% (41/52) | 75% | +4 pp | 73% | +6 pp | Modest; 6 retrieved studies not shown |
| teasers_zero_expected_mean | 1.45 | 3.85 | -2.40 | 1.40 | +0.05 | No |
| prompt_cache_hits | 50 | n/a | n/a | 50 | 0 | n/a |
| latency_median_s | 19.0 s | 20.1 s | -1.1 s | 18.0 s | +1.0 s | Likely small cost of two more case-study chunks; within run-to-run variation |
| metrics_not_in_context | 0 | 0 | 0 | 0 | 0 | No |
| strict_fallback_pass | 22 | 16 | +6 | 23 | -1 | No |
| strategy_lead_offered_when_expected | 0 | 0 | 0 | 0 | 0 | No |

## Recall per query

Total 47/52 vs 43/52 (Phase 3 final).

Gained vs Phase 3 final (all four match the offline bake-off prediction):
- p1-q03 Google Workspace
- p1-q07 CrowdStrike
- p2-q05 ADP keynotes
- p3-q10 Android

Lost vs Phase 3 final: none.

Remaining misses (5 pairs): p1-q02 Renew Home (disputed), p1-q05 Chorus (disputed), p1-q07 Chorus (disputed), p2-q03 AIG, p2-q05 J.P. Morgan. Three of the five are disputed labels; the two real misses are AIG and J.P. Morgan.

## Offline bake-off vs eval recall

The bake-off predicted cap8 = 47/52 frozen and 47/49 corrected on both passes. The eval gives exactly 47/52 and 47/49 with the same misses. No difference. The margin to the gate is zero.

## RETR-05 guard (D-307)

| Measure | Gap run | Phase 3 final | Limit |
|---|---|---|---|
| teasers_zero_expected_mean (n=20) | 1.45 | 1.40 | <= 1.70 |
| exactly-4-teaser responses | 1/50 | 1/50 | <= 3 |
| teaser distribution 0/1/2/3/4 | 4/10/17/18/1 | 3/11/19/16/1 | n/a |
| all-query teaser mean | 2.04 | 2.02 | n/a |

Guard passes. The two extra case studies did not bring back teaser padding.

Rerank fallbacks: not applicable (no reranker, 0 `keeping RRF order` log lines). Latency median 19.0 s vs 18.0 s.

GAP VERDICT: MET
