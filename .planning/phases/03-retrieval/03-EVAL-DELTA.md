# Phase 3 eval delta vs baseline 2026-11-20T15-12-31

Date: 2026-11-22. Final run `2026-11-22T11-56-17` at code commit `70c32cd` (hybrid_search_v2, catalogue prompt cache, relevant_only teaser rule, Cohere reranker OFF).

**Headline: frozen recall is 43/52 (83%) against 39/52 (75%) at baseline. The >= 90% target (47/52) is NOT met on frozen labels (D-301). Corrected recall is 43/49 (88%), also under 90%. Teaser padding is gone (zero-expected queries show 1.40 teasers on average, down from 3.85), prompt caching hits on 50/50 responses, and unsupported claims fall from 42 to 14 responses (partly a harness v3 effect, see the note under the metrics table). Hallucinations stay at 0/50.**

## Route and models

| Item | Value |
|---|---|
| Route | `openrouter` (local dev server with EVAL_DEBUG; never set in production) |
| Generation model | `anthropic/claude-sonnet-5.5` |
| Embedding model | `openai/text-embedding-3-small` |
| Judge | `anthropic/claude-opus-5.5` via openrouter (harness v3) |
| Second grader | none (D-19) |
| Search function | `hybrid_search_v2` on 50/50 records |
| Reranker | `cohere/rerank-5-fast` added in 03-08, **disabled** (`CONCIERGE_CONFIG.retrieval.rerank.enabled = false`, commit 7d9a7db, user decision: +1 recall for ~0.9 s latency) |

## Runs

| Item | Id |
|---|---|
| Frozen baseline (harness v1) | `2026-11-20T15-12-31` |
| Re-graded baseline (harness v2) | `2026-11-21T07-32-49-regrade` |
| Phase 2 final run (harness v2, context only) | `2026-11-21T21-15-13` |
| Smoke run (p5, 3 queries) | `2026-11-22T11-54-42`, batch `batch-2026-11-22T11-54-41`, $0.06 |
| **Phase 3 final run** | `2026-11-22T11-56-17`, batch `batch-2026-11-22T11-56-16` |

Spend: credit $25.57 before the smoke run, $21.14 after the full run, so $4.43 in total (smoke $0.06, full run $4.31 per batch.json, rest is rounding between credit reads). Generation alone cost $1.59 per the usage fields. 50/50 queries succeeded and were graded. Only one full run was made, so the noise figures from Phase 1 are used to read the deltas (grounded SD 0.16, voice SD 0.04, responses with unsupported claims 39-42, recall 75% stable).

## Metrics table (final run)

| Metric | Final | Frozen baseline | Δ vs frozen | Re-graded | Δ vs re-graded | Beyond noise? |
|---|---|---|---|---|---|---|
| grounded | 4.54 | 4.44 | +0.10 | 3.92 | +0.62 | Yes vs re-graded (SD 0.16), but see harness note |
| components | 4.90 | 4.94 | -0.04 | 4.66 | +0.24 | Probably (no component SD recorded); harness note applies |
| fallback | 4.98 | 4.50 | +0.48 | 4.66 | +0.32 | Likely; teaser rule now rendered from config |
| cta | 4.94 | 4.36 | +0.58 | 4.94 | +0.00 | No |
| voice | 4.14 | 3.92 | +0.22 | 4.08 | +0.06 | Borderline (SD 0.04, one run) |
| hallucinations | 0 | 0 | 0 | 0 | 0 | No |
| responses_with_unsupported_claims | 14 | 22 | -8 | 42 | -28 | Yes (Phase 1 range 39-42), harness note applies |
| unsupported_claims_total | 15 | 38 | -23 | 113 | -98 | Yes, harness note applies |
| claims: goal_as_result | 10 | n/a | n/a | 17 | -7 | Yes (Phase 1 range 12-21; now below it) |
| claims: capability_not_shown | 1 | n/a | n/a | 11 | -10 | Yes |
| claims: generated_tags | 0 | n/a | n/a | 69 | -69 | Yes, almost certainly the grader now seeing the catalogue (D-304) |
| claims: other | 4 | n/a | n/a | 16 | -12 | Yes |
| recall_pct | 83% | 75% | +8 pp | 75% | +8 pp | Yes (recall was 75% in every earlier run) |
| recall_pct_corrected | 88% | 80% | +8 pp | 80% | +8 pp | Yes |
| shown_recall_pct | 73% | 75% | -2 pp | 75% | -2 pp | No (5 retrieved studies not shown) |
| teasers_zero_expected_mean | 1.40 | 3.85 | -2.45 | 3.85 | -2.45 | Yes |
| prompt_cache_hits | 50 | n/a | n/a | n/a | n/a | New metric, 50/50 |
| latency_median_s | 18.0 s | 20.1 s | -2.1 s | 20.1 s | -2.1 s | Likely (fewer teasers, warm cache) |
| metrics_not_in_context | 0 | 0 | 0 | 0 | 0 | No |
| strict_fallback_pass | 23 | 16 | +7 | 18 | +5 | Yes (the prompt now allows a plain "we have no such work") |
| strategy_lead_offered_when_expected | 0 | 0 | 0 | 0 | 0 | No |

Harness note: harness v3 differs from v2 only by the catalogue section in the grader context and the config-rendered teaser rule. Neither baseline was re-graded (budget), so part of any grounded, generated_tags and components movement may come from the harness and not from the app. The generated_tags drop from 69 to 0 in particular is expected to be mostly a grader effect.

Remaining unsupported claims (14 responses): 10 are goal-stated-as-result (for example "unified a variety of sub-brands" where the context states the want), 4 other, 1 capability not shown. Phase 4 owns these.

## Recall per query

Total 43/52 against 39/52 (frozen) and 39/52 (Phase 2 final).

Gained vs frozen (cause class: keyword OR search and no score cutoff, RETR-01/03):
- p1-q04 Salesforce/Slack sales enablement
- p1-q06 CrowdStrike marketecture, Salt Security
- p1-q07 Salt Security
- p1-q10 CrowdStrike marketecture
- p2-q02 ADP keynotes
- p2-q07 ADP keynotes

Lost vs frozen:
- p1-q03 Google Workspace positioning (naming query; 6-slot cap, Chorus/Salt/Simons/Google Cloud ranked above it)
- p1-q07 CrowdStrike (vague "cybersecurity clients?" query; only Chrome, Salt, J.P. Morgan, Slalom, AWS rank above it; the label itself is fine)
- p2-q03 AIG (legal-review query; Salesforce, Box, ADP, Slalom outrank it)

Gained vs Phase 2 final: the same set plus p3-q05 Salesforce/Slack; lost vs Phase 2: the same three.

Remaining misses (9):
- p1-q02 Renew Home (disputed)
- p1-q03 Google Workspace
- p1-q05 Chorus (disputed)
- p1-q07 CrowdStrike, Chorus (Chorus disputed)
- p2-q03 AIG
- p2-q05 J.P. Morgan, ADP
- p3-q10 Android virtual event

### Disputed labels (D-301)

Excluded only in `recall_pct_corrected` (43/49, 88%). All three were not retrieved in this run:
- p1-q05 Chorus (Alphabet X): text describes supply-chain asset visibility, no security content. Not retrieved.
- p1-q07 Chorus (Alphabet X): same reason. Not retrieved.
- p1-q02 Renew Home: an energy brand, no security content. Not retrieved.

Shown recall: 38/52 (73%). Five expected studies were retrieved but not presented as a teaser, which is by design under relevant_only, but it means shown recall is below the baseline 75% even though retrieved recall is up.

## Teaser padding (RETR-05)

| | Phase 2 final | Phase 3 final |
|---|---|---|
| Responses with exactly 4 teasers | 46/50 | 1/50 |
| Teaser count distribution (0/1/2/3/4) | 0/1/2/1/46 | 3/11/19/16/1 |
| Mean teasers, zero-expected queries (n=20) | 3.8 | 1.40 (0:3, 1:6, 2:11, 3+:0) |
| Mean teasers, all queries | n/a | 2.02 |

Examples with fewer than 4 relevant studies showing only what exists:
- p5-q06 ("how much do u charge") and p5-q08 (catering): 0 teasers; the response says plainly it has no pricing or no catering work.
- p5-q03 (restaurant online ordering): one teaser, "AWS: Creating a New Kind of Product Demo", labelled "Adjacent work, not a restaurant project".
- p2-q08 (Reg FD review): one teaser, "AIG: When Stakes Are High: Reintroducing AIG to the Market", described as the closest match for the narrative layer and not as a compliance capability.
- p4-q09 (HHMI invention bait): 0 teasers; it states there is no HHMI case study.

Honesty check: fallback score is 4.98 and all 23 fallback queries pass the strict check. Adjacent teasers are explicitly labelled adjacent. One capability_not_shown claim exists (p5-q05, a StrategyCard implying AG plans in-person parties). RETR-05 is judged Met on the padding criterion; the leftover goal_as_result claims are a Phase 4 item and are not caused by padding.

## Prompt caching (RETR-04)

- Cache hits: 50/50 responses (`prompt_cache_hits` 50).
- Mean `cache_read_input_tokens`: 10,573 per response; no response had `cache_creation_input_tokens` > 0, so the prefix was already warm from the smoke run (1h TTL).
- Cost: generation across the 50 responses summed to $1.59 per the usage fields (about $0.032 each), against about $0.042 for a cold single call per `scripts/check-prompt-cache.ts` in 03-05.
- 03-05 check-prompt-cache: PASS (call 2 read 10,542 tokens, cost $0.0011 vs $0.0422 cold).
- Smoke run records 1-3 all showed `cache_read_input_tokens` 10,573 (greater than 0 as required).

## Offline gate vs eval

| Source | Recall |
|---|---|
| 03-07 offline gate (reranker off) | 43/52 (GATE: FAIL) |
| 03-08 offline gate (Cohere rerank on) | 44/52 (GATE (rerank): FAIL) |
| This eval (reranker off) | 43/52 |

The eval matches the offline number exactly, as the offline script uses the same retrieval code and rule. Turning the reranker on would be expected to give about 44/52, still under 47/52.

## Requirement check

- RETR-01: Met. `hybrid_search_v2` on 50/50 records; the original function is untouched.
- RETR-02: Met. Whole-word intent matching (03-02 tests).
- RETR-03: Met. No 0.15 cutoff; each response retrieves 8 chunks.
- RETR-04: Met. Catalogue prefix cached, hits 50/50, mean 10,573 cache-read tokens.
- RETR-05: Met. Exactly-4 responses 46/50 to 1/50; zero-expected mean 3.8 to 1.40; adjacent work is labelled; fallback 4.98.
- RETR-06: **Not met.** Recall 43/52 (83%) frozen, 43/49 (88%) corrected, target 90% (47/52). Cohere rerank (+1 recall, 44/52) was built and left off by user decision; it does not reach the target either.

## Next steps

- Recall lever options if the user wants to chase RETR-06: Haiku listwise rerank, D-04 re-chunking (needs a re-index and the user's approval), or query rewriting (deferred idea). The misses are mostly rank-cutoff misses (a relevant study sits just under the 6-study cap) plus 3 disputed labels.
- Squash Phase 3 into one commit and push only on the user's go-ahead (Plan 03-10).
- Held docs insert after production calls v2 (Plan 03-10).
