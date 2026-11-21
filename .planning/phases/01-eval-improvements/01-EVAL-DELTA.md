# Phase 1 eval delta vs baseline 2026-11-20T15-12-31

Date: 2026-11-21. Code commit of the runs: `48583ef` (Phase 1 code complete; app prompt unchanged).

## Route and models

| Item | Value |
|---|---|
| Route | `openrouter` (production route; local dev server with EVAL_DEBUG) |
| Generation model | `anthropic/claude-sonnet-5.5` |
| Embedding model | `openai/text-embedding-3-small` |
| Judge | `anthropic/claude-opus-5.5` via openrouter (harness v2) |
| Second grader | `openai/gpt-5.6-sol` via openrouter (15 responses) |

## Runs

| Item | Id |
|---|---|
| Frozen baseline (harness v1, read-only, hashes verified before and after) | `2026-11-20T15-12-31` |
| Re-graded baseline (same responses, harness v2; `regrade_of` set) | `2026-11-21T07-32-49-regrade` |
| Fresh run 1 (with second grader) | `2026-11-21T07-38-07` |
| Fresh run 2 | `2026-11-21T08-04-22` |
| Batch | `batch-2026-11-21T07-38-07` |

Measured cost: re-grade $2.09; batch (2 runs + second grader) $8.83; total $10.92. OpenRouter credit: $45.24 before, $34.18 after. Both fresh runs: 50/50 queries succeeded.

## Metrics table (batch aggregate)

Display note: the aggregate prints count rows rounded to integers. Exact two-run means are in brackets where rounding hides them.

| Metric | Mean | SD | Min–max | n | Frozen baseline | Δ vs frozen | Re-graded | Δ vs re-graded |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| grounded | 3.89 | 0.16 | 3.78–4.00 | 2 | 4.44 | -0.55 | 3.92 | -0.03 |
| components | 4.77 | 0.04 | 4.74–4.80 | 2 | 4.94 | -0.17 | 4.66 | +0.11 |
| fallback | 4.65 | 0.04 | 4.62–4.68 | 2 | 4.50 | +0.15 | 4.66 | -0.01 |
| cta | 4.95 | 0.01 | 4.94–4.96 | 2 | 4.36 | +0.59 | 4.94 | +0.01 |
| voice | 4.11 | 0.04 | 4.08–4.14 | 2 | 3.92 | +0.19 | 4.08 | +0.03 |
| hallucinations | 1 [0.5] | 0.71 | 0–1 | 2 | 0 | +1 [+0.5] | 0 | +1 [+0.5] |
| responses_with_unsupported_claims | 41 [40.5] | 2.12 | 39–42 | 2 | 22 | +19 | 42 | -2 [-1.5] |
| unsupported_claims_total | 102 [101.5] | 0.71 | 101–102 | 2 | 38 | +64 | 113 | -12 [-11.5] |
| claims: goal_as_result | 17 [16.5] | 6.36 | 12–21 | 2 | n/a | n/a | 17 | -1 [-0.5] |
| claims: capability_not_shown | 12 [11.5] | 0.71 | 11–12 | 2 | n/a | n/a | 11 | +1 [+0.5] |
| claims: generated_tags | 58 [57.5] | 0.71 | 57–58 | 2 | n/a | n/a | 69 | -12 [-11.5] |
| claims: other | 16 [16] | 4.24 | 13–19 | 2 | n/a | n/a | 16 | 0 |
| recall_pct | 75% | 0.00 | 75%–75% | 2 | 75% | 0 pp | 75% | 0 pp |
| latency_median_s | 19.6 s | 0.64 | 19.2–20.1 s | 2 | 20.1 s | -0.5 s | 20.1 s | -0.5 s |
| metrics_not_in_context | 0 | 0.00 | 0–0 | 2 | 0 | 0 | 0 | 0 |
| strict_fallback_pass | 18 | 0.00 | 18–18 | 2 | 16 | +2 | 18 | 0 |
| strategy_lead_offered_when_expected | 0 | 0.00 | 0–0 | 2 | 0 | 0 | 0 | 0 |

Per-run values: grounded 3.78 / 4.00; hallucinations 1 / 0 (run 1: p4-q09, HHMI invention bait); responses with unsupported claims 42 / 39; claims total 102 / 101; goal_as_result 21 / 12.

## Old-comparable vs new metrics

Comparable to the frozen v1 grades (as numbers; the grader rules differ, see Harness effect): criteria averages, hallucinations, unsupported-claim totals, recall, latency, metrics_not_in_context (recomputed), strict_fallback_pass, Strategy Lead rule check (recomputed).

Exist only under harness v2: claims by kind, second-grader agreement. The Strategy Lead rule row is recomputed from stored responses, so it is comparable either way (0 offered when expected, as before; Phase 4 targets it).

## Harness effect (re-graded baseline minus frozen baseline, same responses)

| Metric | Frozen v1 | Re-graded v2 | Change |
|---|---|---|---|
| grounded | 4.44 | 3.92 | -0.52 |
| components | 4.94 | 4.66 | -0.28 |
| fallback | 4.50 | 4.66 | +0.16 |
| cta | 4.36 | 4.94 | +0.58 |
| voice | 3.92 | 4.08 | +0.16 |
| hallucinations | 0 | 0 | 0 |
| responses with unsupported claims | 22 | 42 | +20 |
| unsupported claims total | 38 | 113 | +75 |
| metrics_not_in_context | 0 | 0 | 0 |
| strict_fallback_pass | 16 | 18 | +2 |

- cta +0.58: the rubric no longer penalises a missing Strategy Lead offer that the app was never told to make (rule now from `src/lib/concierge-config.ts`).
- grounded -0.52 and unsupported claims 38 to 113: the v2 grader sees only the query and retrieved context (no persona, no expected block) and must list every claim not in context, classified by kind. 69 of the 113 are `generated_tags` (teaser capabilities/industries the retrieved content does not state), a category v1 did not count separately. This is a stricter measurement, not an app regression.
- metrics_not_in_context stays 0 in this recompute (number normalisation: `8M+` equals `over 8 million`). The frozen-notes value of 1 does not appear here; the table above is what the current code computes for the frozen responses.
- Median latency: standard median 20.1 s (frozen notes quoted 20.2 s, the upper-middle value).

## Claims by kind

| Kind | Re-graded baseline | Run 1 | Run 2 |
|---|---|---|---|
| goal_as_result | 17 | 21 | 12 |
| capability_not_shown | 11 | 11 | 12 |
| generated_tags | 69 | 57 | 58 |
| other | 16 | 13 | 19 |
| Total | 113 | 102 | 101 |

## Second-grader agreement (run 1, `openai/gpt-5.6-sol`, 15 responses)

Agreement score: 97% of criterion scores within ±1 of Opus (exact 79%, MAD 0.24).

| Criterion | Exact | Within ±1 | MAD | Weighted kappa |
| --- | --- | --- | --- | --- |
| grounded | 60% | 87% | 0.53 | 0.61 |
| components | 87% | 100% | 0.13 | 0.67 |
| fallback | 80% | 100% | 0.20 | 0.68 |
| cta | 87% | 100% | 0.13 | -0.07 |
| voice | 80% | 100% | 0.20 | -0.00 |

Hallucination-flag agreement 73%; "any unsupported claim" agreement 87%. Largest disagreements (2 points, both grounded): p3-q09 (Opus 4, second 2) and p5-q09 (Opus 4, second 2). The second grader is stricter on grounding; cta and voice kappa are near zero because scores barely vary (almost all 4s and 5s), so exact-match and MAD are the better read there.

## Reading the noise

The app is unchanged in Phase 1, so differences between fresh runs and the re-graded baseline, and the fresh SD, estimate run-to-run noise (n = 2, so rough).

| Metric | Fresh mean − re-graded | Fresh SD | Range |
|---|---|---|---|
| grounded | -0.03 | 0.16 | 3.78–4.00 |
| voice | +0.03 | 0.04 | 4.08–4.14 |
| responses with unsupported claims | -1.5 | 2.12 | 39–42 |
| recall | 0 pp | 0 | 75% |

Practical reading: grounded moves about ±0.15 between identical runs, so a later phase needs more than that to claim a gain; hallucination count (0 to 1) and goal_as_result (12 to 21) are noisy; recall and latency are stable. Phase 1 does not move recall (75%), which Phase 3 targets.

## Requirement check

- EVAL-01 (numbers normalised): `eval/numbers.ts`; metrics_not_in_context recomputed to 0 for the frozen and fresh responses; README "Number normalisation".
- EVAL-02 (claims by kind): report section "Unsupported claims by kind"; table above.
- EVAL-03 (no persona to grader): `eval/rubric.ts`; README "What the grader sees".
- EVAL-04 (rules from shared config): `src/lib/concierge-config.ts`; app prompt unchanged.
- EVAL-05 (N runs, mean, SD, min–max): `npm run eval:batch -- --runs 2`; `aggregate.md` above.
- EVAL-06 (second grader with agreement): `eval/grade-second.ts`; 97% within ±1.
- EVAL-07 (route and model IDs, deltas vs baseline, re-graded baseline): header block and tables above; `npm run eval:regrade`.
