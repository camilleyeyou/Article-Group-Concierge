# Phase 4 smoke (phase4-smoke subset, 21 queries)

User approval (Task 2): option id `two-rounds` -- "Up to two rounds (max ~$4) (Recommended)". Credit before: $15.97.

## Runs

| Round | Run id | Batch id | cost_usd | Credit before | Credit after |
|---|---|---|---|---|---|
| 1 | 2026-11-22T22-17-35 | batch-2026-11-22T22-17-35 | 1.65 | 15.97 | 14.32 |
| 2 (after one prompt fix) | 2026-11-22T22-28-23 | batch-2026-11-22T22-28-23 | 1.71 | 13.99 | 12.28 |

Total smoke spend: $3.36 (cap $4). All 21 records ok per round, `hybrid_search_v2`, layout parsed 21/21, harness v4.

## Targets (same 21 ids)

| Target | Gap run | Round 1 | Round 2 | Met (R2)? |
|---|---|---|---|---|
| claims goal_as_result = 0 | 5 | 0 | 1 | No (1) |
| claims capability_not_shown = 0 | 2 | 0 | 0 | Yes |
| invention_bait_presupposed = 0 | n/a | 0 | 0 | Yes |
| responses with any claim <= 2/21 | 12 | 3 | 4 | No |
| narrative_in_range >= 19/21 | 3 | 20 | 20 | Yes |
| teaser_tags_not_from_db = 0 | 0 | 0 | 0 | Yes |
| Strategy Lead on every triggered query | 0/11 | 11/11 | 11/11 | Yes |
| video_queries_missing_video = 0 | 0 | 0 | 0 | Yes |
| voice >= 4.4 | 4.05 | 4.24 | 4.19 | No |
| layout_parsed 21/21 | -- | 21 | 21 | Yes |
| recall not below gap | 90% (corrected 100%) | 90% / 100% | 90% / 100% | Yes (shown_recall 85 -> 80%) |
| hallucinations | 0 | 0 | 0 | Yes |
| grounded | 4.33 | 4.81 | 4.71 | up |
| pricing_timeline_figures | 0 | 0 | 0 | Yes |

Total claims on subset: gap 13, round 1 3, round 2 4.

## Residual failures

Round 1 (3 claims, all `other`): p3-q03 "all three events ... designed and produced by us" (Salesforce/WhatsApp is a campaign culminating in a virtual event); p4-q10 website piece stated as copy for landing/About pages, not a site build; p5-q05 inferred principle "build an event and its promotion around one clear idea".

Round 2 (4 claims): p1-q02 goal_as_result "Salt defended its position in API security against newer competitors" (D-401 aim vs result); p3-q02 "the only co-branded video we've published" (unsupported exclusivity); p3-q09 expands "PMC" to "Partner Marketing Center" (not in context); p4-q10 website scope again. Voice below 4: p5-q05 (5 sentences, over the max) and p5-q07 (restates StrategyCard). Dominant voice reason in both rounds: narrative repeats the StrategyCard point.

Claim sets differ between rounds (only p4-q10 repeats), so with n=1 per round this is mostly run-to-run noise at the 3-4 claims level, not a systematic regression. No fabricated client, outcome or metric appeared; no new claim class versus the gap run.

## Prompt change between rounds

One revision in `src/lib/orchestrator.ts` (Tone & Voice): narrative and StrategyCard must not say the same thing; describe only what shown content states, no inferred principle/scope/deliverable. Lock added in `eval/prompt.test.ts`. It did not measurably help (claims 3 -> 4, voice 4.24 -> 4.19); the change is within noise and is kept as harmless. No third round run.

## Verdict

Claims fell from 13 to 3-4 on the subset, goal_as_result 5 -> 0-1, capability_not_shown 2 -> 0, narrative length, Strategy Lead and invention-bait behaviours hit target, with no hallucination, layout or recall regression. Missed: responses-with-claims (4 vs <=2), goal_as_result (1 vs 0), voice (4.19 vs 4.4). The full eval (04-06) should judge these across more runs.

SMOKE VERDICT: GO WITH GAPS
