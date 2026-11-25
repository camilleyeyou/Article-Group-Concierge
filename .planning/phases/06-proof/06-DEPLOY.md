# Phase 6 deploy record (plan 06-09)

Date: 2026-11-25

## Scope change (user, 2026-11-25)

OpenRouter credit is $17.70 with no top-ups. No more paid eval or timing runs. The dry timing batch, the three timing batches and any production timing request are SKIPPED by user decision. The speed bar will be reported from existing production PERF measurements (STATE.md, quick 261124-80m notes). Only the free parts of this plan run: pre-deploy checks, and the deploy if the user picks a route.

## Pre-deploy checks (Task 1)

- Local HEAD: d8ee7ad. origin/main: 9baf304. 38 commits ahead of origin/main (all of Phase 6 plus the unpushed 06-05..06-08 work).
- `git status --short`: no uncommitted src/ or eval/*.ts changes. Only the pre-existing unrelated edits (.gitignore, .planning/config.json, 04-09-SUMMARY.md, EMAIL-TO-CLIENT.md, .claude/, the PDF zip, tsconfig.tsbuildinfo), which stay out of every commit.
- `npx tsx --test eval/*.test.ts`: 271 tests, 271 pass, 0 fail.
- `npx tsc --noEmit -p .`: no output (clean).
- `npm run build`: succeeded.
- Production env (`vercel env ls production`): PERF_TIMING: set. EVAL_DEBUG: not set.
- eval/timing-batches.json written with `--seed 6`: 3 x 20 disjoint ids, dry_ids p1-q03 and p1-q08, none in a batch (check printed `ok`). Fixed but unused (timing skipped).

## Timing

timing: skipped by user decision (budget). No dry batch, no counted batches, no production timing request. proof_commit is therefore not yet recorded.

## Deploy options (Task 2)

Pushing to main triggers a Vercel production deploy. The project rule is to squash the phase into one commit before pushing. 38 commits are ahead of origin/main.

- option-a: squash the phase's own files (src, eval, .planning/phases/06-proof, ROADMAP, STATE, workflow) into one commit on top of origin/main, push fast-forward. Production then serves code 844ae18-equivalent (prompt restored, recall 48/52, perf SSE comments, video/count fixes). Rollback levers: NEXT_PUBLIC_CHAT_STREAM=false, HERO_PASS_ENABLED=false, GENERATION_MODE=default.
- option-b: no push; `vercel deploy --prod` from a clean worktree of local HEAD. Production runs code not on main.
- hold: nothing changes in production; Phase 6 code stays local.

deploy_decision: option-a

## Deploy (Task 3, option-a)

- Rollback point (pre-squash HEAD): 9e65282 (tree d5de4b8c identical to the squashed commit, verified with git write-tree).
- Squash: `git reset --soft origin/main`, one commit b50bb0c `fix(06): proof fix pass and measurement tooling`; pre-existing uncommitted files stayed out.
- Push: fast-forward 9baf304..b50bb0c on main.
- proof_commit: b50bb0c
- Vercel deployment: dpl_8ngJFmZTiiz6aYrcAfARAjFJWXKM, production, Ready (41 s build), aliased to https://article-group-concierge.vercel.app
- PERF_TIMING: the user is switching it off in Vercel themselves; not changed by this plan. (At smoke time it was still on: 2 `: perf` lines seen.)
- Live smoke (original well_formed query p1-q03, no debug): events teasers (first), 26 narrative, 24 hero, hero_done, 3 component, final; `: perf` lines 2; `event: debug` 0. Teasers returned the expected Chorus case study first.
- Dry timing batch and counted batches: skipped by user decision (budget).
