# Phase 07 eval delta: full original-50 (merged) vs 2026-11-26T05-24-15 and baseline

- Run: `2026-11-27T15-32-13-merged`, code `3397c63`, the original 50 queries, N=1, no held-out run, no second grader, not a proof run
- **Merged from two sessions** (see Disclosures): `2026-11-27T15-32-13` (38 ok records) + `2026-11-27T16-30-42` (12 ids re-run: p1-q10, p2-q01..p2-q10, p3-q01). Both sessions used the same commit `3397c63`, the same env (v2 hero prompt, hero restatement guard on, output guard v2), the same models and harness v4. Merged by `eval/merge-runs.ts`. The report was regenerated with `writeReport`, and both source dirs and commits are recorded in `responses.json` `merged_from`
- Models: generation `anthropic/claude-sonnet-5.5`, judge `anthropic/claude-opus-5.5` (harness v4)
- Cost: $4.66 for the first session (credit $9.44 -> $4.78, 38/50 ok, 12 network errors) plus $0.95 for the re-run (credit $4.78 -> $3.83, 12/12 ok) = $5.61. Merged result: 50/50 ok, 0 errors
- References: `2026-11-26T05-24-15` (code 18e09fa, Phase 06.1 confirm run) and frozen baseline `2026-11-20T15-12-31` (code a5b2722). Compare files: `compare-vs-2026-11-26T05-24-15.md` and `compare-vs-2026-11-20T15-12-31.md` in the merged dir

## Metric deltas

| Metric | Baseline 2026-11-20T15-12-31 | 2026-11-26T05-24-15 | New | Delta vs 05-24-15 | Delta vs baseline |
|---|---|---|---|---|---|
| voice | 3.92 | 4.06 | 4.58 | +0.52 | +0.66 |
| grounded | 4.44 | 4.82 | 4.78 | -0.04 | +0.34 |
| components | 4.94 | 4.58 | 4.62 | +0.04 | -0.32 |
| fallback | 4.50 | 4.92 | 4.96 | +0.04 | +0.46 |
| cta | 4.36 | 4.88 | 4.88 | 0.00 | +0.52 |
| hallucinations | 0 | 0 | 0 | 0 | 0 |
| responses_with_unsupported_claims | 22 | 7 | 9 | +2 | -13 |
| unsupported claims total | 38 | 8 | 9 | +1 | -29 |
| claims: goal_as_result | n/a | 2 | 1 | -1 | n/a |
| claims: capability_not_shown | n/a | 0 | 0 | 0 | n/a |
| claims: generated_tags | n/a | 0 | 0 | 0 | n/a |
| claims: other | n/a | 6 | 8 | +2 | n/a |
| invention_bait_presupposed | n/a | 0 | 0 | 0 | n/a |
| recall_pct | 75% | 92% | 92% | 0 pp | +17 pp |
| recall_pct_corrected | 80% | 98% | 98% | 0 pp | +18 pp |
| narrative_in_range (2-4 sentences) | 17 | 49 | 50 | +1 | +33 |
| hero_restates_pre_guard | 16 | 50 | 0 | -50 | -16 |
| hero_restates (user-seen) | 16 | 50 | 0 | -50 | -16 |
| hero_summary_missing | 0 | 0 | 0 | 0 | 0 |
| hero_restatement_guard_changes | n/a (no guard) | n/a (no guard) | 0 | n/a | n/a |
| guard_removed_summaries (drop_field) | n/a | n/a | 0 | n/a | n/a |
| median t_hero_first | n/a | 3.5 s | 3.7 s | +0.2 s | n/a |
| median t_hero_done | n/a | 4.2 s | 4.4 s | +0.2 s | n/a |
| median t_complete | 20.1 s (latency) | 17.3 s | 17.6 s | +0.3 s | -2.5 s |
| errors (merged result) | 0 | 0 | 0 | 0 | 0 |

The baseline column uses the frozen v1 grades. Claim kinds, invention-bait and hero timings did not exist in that harness (n/a). For 2026-11-26T05-24-15 and the baseline the hero guard did not exist, so pre-guard = hero_restates.

## Phase bars

| Bar | Value | Result |
|---|---|---|
| hero_restates_pre_guard <= 5/50 (PRIMARY) | 0/50 | PASS |
| hero_restates (post-guard, user-seen) <= 5/50 | 0/50 | PASS |
| hero-sourced unsupported claims 0 | 0 | PASS |
| hero gap 0/50 | 0/50 | PASS |
| unsupported-claim responses <= 7/50 | 9/50 | FAIL |
| goal_as_result <= 2 | 1 | PASS |
| hallucinations 0 | 0 | PASS |
| capability_not_shown 0 | 0 | PASS |
| invention-bait presupposed 0 | 0 | PASS |
| recall >= 90% | 92% | PASS |
| median t_hero_first <= 3.8 s | 3.68 s | PASS |
| median t_hero_done <= 4.5 s | 4.40 s | PASS |

Guard removed summaries: 0/50
Guard trimmed summaries: 0/50

11 of 12 phase bars pass. The miss is unsupported-claim responses, at 9/50 against a bar of 7. None of the 9 claims comes from the hero (see Remaining claims). The timing passes are narrow and depend on the merge (see Disclosures): the 12 re-run ids ran about 2x slower than the first session.

## Ready bars

| Bar | Value | Result |
|---|---|---|
| voice >= 4.5 | 4.58 | PASS |
| responses with unsupported claims <= 4/50 | 9/50 | FAIL |
| goal_as_result 0 | 1 | FAIL |
| capability_not_shown 0 | 0 | PASS |
| invention-bait presupposed 0 | 0 | PASS |
| hallucinations 0 | 0 | PASS |
| recall >= 90% | 92% | PASS |

5 of 7 ready bars pass, up from 4 of 7 in 2026-11-26T05-24-15 (voice now passes). Unsupported-claim responses and goal_as_result still miss.

## Guard activity

Guard version 2 ran inside the pipeline. It changed 3 of 50 answers and none of the changes touched a hero:
- p2-q05: retrieval_leak, drop_sentence. Dropped "The material we retrieved doesn't describe our clients' size or rank, so our Strategy Lead can speak to Fortune 100 expe…"
- p3-q02: count_claim, rewrite. "the only co-branded video" -> "a co-branded video"
- p4-q04: order_of_work, rewrite. ", beginning with a " -> ", including a "

hero_restatement changes: 0 (drop_field 0, drop_sentence 0). `eval/guard-saved.ts` on the saved (already guarded) text replayed 50 answers and changed 0, so there are no residual hits. The hero fix comes from the v2 prompt alone. The guard fallback never needed to fire.

## Heroes

- By guard action: 50 unchanged, 0 trimmed, 0 removed. Detector v2 (hero-replay in the merged dir) flags 0/50 seen and 0/50 graded heroes, against 50/50 in 2026-11-26T05-24-15. Mean query overlap is about 0.15 here and was 0.53 there
- 5 example pairs (2026-11-26T05-24-15 -> new, same id):
  - p1-q04: "Every AE has their own version of the pitch, and the messaging house isn't making it into the field. You want marketing and sales telling one story." -> "A messaging house that never leaves marketing leaves each rep to improvise, and the story buyers hear changes with every call."
  - p2-q05: "You're asking which of our engagements would be most comparable to a global insurer, particularly at the senior level and in regulated industries." -> "Judging whether a partner has handled the scrutiny, complexity and executive visibility that come with communicating in a heavily regulated industry."
  - p3-q01: "You're looking for kits and templates that partners will actually pick up and use, and for examples of how that works in practice." -> "Giving each partner enough to act on without every partner needing bespoke support, and without the kit sitting unused."
  - p5-q07: "You're asking whether a small budget is workable, and how to get the most from it." -> "Deciding where limited spend will matter most, and what a focused engagement can realistically deliver without diluting the work."
  - p2-q09 (invention bait): "You're asking about a MetLife brand repositioning and how analysts and brokers reacted to it." -> "Knowing whether a repositioning has actually shifted perception among the specialists who shape a brand's reputation, and what evidence would show it." The new hero no longer repeats the user's premise that we did MetLife work.

## Voice

- Distribution (5/4/3): new 30/19/1, against 7/39/4 in 2026-11-26T05-24-15
- By session: the 38 first-session ids average 4.50 (4.08 on the same ids in 2026-11-26T05-24-15). The 12 re-run ids average 4.83 (4.00 on the same ids there)
- 20 non-5 voice reasons. **None** says the hero restates the user's query. In 2026-11-26T05-24-15, 35 of 43 used the word "hero" and 17 explicitly said it restated the query (same keyword check on both runs). Remaining deductions:
  - Narrative restates the StrategyCard or a teaser (12): p1-q03, p1-q07, p2-q06, p2-q07, p3-q02 (score 3, plus the clumsy line "This is a co-branded video we've published, so we can't point to a second pairing"), p3-q08, p4-q03, p4-q04, p4-q05, p4-q08, p5-q03, p5-q04
  - Hero framing, not restatement (5): p4-q09 (HeroBlock "Checking the Record on Past Work" is meta and defensive), p4-q10 (generic), p5-q04 (echoes the StrategyCard title), p5-q08 (slightly overstates our hospitality role), p5-q09 (presumes the user is opening a location)
  - Wording (4): p3-q03 (meta line "These studies describe what we made…"), p3-q10 (clunky opening), p5-q07 (a touch formal for a casual query), p5-q10 ("we won't put figures on either here" is stiff)

  (p4-q10 and p5-q04 appear in two buckets.)

## Remaining claims (9, traced to source)

| id | session | kind | source | claim (grader wording) |
|---|---|---|---|---|
| p1-q03 | first | other | narrative | "we worked on the narrative, identity and product naming together (context says naming came in subsequent engagements)" |
| p2-q02 | re-run | other | narrative | "Renew Home and ADP show how we've worked directly with senior executives who were presenting on stage (ADP's executive session was for executives as an audience; on-stage delivery is not stated)" |
| p2-q07 | re-run | other | narrative | "Both AIG and ADP 'had us working with senior leadership' (ADP content says the session was for the highest-level executives, not that we worked with ADP's leadership)" |
| p3-q03 | first | other | narrative | "Narrative says we 'designed and produced' virtual events including Salesforce/WhatsApp, but that context shows only a campaign, event theme and pre- and post-event assets culminating in a virtual event, not production of the event itself." |
| p3-q09 | first | other | teaser summary | "Expands 'PMC' to 'Partner Marketing Center'; the retrieved context only uses the acronym PMC." |
| p4-q03 | first | goal_as_result | teaser summary + narrative | "Narrative states we 'built a brand system that unites the Foundation's sub-brands under one umbrella'. The context frames unifying sub-brands as what Simons wanted; the stated work is a visual system that 'unites the identity of the foundation'." |
| p4-q04 | first | other | narrative | "Both studies (including Simons Foundation) 'started with research and testing before any design'. The Simons content lists a research discovery report but states no order of work and no testing." |
| p4-q10 | first | other | narrative | "Our Simons work covered copy for the landing and About pages, not a full site build" |
| p5-q02 | first | other | narrative | "The AWS/NVIDIA film is 'our closest proof of video made for Instagram and TikTok'. The context says it was distributed across those channels, not made for them." |

By source: narrative 8, teaser summary 2, hero 0 (the p4-q03 claim is counted under both sources). Unmatched 0, hero gap 0/50. Claims that recur from 2026-11-26T05-24-15 are p2-q07 (ADP leadership), p3-q09 (PMC expansion), p4-q04 (order of work, now in different words), p4-q10 (Simons web copy) and the Simons sub-brands goal_as_result (it was p4-q04 then and is p4-q03 now). The new ones are p1-q03, p2-q02, p3-q03 and p5-q02. All but p3-q09 (a teaser acronym expansion) are narrative over-reach, which this phase did not target. 7 vs 9 is within the earlier run-to-run noise.

## Disclosures

- **Merged result from two sessions.** The approved full-50 run (`2026-11-27T15-32-13`) hit a local network outage from 15:36:40 to 15:37:20Z. Twelve queries (p1-q10, p2-q01..p2-q10, p3-q01) failed with `TypeError: fetch failed` in fetchEmbedding, so the stop rule (>5 errors) fired and was reported. The user approved re-running only those 12 ids once (`2026-11-27T16-30-42`, 12/12 ok). The merge took the 38 ok records and grades from the first session and the 12 from the re-run. Same commit `3397c63`, same env, same models, same judge and harness. The two sessions ran about an hour apart, so the grader and generation calls are not one batch.
- **Timing is affected by the merge.** The re-run ids were much slower than the same ids in 2026-11-26T05-24-15: median t_hero_first 7.0 s vs 3.6 s, t_hero_done 7.5 s vs 4.2 s, t_teasers 4.0 s vs 1.9 s. The network was probably still degraded after the outage, but that is an inference and was not measured. On the 38 first-session ids alone, the medians are t_hero_first 3.28 s (3.51 s on the same ids in 2026-11-26T05-24-15), t_hero_done 4.07 s (4.14 s) and t_teasers 1.75 s (2.05 s). The merged medians (3.68 s, 4.40 s) still pass the bars, but with less margin than the first session alone shows.
- **Voice is near the bar.** The merged mean is 4.58. The first-session 38 alone average 4.50, exactly at the 4.5 bar. The re-run ids scored higher, but they are different queries (their reference mean was 4.00, against 4.08 for the 38). Voice SD across two unchanged runs was about 0.04 under harness v2, so 4.58 is about 2 SD above the bar. That is one N=1 result, not a proven pass.
- N=1. Unsupported-claim responses varied a lot between runs earlier (39-42 under harness v2), so 9 vs 7 is not a measured regression.
- Since 06.1 the grader reads the hero the user saw (hero gap 0/50). Guard version 2 and hero prompt v2 were used. Eval runs send debug: true (cache bypass), so timings are cold.
- No held-out run, no second grader, no --proof. The 10-query trial (n=10) was only a gate for proposing this run. It did not decide the phase.
- `eval/report.ts` gained one header line ("Merged from") that is printed only when `merged_from` is set. Other reports are unchanged.
