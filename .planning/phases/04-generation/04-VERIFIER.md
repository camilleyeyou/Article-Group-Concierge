# GEN-07 verifier evaluation (Haiku 5.5 claim-check, saved responses)

Gate line: `GEN-07 GATE: EVALUATE VERIFIER (unsupported-claim responses 6/50 >= 5)`
User approval (Task 1): option id `evaluate` ("Evaluate (~$3)"), credit before $7.56.

- Source run: `eval/results/2026-11-22T22-48-20` (Phase 4 full run; responses.json mtime unchanged, 1795388764 before and after)
- Verified run: `eval/results/2026-11-23T01-37-58-verified` (git-ignored; contains responses.json, grades.json, report.md, compare.md, verifier.json)
- Command: `npm run eval:verify-saved -- --of eval/results/2026-11-22T22-48-20`, run once, exit 0
- Cost: Haiku $0.0316 + Opus re-grade of 47 rewritten responses ~$2.14 = $2.17 total (verifier.json). Credit $7.56 -> $5.39 of $50.

## Metrics

| Metric | Phase 4 full run | With verifier | Δ |
|---|---|---|---|
| responses_with_unsupported_claims | 6 | 5 | -1 |
| unsupported_claims_total | 6 | 5 | -1 |
| claims: goal_as_result | 2 | 0 | -2 |
| claims: capability_not_shown | 0 | 0 | 0 |
| claims: generated_tags | 0 | 0 | 0 |
| claims: other | 4 | 5 | +1 |
| grounded | 4.78 | 4.78 | +0.00 |
| components | 4.70 | 4.66 | -0.04 |
| fallback | 4.96 | 4.88 | -0.08 |
| cta | 4.88 | 4.58 | -0.30 |
| voice | 4.36 | 4.18 | -0.18 |
| narrative_in_range | 49 | 49 | 0 |
| invention_bait_presupposed | 0 | 0 | 0 |
| strategy_lead_offered_when_expected | 24 | 21 | -3 |

Per-id: claims removed in p2-q01, p2-q03, p3-q01, p4-q06 (4); claims newly appearing in p2-q09, p3-q02, p4-q05 (3, all kind `other`); p4-q02 and p4-q10 still carry one each. Net 6 -> 5. No new claim kind appears (the only kind that rose is `other`, already present).

## Latency added (D-419 budget <= 2 s)

Per response, verifier call only (it runs after generation on the non-streaming path): median 2564 ms / p90 3359 ms / max 6038 ms. Median is over budget.

## Failures

1 of 50: p5-q01 `unparseable` Haiku output. It failed open, the unverified response was kept (as designed). No timeouts.

## Rewrite classification

47 of 50 responses were rewritten, 180 rewrites in total (about 3.6 per response). The verifier rewrites nearly every response.

- Rewrites whose own stated reason says the span is supported or acceptable (false positives): at least 71 by keyword match, plus roughly another 10 by reading the reasons ("advice and approach description; not a factual claim", "keep as is", "wording is acceptable", "fine"). So over 40 percent are churn on supported text.
- Rewrites that removed or softened a real overclaim: a minority, concentrated in goal-as-result wording (p1-q07 t1, p1-q10 t0/t1, p2-q07 t0/t2, p2-q09 t2).
- New claims introduced by a rewrite: see examples 3, 4 and 5.

### Examples (before -> after)

1. Good, removes unsupported claim (p2-q04, CTA content):
   - Before: "...and clear legal availability before anyone gets attached to it."
   - After: "...and be checked for availability before you commit to it."
2. Harmless false positive (p1-q06, Meta teaser): "we delivered..." -> "For Meta, we delivered..." with an added serial comma. Meaning unchanged, but it counts as a rewrite and forced a re-grade.
3. New claim (p4-q02, content): "Our approach starts with..., then explains rather than sells." gains "Our article on explanation argues that persuasion can insult the audience, so we invite people..." This is an attribution to a specific article that the original did not make. It needs checking against the index; the grader still flagged p4-q02 as unsupported afterwards.
4. New claim and removed honest hedge (p4-q10, explanation):
   - Before: "...and we haven't published whether education content would sit inside one engagement or a separate one."
   - After: "...and the case studies here don't give a standard timeline, so our Strategy Lead can scope it with you."
   The rewrite replaces a plain statement of the gap with an offer of a Strategy Lead scoping step. The hedge was true and supported; the replacement adds a capability offer.
5. Adds an unstated purpose (p2-q09, Omnicell teaser): "...a two-page battle card to carry Omnicell's autonomous pharmacy positioning into sales conversations" -> "...to help Omnicell's sales teams carry its autonomous pharmacy positioning into prospect conversations." The grader newly flagged p2-q09 (`other`).
6. Voice loss from source-phrase reversion (p2-q07, AWS teaser): "custom animations, video and 3D modeling" -> "unique animations, efficient video production and cutting-edge 3D modeling to make AWS re:Invent technology feel concrete"; "We handled multiple keynotes" -> "We juggled multiple keynotes". The verifier pulls teasers back toward the case-study marketing wording, which is accurate to the source but reads as more promotional and less like the Concierge voice.

Also noted: p2-q07 explanation and p1-q07 explanation were reworded without clear need ("explained a product" -> "explained a product's technical capabilities"). Not a meaning reversal, but a drift toward the source's phrasing. p4-q02 also dropped a true, supported statement ("where there's no product to point to") from the explanation.

## Criteria check

| Criterion | Result | Pass |
|---|---|---|
| responses with claims < 5/50 | 5/50 | No (5 is not < 5) |
| no new claim kind | none new (`other` +1) | Yes |
| voice not down by more than 0.1 | -0.18 | No |
| median added latency <= 2 s | 2.56 s | No |

Also: CTA -0.30, 3 new claims introduced against 4 removed, 1 parse failure, 47/50 responses touched.

RECOMMENDATION: SHIP DISABLED
Reason: three of four criteria fail (claims 5/50 not under 5, voice -0.18, median added latency 2.56 s). Net claim reduction is 1 response, bought with +2.6 s per answer, a 0.18 voice drop, a 0.30 CTA drop and several rewrites that add new, unverified wording. The code stays in place; Phase 5 can revisit it off the first-content path, with a prompt that only returns spans that actually need changes.

VERIFIER DECISION: SHIP DISABLED (user option: ship-disabled, 2026-11-22)
