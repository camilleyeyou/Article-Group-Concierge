# Phase 4 eval delta (GEN-01..GEN-07)

Date: 2026-11-22. Full run `2026-11-22T22-48-20` (batch `batch-2026-11-22T22-48-19`) at code commit `adf79a0`, graded with harness v4.

**Headline: responses with unsupported claims are 6/50 (frozen baseline 22/50, re-graded baseline 42/50, gap run 14/50): a large drop, but still above the < 5/50 target. Voice is 4.36 (frozen 3.92, re-graded 4.08, gap 4.18), below the 4.5 target. Goal-as-result claims are 2 (target 0), capability-not-shown 0, generated tags 0, invention-bait presupposed 0, hallucinations 0/50. Of the 5 Phase 4 success criteria, 1 is fully met (criterion 5, this report); criteria 1-4 each miss on one measure (see table).**

## Route and models

| Item | Value |
|---|---|
| Route | `openrouter` (local dev server with EVAL_DEBUG; never set in production) |
| Generation model | `anthropic/claude-sonnet-5.5` (`run.models.generation`) |
| Embedding model | `openai/text-embedding-3-small` |
| Judge | `anthropic/claude-opus-5.5` via openrouter (harness v4) |
| Search function | `hybrid_search_v2` on 50/50 records |
| Code commit of the run | `adf79a0` |

Models did not change from the gap run or the baseline. Retrieval did not change in Phase 4.

## Runs

| Item | Id |
|---|---|
| Frozen baseline (harness v1) | `2026-11-20T15-12-31` |
| Re-graded baseline (harness v2) | `2026-11-21T07-32-49-regrade` |
| Gap run (harness v3, production 2faba11) | `2026-11-22T13-42-12` |
| Smoke round 1 (21 queries) | `2026-11-22T22-17-35`, $1.65 |
| Smoke round 2 (21 queries, one prompt fix) | `2026-11-22T22-28-23`, $1.71 |
| **Full run (50 queries, Opus grader only)** | `2026-11-22T22-48-20`, batch `batch-2026-11-22T22-48-19`, cost_usd $4.14 |

User approval (Task 1): option id `run`, "Full run, Opus grader only (Recommended)" (~$4.30). Smoke verdict was `GO WITH GAPS`. No second grader.

Credit: $11.93 before the full run, $7.79 after (batch.json: $4.14). Phase 4 total: $15.97 before smoke to $7.79 after the full run, about $8.18 by credit delta (batch-measured: $3.36 smoke + $4.14 full = $7.50). 50/50 queries succeeded and were graded; no grader errors.

## Metrics table

Noise (STATE.md, earlier runs): grounded SD 0.16, voice SD 0.04, responses with unsupported claims 39-42 (harness v2), recall stable. One run only. The cta and voice deltas versus the v2/v3 runs mix app changes with rubric changes (v4: Strategy Lead required on five triggers, presupposition flag, narrative limits rendered from config, Larkspur example note). The harness-v4 rows have no v1-v3 grader value; the automated-check ones are recomputed from responses for every run, so they are comparable.

| Metric | Phase 4 | Frozen 2026-11-20T15-12-31 | Δ vs frozen | Re-graded 2026-11-21T07-32-49-regrade | Δ vs re-graded | Gap run 2026-11-22T13-42-12 | Δ vs gap | Beyond noise? |
|---|---|---|---|---|---|---|---|---|
| grounded | 4.78 | 4.44 | +0.34 | 3.92 | +0.86 | 4.60 | +0.18 | Yes vs re-graded; borderline vs gap (SD 0.16) |
| components | 4.70 | 4.94 | -0.24 | 4.66 | +0.04 | 4.88 | -0.18 | Borderline vs gap; see note |
| fallback | 4.96 | 4.50 | +0.46 | 4.66 | +0.30 | 4.94 | +0.02 | No vs gap |
| cta | 4.88 | 4.36 | +0.52 | 4.94 | -0.06 | 5.00 | -0.12 | No (rubric changed) |
| voice | 4.36 | 3.92 | +0.44 | 4.08 | +0.28 | 4.18 | +0.18 | Yes (SD 0.04), rubric also changed |
| hallucinations | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No |
| responses_with_unsupported_claims | 6 | 22 | -16 | 42 | -36 | 14 | -8 | Yes (noise 39-42) |
| unsupported_claims_total | 6 | 38 | -32 | 113 | -107 | 15 | -9 | Yes |
| claims: goal_as_result | 2 | n/a | n/a | 17 | -15 | 7 | -5 | Yes |
| claims: capability_not_shown | 0 | n/a | n/a | 11 | -11 | 2 | -2 | Yes |
| claims: generated_tags | 0 | n/a | n/a | 69 | -69 | 0 | 0 | Yes vs re-graded |
| claims: other | 4 | n/a | n/a | 16 | -12 | 6 | -2 | Within noise vs gap |
| recall_pct (frozen) | 90% (47/52) | 75% | +15 pp | 75% | +15 pp | 90% | 0 pp | No change vs gap (as expected) |
| recall_pct_corrected | 96% (47/49) | 80% | +16 pp | 80% | +16 pp | 96% | 0 pp | No change vs gap |
| shown_recall_pct | 71% (37/52) | 75% | -4 pp | 75% | -4 pp | 79% | -8 pp | Generation-side: 10 retrieved studies not shown (gap run 6) |
| teasers_zero_expected_mean | 1.55 | 3.85 | -2.30 | 3.85 | -2.30 | 1.45 | +0.10 | No |
| prompt_cache_hits | 50 | n/a | n/a | n/a | n/a | 50 | 0 | n/a |
| latency_median_s | 17.4 s | 20.1 s | -2.7 s | 20.1 s | -2.7 s | 19.0 s | -1.6 s | Run-to-run variation likely |
| metrics_not_in_context | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No |
| strict_fallback_pass | 23 | 16 | +7 | 18 | +5 | 22 | +1 | No vs gap |
| strategy_lead_expected | 25 | 25 | 0 | 25 | 0 | 25 | 0 | n/a |
| strategy_lead_offered_when_expected | 24 | 0 | +24 | 0 | +24 | 0 | +24 | Yes |
| strategy_lead_offered_unprompted | 11 | 0 | +11 | 0 | +11 | 0 | +11 | New behaviour; see note |
| narrative_in_range (2-4 sentences) | 49/50 | 17 | +32 | 17 | +32 | 10 | +39 | Yes |
| narrative_sentences_median | 3.00 | 5.00 | -2.00 | 5.00 | -2.00 | 5.00 | -2.00 | Yes |
| teaser_tags_not_from_db | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No |
| video_queries_missing_video | 0 | 0 | 0 | 0 | 0 | 0 | 0 | No |
| pricing_timeline_figures | 0 | 2 | -2 | 2 | -2 | 4 | -4 | Small counts |
| invention_bait_presupposed | 0 | n/a | n/a | n/a | n/a | n/a | n/a | Harness v4 only; 0 |

Notes. The latency figure the plan quotes for the gap run (20.1 s) is the baseline/live-smoke figure; the gap run's graded median is 19.0 s (03-GAP-EVAL-DELTA.md, compare.md). Components dropped 0.18 vs the gap run; grader reasons cite missed matching teasers (p1-q07, p3-q04) and capabilities/industries props still emitted on teasers in p1-q08 (the server overwrites tags from DB links, so the shown tags are DB-derived; `teaser_tags_not_from_db` = 0). The 11 unprompted Strategy Lead offers are over-offers relative to the shared config triggers; they are not penalised by the metrics.

## Phase 4 success criteria

| # | Criterion | Measured | Verdict |
|---|---|---|---|
| 1 | goal_as_result = 0, invention_bait_presupposed = 0, capability_not_shown = 0 | goal_as_result 2 (p3-q01, p4-q06), presupposed 0, capability 0 | NOT MET (goal_as_result 2) |
| 2 | Responses with any unsupported claim < 5/50; teaser tags from DB links | 6/50; teaser_tags_not_from_db 0, generated_tags 0 | NOT MET (6 vs < 5; tags part met) |
| 3 | Voice >= 4.5; narratives 2-4 sentences in "we" voice | voice 4.36; narrative_in_range 49/50 (p2-q05 has 5 sentences); distribution below | NOT MET (voice 4.36) |
| 4 | Video for video queries when a verified video exists; Strategy Lead on fallback, pricing, timeline | video_queries_missing_video 0 (6 video queries); Strategy Lead: fallback 20/21, pricing 3/3, timeline 6/6, invention_bait 5/5 | NOT MET (fallback 20/21: p4-q03, where the grader judged the context directly relevant) |
| 5 | Eval rerun with every metric's delta vs baseline 2026-11-20T15-12-31 | This document | MET |

Criteria fully met: 1 of 5. Sub-measures met: capability_not_shown, invention_bait_presupposed, generated tags, DB tags, video, Strategy Lead on pricing and timeline, narrative length (49/50), hallucinations. Misses are reported as measured; the smoke had flagged goal_as_result, claim count and voice as the likely gaps.

## Residual claims (6 responses, 6 claims)

| ID | Kind | Claim | Component |
|---|---|---|---|
| p2-q01 | other | "we shaped the narrative of its turnaround" (AIG engagement was a visual design system and keynote work) | narrative |
| p2-q03 | other | Google teaser implies an order of work ("synthesized priorities, then built the deck and design system"); context states no sequence | teaser summary |
| p3-q01 | goal_as_result | Salesforce teaser says our content "builds awareness ... and generates leads"; context says it "enables them to" (intended effect) | teaser summary |
| p4-q02 | other | Both Simons projects framed as "no product to point to" (inferred) | narrative |
| p4-q06 | goal_as_result | Simons teaser: "The brand brings its mission to life and brings its sub-brands under one umbrella" (what Simons wanted, not a stated result) | teaser summary |
| p4-q10 | other | Simons website work "not a full site build" (infers scope; also in smoke rounds 1 and 2) | narrative |

Three claims sit in teaser summaries and three in the narrative; none is a fabricated client, outcome or metric. p4-q10 repeats across the smoke rounds and this run.

## Strategy Lead by trigger

| Trigger | Expected | Offered |
|---|---|---|
| no_context | 0 | 0 |
| fallback | 21 | 20 (missed p4-q03) |
| pricing | 3 | 3 |
| timeline | 6 | 6 |
| invention_bait | 5 | 5 |

Gap run: 0 of 25 expected offered. Offered without any trigger: 11 (gap run 0).

## Narrative sentence distribution

| Sentences | 1 | 2 | 3 | 4 | 5+ |
|---|---|---|---|---|---|
| Responses | 0 | 4 | 22 | 23 | 1 (p2-q05, 5) |

Median 3 (gap run 5, baseline 5). Voice scores below 4 in this run: p2-q05 (5 sentences; Strategy Lead not the closing sentence) and p5-q07 (narrative restates the StrategyCard).

## Video, recall, latency

- Video queries: 6 (p1-q05, p3-q02, p3-q04, p3-q10, p4-q05, p5-q02), missing a VideoPlayer despite an available video: 0.
- Recall: frozen 47/52 (90%), corrected 47/49 (96%), identical to the gap run (47/52, 47/49), the same five misses. Retrieval is unchanged, so the only recall-side move is generation-side: shown recall 37/52 (71%) vs 41/52 (79%) in the gap run, with 10 retrieved-but-not-shown studies vs 6 (shorter teaser decks; teasers_zero_expected_mean 1.55 vs 1.45). With one run each this is within what run-to-run variation can produce, but it is the one quality metric that moved the wrong way.
- Latency median 17.4 s vs 19.0 s in the gap run and 20.1 s at baseline. Prompt cache hits 50/50.

## GEN-07 gate

Measured: responses with any unsupported claim = 6/50, which is >= 5. The gate triggers, so 04-07 and 04-08 (verifier on saved responses, latency vs the 2 s budget, user ship decision) are to be evaluated. Judgement note for the orchestrator: the measured count is 6, only one over the threshold, from a single run, and three of the six claims are teaser-summary wording that a verifier would target.

GEN-07 GATE: EVALUATE VERIFIER (unsupported-claim responses 6/50 >= 5)
