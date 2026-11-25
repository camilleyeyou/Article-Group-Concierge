# Phase 6 fix notes (generation side, plan 06-05)

Tuned on the original 50 queries only (D-602). No held-out query was read.

## Voice

Evidence (run 2026-11-24T10-42-25, 27 of 50 responses scored voice 4; mean 4.48 vs bar 4.5):
- Narrative first step restates the StrategyCard: p1-q02, p2-q02, p3-q01, p3-q02, p3-q05, p4-q03, p5-q03, p5-q05, p5-q06, p5-q08, p5-q09 (D-408).
- HeroBlock challengeSummary reads meta or defensive ("Here's what..."): p3-q09, p4-q09, p5-q07 (D-409).
- Off-voice wording: "the work we retrieved" (p5-q07), "I won't point you" (p5-q01), "so we won't claim any" (p3-q03).
- p2-q04 sentence counter: "J.P. Morgan" was split into 3 sentences instead of 2. Confirmed by running countSentences; fixed by adding "J.P." to the abbreviation list in src/lib/sentences.ts (test added).

Change: `voiceRule()` in src/lib/concierge-config.ts, rendered in SYSTEM_PROMPT Tone & Voice; the challengeSummary rule is also appended to `heroPassInstruction()`. Asserted in eval/prompt.test.ts and eval/concierge-config.test.ts.

Owning-phase rules kept: Phase 4 honesty rules, 2-4 sentence "we" narrative, Strategy Lead triggers, example interaction, teaser policy all unchanged. Models unchanged.

## Count claim (p1-q07)

Evidence: p1-q07 narrative said "These are the two cybersecurity studies in our portfolio" while CrowdStrike was also retrieved; grader grounded=4: "The claim that there are only two cybersecurity studies ignores the retrieved CrowdStrike work." This is an exhaustiveness claim, a D-404 no-inferred-facts breach.

Change: `countClaimRule()` in concierge-config, rendered in SYSTEM_PROMPT right after voiceRule. Tested in eval/prompt.test.ts.

Owning-phase rule kept: Phase 4 D-404 (no inferred facts).

## Video

Flagged query: **p4-q05** ("tell the stories of our scientists on film", `video_query_missing_video: true`). 06-CONTEXT names p4-q09; that is wrong for the missing-video flag. p4-q09 and p4-q10 only carry `videos_available_not_used: [google-for-education-...]`.

Facts:
- p4-q05 retrieved Google for Education (GFE) with `vimeo_url = https://vimeo.com/877614456`, which is in `CONCIERGE_CONFIG.videos.unplayableUrls` (hidden by quick 261124-0q7). formatContext renders `Vimeo URL: None` for it, but the eval check counted the raw URL.
- Harness correction made (automated check only; HARNESS_VERSION and grader rubric unchanged): `runAutomatedChecks` now applies `isPlayableVideoUrl` in both the `videos_available_not_used` loop and the `video_query_missing_video` condition. Tests in eval/video.test.ts. This clears `videos_available_not_used` for GFE in p4-q09 and p4-q10.
- **It does NOT clear p4-q05.** p4-q05's retrieved chunks also include playable MP4 studies (AWS/NVIDIA Project Ceiba, Chrome Enterprise explainer, ADP testimonial). The response presented only re:MARS (no video) and GFE (dead), so the app behaved correctly, but the `video_query_missing_video` condition looks at all retrieved case studies, not the presented ones (unlike `videos_available_not_used`, which is restricted to presented studies under `relevant_only`). Not changed here; see Option D.
- Read-only DB check (select only on `documents` and `support_videos`, service role, no writes): GFE `documents.vimeo_url` is the dead URL; `support_videos` has one row for GFE (display_order 1): `.../case-study-videos/google-for-education-a-world-of-perspectives-on-the-future-of-learning/Telling_stories_about_AI_..._Teaching-For-Tomorrow-Trailer_refresh-v02.mp4` (the approved trailer from 02-VIDEO-AUDIT row #24).
- The app does not surface support videos to the model: `support_videos` is read only by `src/app/api/case-study/[slug]/route.ts` (detail page). retrieveContext and formatContext never touch it. So the detail page can show the trailer; chat cannot.

db_change_needed: false

(false for A, C, D; option B is the only one that writes to the DB, one row.)

Options:
- **A (code only):** formatContext shows the study's support MP4 when the primary URL is unplayable. Needs support-video data in retrieval, i.e. an extra select on the hot path or a catalogue-style cache; risk to PERF-01 teaser latency and a retrieval-shape change. Implemented only after the user picks it.
- **B (data):** set the trailer MP4 as GFE `documents.vimeo_url` (backup row first, single additive update; Phase 2 rule: needs approval). Chat, detail page and eval then agree with no code or latency change. Caveat: poster preview (`.poster.jpg` sibling, quick 261124-0q7) may not exist for this file; check before applying.
- **C:** no change beyond the harness fix. App correctly has no playable GFE hero video.
- **D (harness, extra):** restrict `video_query_missing_video` to presented studies, to match `videos_available_not_used`. Needed if p4-q05 should stop being flagged regardless of A/B/C, since p4-q05 did not present GFE-with-video as an option of its own accord. Can combine with any of A/B/C.

Recommendation: **B + D**. B is the smallest change that makes the data truthful (the study has an approved playable video; the dead one is hidden), with no latency or code cost, and is reversible from the backup. A adds a hot-path query for one study. D fixes the check that B/A/C alone leave flagging p4-q05. Needs the user's approval per the Phase 2 rule.

### Decision record

video_decision: option-b (confirmed by the user directly)
harness_option_d: applied

- D applied: `video_query_missing_video` now counts only case studies that are presented (teaser) when teasers.policy is `relevant_only`, matching `videos_available_not_used`. Tests in eval/video.test.ts; eval/metrics.test.ts and eval/rubric.test.ts fixtures updated to present the study. With D, p4-q05 (presented re:MARS and GFE, neither with a playable video) is no longer flagged.
- B pre-checks done (select/HEAD only): poster sibling `...Teaching-For-Tomorrow-Trailer_refresh-v02.poster.jpg` returned HTTP 400 (not present, so the chat/detail card would show no poster preview unless one is generated). `isPlayableVideoUrl` accepts the trailer MP4 (true). GFE has exactly 1 `documents` row for the slug. Backup written: `backup-video-2026-11-24.json` (documents row + support_videos).
- B applied by the user (2026-11-25), not by the agent: they ran the one-row UPDATE of `documents.vimeo_url` in the Supabase SQL editor (GFE slug to the trailer MP4 from `support_videos`). They also created the missing poster with `scripts/upload-video-posters.ts`, from a frame at t=2s of the trailer, at `.../google-for-education-.../Telling_stories_about_AI_that_are_actually_stories_about_people_Teaching-For-Tomorrow-Trailer_refresh-v02.poster.jpg`.
- Verified read-only (main session, and again by this agent): exactly 1 `documents` row for the slug; `vimeo_url` is the trailer MP4 (HEAD 200); `isPlayableVideoUrl` true; `posterUrlFor(url)` resolves to the `.poster.jpg` (HEAD 200).
- Rollback: restore `documents.vimeo_url` from `.planning/phases/06-proof/backup-video-2026-11-24.json` (original value `https://vimeo.com/877614456`, which stays in `videos.unplayableUrls`, so rolling back hides the video again).

## Disclosures

- The `bank`/`insurer` finance keywords (06-06) are general synonyms chosen without consulting held-out queries, but they may affect held-out queries that mention banks or insurers. Plan 06-12's before/after page should note this.
- Phase 6 narrowed the `video_query_missing_video` automated check (option D) and corrected it to ignore unplayable video URLs (06-05). Earlier runs' values for this check are not strictly comparable; plan 06-12's before/after page must disclose this.

## Recall

Original 50 only (held-out excluded in code); no held-out query read. Offline gate `npm run eval:recall-offline`, every query on hybrid_search_v2, two passes identical.

| | pass 1 frozen | pass 2 frozen | corrected | zero-expected mean case studies |
|---|---|---|---|---|
| Before | 47/52 (90%) | 47/52 | 47/49 | 8.00 (n=20; every query returns exactly 8) |
| After | 48/52 (92%) | 48/52 | 48/49 | 8.00 |

Remaining misses: p1-q02 Renew Home, p1-q05 and p1-q07 Chorus (D-301 disputed, still count in the frozen bar), p2-q03 AIG.

Diagnosis (v2 result, matchCount 60, best chunk per document, cap 8):
- p2-q05 (expects AIG, J.P. Morgan, ADP): AIG rank 1, ADP rank 7, J.P. Morgan rank 11 (semantic rank 17, keyword rank 7, no intent boost; only events-keynotes fired). Cut by the cap of 8. The query says "global insurer" and "regulated industries"; the finance map had "insurance" but not "insurer".
- p2-q03 (expects AIG): no intent fired (no capability or industry word in the query: "legal review", "internal stakeholders", "governance", "approvals"). AIG is not in the top 14 case studies; the retrieved set is keynote/partner work (Salesforce, Box, ADP, Slalom). The only way to reach AIG is a keyword mapping from "legal review"/"governance"/"approvals" to finance, which is not a general synonym (those words are process language, not an industry) and would only be fitting the label. Rejected.

Lever used (Phase 3 compliant: existing DB slug, whole-word, no SQL, no reranker, cap unchanged at 8): added `bank` and `insurer` to the `finance` keywords in src/lib/intent-keywords.ts. Both are plain synonyms of the already-mapped `banking` and `insurance`; whole-word matching keeps "riverbank" and "bankrupt" out (test added in eval/intent-keywords.test.ts). Effect: J.P. Morgan enters the top 8 for p2-q05 (+1). No other query changed. check-intent-slugs: 14/14 and 16/16 exist. No supabase/ change, eval/queries.json unchanged.

Not tried: raising intentBoost (cannot help p2-q03, which has no intent) and maxCaseStudies above 8 (would add teaser padding; zero-expected mean is already pinned at 8.00).

recall_gate: FAIL (48/52, criterion is >= 49/52; the remaining misses are 3 disputed labels, 1 label with no general retrieval hook, 0 other)

Margin over the bar: 48/52 is 92%, bar is 90% (46.8/52 on this set), so the starting margin is about 1 expectation.

recall_decision: option-a (user, 2026-11-25): proceed at 48/52 (92%) vs the 90% bar. The plan's 49/52 criterion was missed and is accepted by the user.

## Subset verification

Run `eval/results/2026-11-25T13-31-49` (phase6-fix, 21 original ids, Sonnet 5.5 / Opus 5.5) vs `eval/results/2026-11-24T10-42-25` on the same 21 ids. Full table in `eval/results/2026-11-25T13-31-49/compare.md`. Spend $1.90.

| Metric (same 21 ids) | New | Old | Delta |
|---|---|---|---|
| voice mean | 4.14 | 4.33 | -0.19 |
| grounded | 4.76 | 4.76 | 0 |
| responses with unsupported claims | 3 | 4 | -1 |
| unsupported claims total | 4 | 4 | 0 |
| goal_as_result / capability_not_shown / invention_bait_presupposed | 1 / 0 / 0 | 0 / 0 / 0 | goal_as_result +1 |
| recall (frozen) | 80% | 75% | +5 pp |
| recall corrected | 94% | 88% | +6 pp |
| hallucinations, teaser_tags_not_from_db, video_queries_missing_video, pricing_timeline_figures | 0 | 0 | 0 |

Voice per id: up on p1-q02 (4 to 5) and p2-q02 (4 to 5); down on p1-q07, p1-q09, p2-q03, p2-q09, p5-q10 (5 to 4) and p5-q05 (4 to 3). Net -4 points over 21 ids. Typical grader reasons for drops: narrative restates teaser content, "meta"/defensive phrasing ("rather walk you through it than claim more"), and a 5-sentence narrative on p5-q05.

Checks:
- p1-q07: no count or exhaustiveness claim. Text says "Both studies start from the problem you're describing" (about the two teasers shown), 0 claims. Fixed.
- p4-q05: video present (Google for Education interview series from Storage); video_queries_missing_video 0. 0 claims.
- Recall on subset ids is not lower (80% vs 75%).

Newly appearing claims (not in the old run on the same id):
- p2-q03 (goal_as_result): "ADP shows us staying with a client through every step of creation" (context says ADP needed a partner to ride along at every step; the delivered fact is AG became a teammate).
- p5-q05, second claim (other): "Both show how we ... keep it going after" (Chrome Enterprise content shows no post-event follow-up, only post-production).
Also present: p5-q05 "Our event work is virtual launch events and keynotes" (other; implies a complete view of the event portfolio, the retrieved AIG and re:MARS studies include in-person work), and p4-q04 "began with a research discovery report" (other, in both runs). Cleared since old run: p1-q07 and p3-q01 (1 claim each in the old run, 0 now).

Zero bars all 0 except goal_as_result 1 on p2-q03 (a new regression, the zero bar for goal_as_result is not met on the subset). Unsupported-claim responses 3 vs 4 (ok). Voice criterion (>= old + 0.1) missed by 0.29.

fix_subset: FAIL (reasons: voice 4.14 vs 4.33, needs >= 4.43; goal_as_result 1 on p2-q03, bar is 0). Passed: p1-q07 no count claim, unsupported-claim responses 3 <= 4, recall not lower, other zero bars 0.

Note: this is one run on a 21-id subset. The earlier noise measurement gave a voice SD of 0.04 on 50 ids, so a 0.19 drop on 21 ids is larger than that noise but the subset is small and the grader scores single points, so a handful of 5-to-4 moves can account for it.

go_decision: iterate (user, 2026-11-25; phase cap raised from $22 to $25). Gaps: narrative must not restate teasers; no meta/defensive phrasing or closers; no stretching adjacent work into practice claims ("staying with a client through every step", "keep it going after", "our X work is A and B"); narrative 2-3 sentences. Change: voiceRule rewritten (the 06-05 wording quoted the meta phrases it banned ("Here's what we found", "the closest answer to your question", "the retrieved work") and so risked priming them, and it had no length aim); new adjacentWorkRule; hero-pass challengeSummary rule no longer quotes meta examples. Config max stays 2-4 for the narrative_in_range metric; the prompt aims for 2-3.

## Subset verification, iteration 1 (commit 9033a46)

Run `eval/results/2026-11-25T13-45-56` (same 21 ids), compared with both earlier runs. Table: `eval/results/2026-11-25T13-45-56/compare.md`. Spend $2.09.

| Metric | Iter 1 | Run 10-42-25 (old) | Run 13-31-49 (first subset) |
|---|---|---|---|
| voice | 4.00 | 4.33 (-0.33) | 4.14 (-0.14) |
| grounded | 4.71 | 4.76 | 4.76 |
| responses with unsupported claims | 4 | 4 | 3 |
| claims total | 4 | 4 | 4 |
| goal_as_result | 3 | 0 | 1 |
| capability_not_shown / invention_bait_presupposed | 0 / 0 | 0 / 0 | 0 / 0 |
| other claims | 1 | 4 | 3 |
| recall frozen / corrected | 80% / 94% | 75% / 88% | 80% / 94% |
| hallucinations, errors | 0, 0 | 0, 0 | 0, 0 |
| median latency | 16.7 s | 17.2 s | 18.3 s |
| narrative_in_range, median sentences | 21/21, 3 | 21/21, 3 | 20/21, 4 |

What worked: the three claims the rule targeted are gone (p2-q03 ADP "every step", p5-q05 "keep it going after" / event-portfolio, p4-q04 order of work); narrative length is back to median 3 sentences (was 4); p1-q07 still 0 claims.

What did not: voice fell further (4.00). Per id vs the first subset run: down on p1-q05 (5 to 4), p2-q03 held 5, p4-q04 (4 to 3), p5-q06 (4 to 3), p5-q10 (4 to 3), p1-q02 (5 to 4), p2-q02 (5 to 4); up on p2-q03 (4 to 5) and p5-q05 (3 to 5). goal_as_result rose to 3, all in teaser summaries or hero text that turn a study's stated aim into an achieved effect:
- p1-q05: Chrome Enterprise video "explains capabilities like data loss prevention and deep malware scanning" (context states this as what the video needed to do).
- p2-q09: Simons Foundation rebrand "brings a variety of sub-brands under one umbrella" (what Simons wanted).
- p3-q01: Salesforce partner content "builds awareness of their Salesforce practices and generates leads" (stated aim). Also in the old run.
New: p1-q02 other: Chrome Enterprise work described as reclaiming territory "in a crowded security conversation".

fix_subset (iteration 1): FAIL (voice 4.00 vs bar 4.43; goal_as_result 3 vs bar 0). The adjacent-work rule fixed its targets, but the narrower narrative did not lift voice, and goal_as_result in teaser summaries is a separate gap that the existing "Deliverables, not aims" rule is not holding on these ids. Single run, 21 ids, whole-point scoring: voice moves of -0.14 between runs on the same prompt-family are within what 3 single-point moves produce, so the voice gap to 4.33 may partly be run noise. No second iteration or other paid run was started.

go_decision: revert-voice + full-50 (user, 2026-11-25; phase cap raised to $28). Code: removed `voiceRule` entirely (the 06-05 rule and the 9033a46 rewrite; pre-06-05 had no voiceRule, voice guidance is the Tone & Voice section and the "narrative must not restate StrategyCard" lines that already existed). Removed the 06-05 hero-pass challengeSummary line too: it was pure voice/meta guidance, not a claim fix, so it goes with the voice rule. Kept `countClaimRule`, `adjacentWorkRule` and the J.P. abbreviation fix. Tightened "Deliverables, not aims" to cover teaser summaries, HeroBlock text and the narrative, naming generic examples of aim-as-effect ("generates leads", "brings sub-brands under one umbrella", "explains capabilities like..."). No new voice rule.

## Full original-50 run after voice revert (commit 34ebea0)

Run `eval/results/2026-11-25T13-58-24`, 50/50 ok, 0 errors, 50 graded by Opus 5.5 (harness v4). Compared with `2026-11-24T10-42-25` (the 4.48-voice full-50 run, code ddf8371) and the two subset runs (subset runs only share 21 ids, so the 50-id deltas against them in compare.md mix id sets; use the same-21-ids section of 06-07 notes above for those). Spend $5.09 (above the ~$3.50 estimate; credit $27.74 to $22.65). Table: `eval/results/2026-11-25T13-58-24/compare.md`.

| Metric (50 ids) | This run | 10-42-25 | Delta |
|---|---|---|---|
| voice | 4.22 | 4.48 | -0.26 |
| grounded | 4.72 | 4.82 | -0.10 |
| components / fallback / cta | 4.60 / 4.92 / 4.82 | 4.62 / 4.94 / 4.88 | -0.02 / -0.02 / -0.06 |
| hallucinations | 0/50 | 0/50 | 0 |
| responses with unsupported claims | 10/50 (20%) | 4/50 (8%) | +6 |
| claims total | 10 | 4 | +6 |
| goal_as_result | 2 | 0 | +2 |
| capability_not_shown | 1 (p5-q08, "invitations") | 0 | +1 |
| other | 7 | 4 | +3 |
| recall frozen / corrected | 92% (48/52) / 98% | 90% / 96% | +2 pp |
| errors | 0 | 0 | 0 |
| median latency | 17.8 s | 17.6 s | +0.2 s |
| t_teasers / hero first / complete (median) | 1.9 s / 4.1 s / 17.8 s | 2.4 s / 3.9 s / 17.6 s | |
| narrative_in_range | 46/50, median 4 sentences | 50/50, median 3 | -4 |
| pricing_timeline_figures | 1 | 0 | +1 |

Phase 5 D-513 style gates on this run: FAIL on responses_with_unsupported_claims (10 vs <= 6), capability_not_shown (1 vs 0) and voice (4.22 vs >= 4.28); PASS on goal_as_result (2 <= 2), invention_bait (0), recall (48 >= 47), teasers_zero_expected (1.5), D-307, grounded (4.72 >= 4.46). PERF-01 (1.92 s) and PERF-02 (4.09 s) local gates FAIL as in earlier local runs (distance-inflated; judged in production).

Voice shift vs 10-42-25 on the 50 ids (old, new): 4->3 x4, 5->3 x2, 5->4 x10, 4->5 x5, unchanged x29. Net regression is spread, not concentrated.

New unsupported claims (ids with 0 claims in 10-42-25), all inferred-fact style, not the previously targeted patterns:
- p1-q05 goal_as_result: Chrome Enterprise video "explained technical security features to security decision makers" (stated as what it needed to do).
- p3-q06 goal_as_result: Salesforce/Slack teaser "giving global partners the language to market their Slack implementation services".
- p3-q03 other: "designed and produced virtual events" for Salesforce/WhatsApp (context shows a campaign culminating in a virtual event).
- p3-q04 other: Salesforce stories "made for partners".
- p3-q07 other: Slalom "came to us with the clock running" (context shows a backlog, not a deadline).
- p4-q01 other: "starting from a research discovery report" / "research-first process" (also p4-q04, already in the old run).
- p4-q09 other: Google for Education series as "public-facing".
- p5-q08 capability_not_shown: offering help with "invitations".
- p5-q09 other: Salesforce/WhatsApp described as "a launch campaign" (context says consideration and conversion).

Reading: with the revert, voice is 4.22, below the 4.48 reference and the 4.28 D-513 bar, and unsupported-claim responses are 10 vs 4. The 4 vs 10 gap is not explained by the voice revert (the old run's code ddf8371 predates 06-05). Candidate causes not yet isolated: the 06-05 countClaimRule and 06-07 adjacentWorkRule add prompt length without removing the inferred-fact failures; the longer narrative (median 4 vs 3, only 46/50 in range) suggests the narrative-length instruction is weaker than at ddf8371; or run variance (earlier noise: 2 fresh runs, unsupported-claim responses 39-42 on the v2 harness, a wide band). One run each, so the gap cannot be attributed from this data.

fix_full50: FAIL against the 10-42-25 reference (voice -0.26, unsupported-claim responses +6). No second iteration or other paid run started.

go_decision: revert-prompt + full-50 (user, 2026-11-25; cap: all remaining credit, no further top-ups). The user applied the restore of src/lib/orchestrator.ts and src/lib/concierge-config.ts to 7600919^ themselves (a hook blocked the executor's attempt); committed as 844ae18.

## Prompt revert and confirm run

Removed (prompt text restored to 7600919^): `voiceRule` (06-05, rewritten in 9033a46), the hero-pass challengeSummary line (06-05), `countClaimRule` (06-05), `adjacentWorkRule` (9033a46) and the tightened "Deliverables, not aims" wording (34ebea0). Reason: with the rules in place the full-50 run 2026-11-25T13-58-24 had voice 4.22 (vs 4.48), 10 responses with unsupported claims (vs 4) and capability_not_shown 1; the subset runs also lowered voice (4.14, 4.00). The rules fixed their targets on the subset, but other inferred-fact claims and weaker voice appeared elsewhere. Kept: the J.P. abbreviation fix (sentences.ts), the 06-06 bank/insurer keywords, the 06-04 PERF_TIMING SSE code and the eval-harness fixes. The diff of the two prompt files against 7600919^ is empty (verified by the user). Prompt tests for the removed rules were dropped (eval:test 271/271, tsc clean).

Confirm run `eval/results/2026-11-25T14-30-56` (50/50 ok, 0 errors, Opus 5.5, harness v4, code 844ae18), spend $4.81:

| Metric (50 ids) | Confirm | 10-42-25 | 13-58-24 (rules in) |
|---|---|---|---|
| voice | 4.48 | 4.48 | 4.22 |
| grounded | 4.76 | 4.82 | 4.72 |
| components / fallback / cta | 4.66 / 4.94 / 4.84 | 4.62 / 4.94 / 4.88 | 4.60 / 4.92 / 4.82 |
| hallucinations | 0 | 0 | 0 |
| responses with unsupported claims | 7/50 (14%) | 4/50 | 10/50 |
| goal_as_result / capability_not_shown / invention_bait | 1 / 0 / 0 | 0 / 0 / 0 | 2 / 1 / 0 |
| other claims | 6 | 4 | 7 |
| recall frozen / corrected | 92% (48/52) / 98% | 90% / 96% | 92% / 98% |
| median latency | 17.5 s | 17.6 s | 17.8 s |
| narrative_in_range, median sentences | 49/50, 3 | 50/50, 3 | 46/50, 4 |
| pricing_timeline_figures | 0 | 0 | 1 |

D-513-style gates: PASS on voice (4.48 >= 4.28), grounded, goal_as_result (1 <= 2), capability_not_shown (0), invention_bait (0), recall (48 >= 47), teasers_zero_expected (1.3) and D-307. FAIL on responses_with_unsupported_claims (7 vs <= 6, by one response). The run is not clearly worse than 10-42-25: voice is equal, recall is higher, and there are 3 more unsupported-claim responses. That is within the earlier run-to-run band on the v2 harness (39-42 of 50) but not proven to be noise.

Claims in the confirm run: p1-q05 goal_as_result (Chrome video "explains capabilities like data loss prevention"); p1-q07 other (Salt and Chrome called "our two security examples", ignoring the retrieved CrowdStrike study); p2-q09 and p4-q04 "began with a research discovery report"; p3-q03 "We don't publish attendance or engagement figures"; p4-q05 "shows how we handle people-first long-form video"; p5-q02 "shows what we can do with video made for Instagram and TikTok".

Open, accepted item: **the p1-q07 count claim is back** ("our two security examples"). `countClaimRule` fixed it on the subset, but the rule was removed with the revert because the rule set regressed voice and claims overall. Accepted through the user's revert decision. Disclose it in 06-12.

fix_confirm: not clearly worse than 10-42-25 (voice 4.48 = 4.48; unsupported-claim responses 7 vs 4). Decision: proceed with the reverted prompt.
