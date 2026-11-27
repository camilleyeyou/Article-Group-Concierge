# Phase 07 trial: 10-query phase7-hero run

- Run: `eval/results/2026-11-27T15-22-37` (batch `eval/results/batch-2026-11-27T15-22-36`)
- Command: `EVAL_SECOND_GRADER=off npm run eval:batch -- --runs 1 --subset phase7-hero` (approved by the user 2026-11-27, "run")
- Code: 42ecb0c (v2 hero instruction default, hero restatement guard on, output guard v2); env defaults, EVAL_DEBUG=true on the local dev server only
- Models: generation `anthropic/claude-sonnet-5.5`, judge `anthropic/claude-opus-5.5` (OpenRouter), no second grader
- batch.json: query_count 10, held_out_count 0, proof false; 10 ok, 0 errors; no retries
- Cost: $0.47 (credit $9.91 -> $9.44)
- Reference: the same 10 ids in `eval/results/2026-11-26T05-24-15` (`npm run eval:compare`, written to the trial dir's compare.md)

## Metrics (same 10 ids)

| Metric | 2026-11-26T05-24-15 (same 10 ids) | Trial | Delta |
|---|---|---|---|
| voice | 3.70 | 4.00 | +0.30 |
| grounded | 4.60 | 4.90 | +0.30 |
| components | 4.50 | 4.70 | +0.20 |
| fallback | 4.90 | 5.00 | +0.10 |
| cta | 4.80 | 4.50 | -0.30 |
| hallucinations | 0 | 0 | 0 |
| responses_with_unsupported_claims | 3 | 1 | -2 |
| claims: goal_as_result | 2 | 0 | -2 |
| claims: capability_not_shown | 0 | 0 | 0 |
| claims: generated_tags | 0 | 0 | 0 |
| claims: other | 2 | 1 | -1 |
| invention_bait_presupposed | 0 | 0 | 0 |
| hero_restates (user-seen) | 10 | 0 | -10 |
| hero_summary_missing | 0 | 0 | 0 |
| hero_restatement_guard_changes | 0 (guard not in that code) | 0 | 0 |
| median t_hero_first | 3.56 s | 3.4 s | -0.2 s |
| median t_hero_done | 4.18 s | 4.33 s | +0.15 s |
| errors | 0 | 0 | 0 |

Claim trace (`trace.md`/`trace.json`): 1 claim in the trial, p4-q04 kind `other`, source `narrative` (field `explanation`): "began with a research discovery report rather than a logo" (order of work not stated in context). Hero-sourced claims: 0. Hero gap (user hero differs from graded hero): 0/10. Hero replay (`hero-replay.md`, detector v2): seen 0/10, graded 0/10.

Other guard actions in the trial (not hero rules, listed for completeness): p4-q04 `order_of_work` rewrite in a teaser summary (", starting with a " -> ", including a "); p5-q06 `retrieval_leak` dropped "None of the projects we retrieved speak to pricing, so I haven't shown any as a match." from the explanation.

## Trial heroes (as shown; no hero was changed by the guard, so this is also the pre-guard text)

| id | title | challengeSummary | guard |
|---|---|---|---|
| p1-q01 | Making One Platform Story Survive a New Sub-Category | A second product can fragment the story, so the platform narrative has to hold up for analysts and in the field before the visuals do. | none |
| p1-q04 | One Story, Told the Same Way in Every Pitch | When every rep tells a different story, the messaging strategy never reaches buyers and the pitch loses its force. | none |
| p1-q05 | Making a Technical Security Capability Legible | Explaining something technical with enough precision to earn expert trust, without losing the clarity that makes a short video worth watching. | none |
| p1-q08 | Proving Security Before the Spotlight | Credibility on security is earned through verified controls, and a conference deadline leaves little room to find the gaps. | none |
| p2-q05 | Finding Comparable Proof for a Global Insurer | Trusting a partner with complex, high-scrutiny communication means weighing how closely past engagements mirror the stakes, stakeholders and constraints of a global insurer. | none |
| p2-q09 | How a Repositioning Lands With Analysts and Brokers | Knowing whether a repositioning has convinced the specialist audiences who shape a market's view, and what evidence would show it. | none |
| p3-q01 | Co-Marketing That Scales Across Hundreds of Partners | Making materials simple and useful enough that partners adopt them, without losing consistency or control as the program grows. | none |
| p4-q04 | A Brand Scientists Will Respect | Earning credibility with people who distrust polish, where a brand that feels like gloss gets rejected before it is ever used. | none |
| p5-q06 | Scoping Creative Investment | Weighing what a creative partnership is worth against the scope of work, before committing budget to it. | none |
| p5-q07 | Making a Limited Budget Work Harder | Deciding where limited spend will matter most, and what to leave out, before committing to anything. | none |

Executor read of the text: none of the ten opens with "you", uses an asking frame, or copies a long run of the query. Two stay close to the query's own content without restating it word for word: p1-q04 ("When every rep tells a different story, the messaging strategy never reaches buyers", vs "every AE has their own version of the pitch and the messaging house isn't making it into the field") and p4-q04 ("a brand that feels like gloss gets rejected before it is ever used", vs "If they think the new brand is marketing gloss, they won't use it"). Both reframe the problem rather than repeat the question, so they are not counted as restatements. All ten are one sentence of about 25 words or fewer. p2-q05 does not claim Fortune 100 or senior-level experience, and p2-q09 does not presuppose MetLife work.

## Guard review

No trial heroes changed by the guard.

Trial guard false positives: 0

## GO/NO-GO

| Criterion | Value | Result |
|---|---|---|
| (PRIMARY) pre-guard restatements (hero_restatement_guard_changes + hero_restates) <= 4/10 | 0 + 0 = 0/10 | pass |
| user-seen hero_restates <= 2/10 | 0/10 | pass |
| false-positive guard changes in trial = 0 | 0 | pass |
| hero-sourced unsupported claims = 0 (trace) | 0 | pass |
| hallucinations = 0 | 0 | pass |
| capability_not_shown = 0 | 0 | pass |
| invention_bait_presupposed = 0 | 0 | pass |
| errors <= 1 | 0 | pass |
| median t_hero_done <= 4.68 s (same-ids 4.18 s + 0.5 s) | 4.33 s | pass |

Trial result: GO

GO means the full-50 run (07-05, ~$5) is worth proposing. It still needs its own approval; this trial approval does not cover it.

## Disclosures

- n=10, one run. Restatement is a per-answer yes/no, so 0/10 (vs 10/10 on the same ids before) is a real signal for these ten queries, but it is not a rate for the full set.
- Voice (+0.30) and the claim counts on 10 queries are not evidence for the full set. Phase 6 showed that small subsets mislead on voice. The full-50 decides.
- The guard did not fire in this trial, so the trial shows nothing new about the guard's live behaviour; its evidence remains the 07-03 replay (0 false positives over 176 reviewed changes).
- The detector has a known recall gap (07-03): close paraphrases without a "you" opener, asking frame or 6-word verbatim run are not flagged. The executor read all ten heroes and found none that restates the query, but two (p1-q04, p4-q04) sit close to the query's own content.
- Cost was $0.47, below the ~$1.00 estimate (short heroes, 10 prompt-cache hits).
