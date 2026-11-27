# Phase 07 spend ledger

Budget: remaining credit (~$10.60 at phase start), no top-ups
Credit at readiness check: $9.91 (2026-11-27, `npm run eval:preflight`; the key's limit reads $100.00, the remaining figure is what counts)
Approved (trial): 10-query phase7-hero run (user, 2026-11-27): "run", covers only `EVAL_SECOND_GRADER=off npm run eval:batch -- --runs 1 --subset phase7-hero`, defaults env, no retries
Approved (full-50): one full original-50 run (user, 2026-11-27): "run", covers only `EVAL_SECOND_GRADER=off npm run eval:batch -- --runs 1`, default env (v2 prompt, guard on), no retries, no second grader
Approved (rerun-12): one run of only the 12 ids that errored in 2026-11-27T15-32-13 (user, 2026-11-27): covers only `EVAL_SECOND_GRADER=off npm run eval:batch -- --runs 1 --ids p1-q10,p2-q01,p2-q02,p2-q03,p2-q04,p2-q05,p2-q06,p2-q07,p2-q08,p2-q09,p2-q10,p3-q01`, default env (v2 prompt, guard on), about $1.20, no retries; stop and report if more than 2 of the 12 fail again. The 38 ok records and this re-run are merged into one 50-query result

| Step | Date | Credit before | Credit after | Cost | Running total |
|---|---|---|---|---|---|
| 07-04 trial: 10-query phase7-hero, N=1, no second grader (eval/results/2026-11-27T15-22-37) | 2026-11-27 | $9.91 | $9.44 | $0.47 | $0.47 |
| 07-05 full-50 (first session): N=1, no second grader (eval/results/2026-11-27T15-32-13). 50 run, 38 ok, 12 errors (p1-q10, p2-q01..p2-q10, p3-q01: `TypeError: fetch failed` in fetchEmbedding during a local network outage 15:36:40-15:37:20Z). Stop rule (>5 errors) fired: reported to the user, not retried. No batch.json (post-run credit check timed out); credit read by preflight | 2026-11-27 | $9.44 | $4.78 | $4.66 | $5.13 |
| 07-05 rerun-12: the 12 errored ids only, N=1, no second grader (eval/results/2026-11-27T16-30-42, batch-2026-11-27T16-30-40, commit 3397c63). 12/12 ok, 0 errors, no retries | 2026-11-27 | $4.78 | $3.83 | $0.95 | $6.08 |

Note: credit read $10.67 after the 06.1 confirm run and about $10.60 at planning. It now reads $9.91 ($0.69-$0.76 lower). No paid call was made in Phase 07 (plans 07-01..07-03 report $0 each and 07-04 so far is free). The gap is most likely the ~$0.70 demo verification in 06-11 or other use of the same key outside this phase. Not charged to Phase 07.

## Readiness (free, 2026-11-27)

- `npm run -s eval:test`: exit 0, 344/344 pass (incl. new phase7-hero subset test)
- `npm run -s type-check`: exit 0
- `npm run -s build`: exit 0
- Offline stream check (scratchpad script, `orchestrateStream` with injected `createEvents`/`createHeroEvents`, `catalogue: null`, no network), userQuery "how much do u charge", fast hero challengeSummary "You're asking what we charge.":
  - `final.output.layoutPlan.layout[0].props.challengeSummary` is undefined: **true** (title "Fast hero" kept)
  - `final.output.rawResponse` does not contain "You're asking what we charge.": **true**
  - `guard.changes` has rule `hero_restatement`: **true** (action `drop_field`, before "You're asking what we charge."; guard version 2)
- `heroPassInstruction()` (no argument, env unset) contains "must not repeat it back": **true** (v2 is the live default)
- `.env.local` key names: EVAL_DEBUG set to true (local only); HERO_PASS_PROMPT_VERSION, HERO_RESTATEMENT_GUARD_ENABLED, OUTPUT_GUARD_ENABLED, HERO_PASS_ENABLED not set (defaults: v2, guard on, output guard on, hero pass on). Values not printed.
- `npm run eval:preflight`: supabase ok (awake), openrouter ok $9.91 left, dev server ok (http://localhost:3000)
- Latest results dir is still 2026-11-26T05-24-15 (no new run)

## Trial proposal

- What: one run of the 10 `phase7-hero` ids (p1-q01, p1-q04, p1-q05, p1-q08, p2-q05, p2-q09, p3-q01, p4-q04, p5-q06, p5-q07), N=1, Sonnet 5.5 generation, Opus 5.5 judge, no second grader, no held-out, not a proof run
- Code: HEAD after 07-04 Task 1 (v2 hero instruction default, hero restatement guard on, output guard v2)
- Env: HERO_PASS_PROMPT_VERSION unset (= 2), HERO_RESTATEMENT_GUARD_ENABLED unset (= on), OUTPUT_GUARD_ENABLED unset (= on), EVAL_DEBUG=true in .env.local (local dev server only)
- Command: `EVAL_SECOND_GRADER=off npm run eval:batch -- --runs 1 --subset phase7-hero`
- Expected cost: about $1.00 (full-50 runs cost $4.77-$5.09, about $0.10 per query). Batch preflight requires $1.70 (10 x $0.07 + $1)
- Credit after (expected): about $8.90, leaving room for the ~$5 full-50 (07-05, separate approval)
- Stop rule: do not start if credit < $3; abort and report if more than 2 queries error; no retries without new approval
- Free post-processing: `npm run eval:compare -- --dir eval/results/<trial> --against eval/results/2026-11-26T05-24-15`, `npx tsx eval/trace-claims.ts ...`, `npx tsx eval/hero-replay.ts ...`

### GO/NO-GO criteria (fixed before the run)

| # | Criterion | Threshold |
|---|---|---|
| 1 | (PRIMARY) pre-guard restatements = hero_restatement_guard_changes + hero_restates | <= 4/10 |
| 2 | user-seen hero_restates | <= 2/10 |
| 3 | false-positive guard changes in trial (Guard review) | = 0 |
| 4 | hero-sourced unsupported claims (trace) | = 0 |
| 5 | hallucinations | = 0 |
| 6 | capability_not_shown | = 0 |
| 7 | invention_bait_presupposed | = 0 |
| 8 | errors | <= 1 |
| 9 | median t_hero_done | <= 4.68 s (same-ids median in 2026-11-26T05-24-15 is 4.18 s, + 0.5 s) |

GO only if every row passes. 10 queries can show restatement (a per-answer yes/no) and claim regressions; they cannot decide voice. The full-50 decides.

### Free evidence

- Before rate (07-HERO-REPLAY.md, detector v2): user-seen hero restates 50/50 in 2026-11-26T05-24-15 (you_opener 40, asking_frame 49, verbatim_run 18) vs 16/50 at baseline 2026-11-20T15-12-31. All 10 trial ids restate in 2026-11-26T05-24-15.
- Guard replay (07-HERO-GUARD-REPLAY.md): 946 heroes, 448 answers changed, 450 changes (341 drop_field, 109 drop_sentence); 176 changes reviewed, false positives 0 (after detector v2 removed 7 v1 false-positive sentences).
- Same-ids reference timing in 2026-11-26T05-24-15: median t_hero_first 3.56 s, median t_hero_done 4.18 s.

## Full-50 proposal

- Credit at proposal: $8.71 (2026-11-27, `npm run eval:preflight`: supabase ok, openrouter ok, dev server ok). This is $0.73 below the $9.44 read right after the trial; no Phase 07 paid call was made in between, so the gap is other use of the same key (as with the earlier $0.69-$0.76 gap). Not charged to Phase 07.
- What: one full original-50 run, N=1, no second grader, no held-out, not a proof run; Sonnet 5.5 generation, Opus 5.5 judge
- Code: HEAD (v2 hero instruction default, hero restatement guard on, output guard v2); env defaults, EVAL_DEBUG=true on the local dev server only
- Command: `EVAL_SECOND_GRADER=off npm run eval:batch -- --runs 1`
- Expected cost: about $5 (earlier full-50 actuals $4.77-$5.09)
- Credit after (expected): about $3.70
- Stop rule: do not start if credit < $6; abort and report if more than 5 queries error; no retries without new approval
- Trial evidence: "Trial result: GO" (07-TRIAL.md). Trial hero_restates (user-seen) 0/10, hero_restatement guard changes 0/10 (pre-guard 0/10, vs 10/10 on the same ids in 2026-11-26T05-24-15); all 9 GO criteria pass; cost $0.47
- Phase bars: hero_restates_pre_guard <= 5/50 (PRIMARY); hero_restates (post-guard) <= 5/50; hero-sourced unsupported claims 0; hero gap 0/50; unsupported-claim responses <= 7/50; goal_as_result <= 2; hallucinations 0; capability_not_shown 0; invention-bait 0; recall >= 90%; median t_hero_first <= 3.8 s; median t_hero_done <= 4.5 s
- Ready bars: voice >= 4.5; unsupported-claim responses <= 4/50; goal_as_result 0; capability_not_shown 0; invention-bait 0; hallucinations 0; recall >= 90%
- Caveat: voice >= 4.5 may still FAIL. Some voice deductions are not about the hero (e.g. the narrative restating the StrategyCard; the p1-q04 and p5-q07 reasons in 2026-11-26T05-24-15), and this phase does not touch them.

Phase 07 running total: $6.08 (trial $0.47 + full-50 first session $4.66 + rerun-12 $0.95). Credit left: $3.83.
