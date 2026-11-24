# Phase 5 eval delta (PERF-01..PERF-03)

Date: 2026-11-23. Full run `2026-11-23T19-00-37` (batch `batch-2026-11-23T19-00-36`) at code commit `6fd1062`, streaming route, graded by Opus 5.5 only, harness v4. 50/50 queries ok, no errors.

**Headline: speed missed both gates locally (median t_teasers 2331 ms vs 1500, median t_hero_first 4166 ms vs 4000), and these local numbers are distance-inflated (Douala to Supabase adds about 1.2-1.6 s, see retrieval-latency debug), so the speed verdict is provisional until the production smoke in 05-10. Quality regressed under `adaptive_effort:low`: 4 of the D-513 gates failed (unsupported-claim responses 16 vs <= 6, voice 4.02 vs >= 4.28, capability_not_shown 1 vs 0, teasers_zero_expected_mean 1.80 vs <= 1.7). The generation mode was reverted to `default` (commit a83b0ba). The revert is UNMEASURED: no second eval was run.**

## Route and models

| Item | Value |
|---|---|
| Route | `openrouter` (local dev server with EVAL_DEBUG; never set in production) |
| Eval route | `/api/chat/stream` |
| Generation model | `anthropic/claude-sonnet-5.5` |
| Embedding model | `openai/text-embedding-3-small` |
| Judge | `anthropic/claude-opus-5.5` via openrouter (harness v4) |
| Generation mode during the run | `adaptive_effort:low` (from 05-08); now reverted to `default` |
| Code commit of the run | `6fd1062` |

## Runs

| Item | Id |
|---|---|
| Frozen baseline | `2026-11-20T15-12-31` |
| Re-graded baseline | `2026-11-21T07-32-49-regrade` |
| Phase 4 (D-513 baseline) | `2026-11-22T22-48-20` |
| Timing run (05-08) | `eval/results/stream-timing-2026-11-23T18-20-20` |
| **This run** | `2026-11-23T19-00-37`, batch `batch-2026-11-23T19-00-36`, cost_usd $3.73 |

Credit: $29.45 before, $25.72 after (about $3.74). No second grader. Task 1 approval: the user approved the paid run (option `run`). The UI check was NOT done (see Pending).

## Speed (D-510/D-511) - provisional

| Timing | Median | p90 | Max | n |
|---|---|---|---|---|
| t_teasers_ms (non-suppressed) | 2331 ms | 3114 ms | 3780 ms | 26 |
| t_hero_first_ms | 4166 ms | 5536 ms | 12029 ms | 50 |
| t_hero_done_ms | 4876 ms | 6277 ms | 12031 ms | 50 |
| t_complete_ms | 10121 ms | 12401 ms | 17587 ms | 50 |

Suppressed instant teasers: 24/50.

PERF-01: FAIL (median t_teasers 2331 ms, gate 1500) - provisional: local, distance-inflated; final verdict by production smoke in 05-10.
PERF-02: FAIL (median t_hero_first 4166 ms, gate 4000) - provisional: local, distance-inflated; final verdict by production smoke in 05-10.

Eval timings are conservative: debug bypasses retrieval and orchestrator caches, and the dev server is local. The local Douala to Supabase round trips inflate retrieval by about 1.2-1.6 s (`.planning/debug/retrieval-latency.md`); removing that from t_teasers would land near the gate, and from t_hero_first near 2.6-3.0 s. This is an estimate, not a measurement. Gate thresholds were not edited.

After the revert, hero-first with default thinking was measured at 12299 ms median in 05-TIMING.md (3 calls), so PERF-02 with the shipped mode is expected to MISS by a wide margin: PERF-02: MISSED (mode reverted; hero-first with default thinking measured at 12299 ms in 05-TIMING.md). That figure was a generation-only timing, not a full-route measurement.

Latency median_s: 10.1 s vs frozen 20.1 s (-10.0 s). This run used low effort; under `default` the Phase 4 median was 17.4 s.

## Instant teasers (D-504 / D-512)

| Floor | Fallback suppressed | Bait suppressed | Direct falsely suppressed | Missed fallback ids | False-direct ids |
|---|---|---|---|---|---|
| 0.40 | 20/21 | 5/5 | 4/29 | p4-q07 | p2-q03, p2-q05, p2-q06, p4-q06 |
| 0.45 | 21/21 | 5/5 | 8/29 | none | p1-q07, p2-q03, p2-q04, p2-q05, p2-q06, p2-q10, p3-q10, p4-q06 |

Expected known misses: p4-q03 was labelled a fallback in the calibration fixture, but this run's grader judged its context relevant (Simons education launch is a direct match), so it is not a fallback query here and is not among the missed ids. Its context relevance is a content gap (Simons education work is not indexed). Recorded vs recomputed suppression at the configured floor: 0 mismatches.

Flash rate: 26/78 (33.3%) of instant teasers were absent from the final layout. Reported, not gated.

## No-regression (D-513) vs 2026-11-22T22-48-20

| Gate | Value | Limit | Phase 4 | Result |
|---|---|---|---|---|
| goal_as_result claims | 1 | <= 2 | 2 | PASS |
| invention_bait_presupposed | 0 | <= 0 | 0 | PASS |
| capability_not_shown claims | 1 | <= 0 | 0 | FAIL |
| responses_with_unsupported_claims | 16 | <= 6 | 6 | FAIL |
| recall hit (frozen set) | 47 | >= 47 | 47 | PASS |
| teasers_zero_expected_mean | 1.80 | <= 1.7 | 1.55 | FAIL |
| D-307 responses with 4 CaseStudyTeasers | 1 | <= 3 | n/a | PASS |
| grounded | 4.50 | >= 4.46 | 4.78 | PASS |
| voice | 4.02 | >= 4.28 | 4.36 | FAIL |

D-513: REGRESSION (capability_not_shown, responses_with_unsupported_claims, teasers_zero_expected_mean, voice)

Caveats: single run, noise (grounded SD 0.16, voice SD 0.04). Voice -0.34 is well beyond noise; unsupported-claim responses 6 to 16 is well beyond noise. 14 of 16 unsupported claims are kind "other" (scope/ordering inferences, e.g. p4-q10 "we did not build the website", p5-q07 unqualified budget assurance), consistent with less deliberation. Hallucinations 0/50. Mode is the only generation-side change between Phase 4 and this run besides streaming, but the run does not isolate it from streaming/teaser changes; the attribution to the mode is likely, not proven.

Revert applied: `CONCIERGE_CONFIG.generation` set to `{ mode: 'default', effort: null }` in `src/lib/concierge-config.ts` (commit a83b0ba). No gate was loosened. The revert is unmeasured; 05-10 should decide whether to re-measure under `default` through the stream route.

## Metrics vs frozen baseline 2026-11-20T15-12-31

| Metric | Phase 4 | Frozen | This run | Δ vs frozen | Δ vs re-graded |
|---|---|---|---|---|---|
| grounded | 4.78 | 4.44 | 4.50 | +0.06 | +0.58 |
| components | 4.70 | 4.94 | 4.44 | -0.50 | -0.22 |
| fallback | 4.96 | 4.50 | 4.88 | +0.38 | +0.22 |
| cta | 4.88 | 4.36 | 4.82 | +0.46 | -0.12 |
| voice | 4.36 | 3.92 | 4.02 | +0.10 | -0.06 |
| hallucinations | 0 | 0 | 0 | 0 | 0 |
| responses_with_unsupported_claims | 6 | 22 | 16 | -6 | -26 |
| unsupported_claims_total | 6 | 38 | 16 | -22 | -97 |
| claims: goal_as_result | 2 | n/a | 1 | n/a | -16 |
| claims: capability_not_shown | 0 | n/a | 1 | n/a | -10 |
| claims: generated_tags | 0 | n/a | 0 | n/a | -69 |
| claims: other | 4 | n/a | 14 | n/a | -2 |
| recall_pct | 90% | 75% | 90% | +15 pp | +15 pp |
| recall_pct_corrected | 96% | 80% | 96% | +16 pp | +16 pp |
| shown_recall_pct | 71% | 75% | 75% | 0 pp | 0 pp |
| teasers_zero_expected_mean | 1.55 | 3.85 | 1.80 | -2.05 | -2.05 |
| t_teasers_median_s | n/a | n/a | 2.3 s | n/a | n/a |
| t_hero_first_median_s | n/a | n/a | 4.2 s | n/a | n/a |
| t_hero_done_median_s | n/a | n/a | 4.9 s | n/a | n/a |
| prompt_cache_hits | 50 | n/a | 50 | n/a | n/a |
| latency_median_s | 17.4 s | 20.1 s | 10.1 s | -10.0 s | -10.0 s |
| metrics_not_in_context | 0 | 0 | 0 | 0 | 0 |
| strict_fallback_pass | 23 | 16 | 22 | +6 | +4 |
| strategy_lead_offered_when_expected | 24 | 0 | 24 | +24 | +24 |
| strategy_lead_offered_unprompted | 11 | 0 | 7 | +7 | +7 |
| narrative_in_range | 49/50 | 17 | 47 | +30 | +30 |
| narrative_sentences_median | 3.00 | 5.00 | 3.00 | -2.00 | -2.00 |
| teaser_tags_not_from_db | 0 | 0 | 0 | 0 | 0 |
| video_queries_missing_video | 0 | 0 | 0 | 0 | 0 |
| pricing_timeline_figures | 0 | 2 | 1 | -1 | -1 |
| invention_bait_presupposed | 0 | n/a | 0 | n/a | n/a |

## PERF-03 evidence

- /api/health now reports live credit ($29.45 of $75 verified before the run). An earlier stale-credit bug (Next data cache on the OpenRouter credit call) was found and fixed in quick task 261123-f81, code commit 0b7e2a0, docs 6fd1062.
- Route openrouter; generation model `anthropic/claude-sonnet-5.5` (the run report header). The eval preflight reused the health check and passed.
- The raw `provider.status` / startup log line capture from Task 1 was not recorded in this session; unit tests in `eval/provider-health.test.ts` (11 mocked-fetch tests) cover each branch. Production /api/health verification belongs to 05-10.

## Phase 5 success criteria

| # | Criterion | Measured | Verdict |
|---|---|---|---|
| 1 | Teasers on screen in about 1.5 s | median 2331 ms local (p90 3114) | NOT MET locally; provisional (distance-inflated), final in 05-10 |
| 2 | Hero starts within about 3-4 s | median 4166 ms local with low effort; mode now reverted to default (12299 ms generation-only) | NOT MET locally; provisional, and likely missed under default |
| 3 | Health check confirms OpenRouter and credit | route openrouter, live credit verified, tests pass | MET (production check in 05-10) |
| 4 | Eval rerun with deltas and no quality regression | deltas reported above; D-513 REGRESSION on 4 gates | NOT MET for the no-regression clause; mode reverted (unmeasured) |

## Pending (for the user)

- UI check of the streaming UI was NOT performed: query 1 "What cybersecurity clients have you worked with?" (loading card, hero skeleton within ~2 s, in-place typing, teaser swap, fade-out, chips last); query 2 the Wiz CNAPP bait query (no teasers before the hero, no confirmation); optional reduced-motion check. Whether the owner objects to the known teaser-grid shift (D-503) is unrecorded; if so it is deferred to Phase 6.
- The Task 1 health curl and startup log line were not captured.
- Production smoke (05-10) gives the final PERF-01/PERF-02 verdict.

## Addendum: shipped configuration confirmed (default thinking)

After the 05-09 revert, two more evals were run with the user's approval to measure the configuration that ships (`generation: { mode: 'default', effort: null }`). The streaming route was used for every query, along with retrieval fixes 1–3 and the PERF-03 no-store fix.

Before that, the thinking-mode timing runs tested adaptive effort beyond 'low', costing about $0.08 in total:
- `adaptive_effort:medium` emitted no thinking (t_first_thinking_ms null on 3/3 calls). Hero-first was 1.87 s and output 1,198 tokens, the same behaviour as 'low', so it was not evaluated.
- `adaptive_effort:high` thought, with first thinking at about 3 s. Hero-first was 12.4 s and output 2,209 tokens, the same as default.
- No middle setting exists for this prompt.

| Gate | Low effort (19-00-37) | Default run A (19-25-08) | Default run B (19-49-22) | Limit |
|---|---|---|---|---|
| responses_with_unsupported_claims | 16 | 9 FAIL | **6 PASS** | <= 6 |
| capability_not_shown | 1 | 0 | 0 | 0 |
| goal_as_result | 1 | 1 | 2 | <= 2 |
| invention_bait_presupposed | 0 | 0 | 0 | 0 |
| recall hit | 47 | 47 | 47 | >= 47 |
| teasers_zero_expected_mean | 1.80 | 1.40 | 1.55 | <= 1.7 |
| grounded | 4.50 | 4.72 | 4.80 | >= 4.46 |
| voice | 4.02 | 4.52 | 4.44 | >= 4.28 |
| PERF-01 median t_teasers (local) | 2.33 s | 2.46 s | 2.26 s | <= 1.5 s |
| PERF-02 median t_hero_first (local) | 4.17 s | 13.21 s | 12.61 s | <= 4 s |
| median t_complete (local) | 10.1 s | 17.9 s | 17.8 s | baseline 20.1 s |

**Decision rule (user, before run B):** ship default if run B is <= 6, or if the two-run average is within Phase 4's range. Stop if it is >= 9. Run B = 6, so **default ships**. The two-run average is 7.5. Phase 4's last runs were 3, 4 and 6.

**Recurring claim patterns (for Phase 6):**
- p1-q07 "cybersecurity clients?" says the portfolio is "two" studies in both runs, while CrowdStrike is also retrieved.
- Several claims imply a sequence of work that the content does not state ("began with", "then integrated").

**Verdicts:**
- D-513 quality: PASS on the shipped config (run B), with run A at 9 recorded as variance.
- PERF-02: MISSED and deferred to Phase 6 (user decision). Hero speed needs thinking off, and thinking off breaks the Core Value. Phase 6 options are a capped thinking budget, a shorter prompt, or a retrieval-built hero.
- PERF-01: provisional local FAIL (2.26–2.46 s from Douala). The final verdict is the production smoke in 05-10.
- PERF-03: PASS. `/api/health` reports live credit after fix 0b7e2a0, verified as $29.45/$75 matching the startup log.

**Spend:** low-effort eval $3.73, default runs A $4.61 and B $3.77, timing $0.08. Credit remaining is $17.25.

**Still pending:** the user's UI browser check (cybersecurity query, Wiz CNAPP bait query, optional reduced motion) and the owner's view on the D-503 teaser-grid shift.
