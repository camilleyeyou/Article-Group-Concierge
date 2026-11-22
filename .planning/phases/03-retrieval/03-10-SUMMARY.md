---
phase: 03-retrieval
plan: 10
subsystem: retrieval
tags: [git, deploy, supabase, held-docs]
requirements-completed: [RETR-01]
key-files:
  modified: [.planning/STATE.md, .planning/ROADMAP.md]
decisions:
  - "Phase 3 shipped as 2 commits (853bbe4 squash + 120ab9d build fix) because the first Vercel build failed"
  - "Held docs inserted only after the production deploy of 120ab9d was Ready"
metrics:
  completed: 2026-11-22
---

# Phase 3 Plan 10: Squash, push, deploy check, held-docs insert Summary

Phase 3 is on origin/main as two commits, production runs hybrid_search_v2, and the 20 held chunks (5 company_info + 15 excluded LinkedIn) are inserted with the exclusion filters proven on real rows.

## Squash and push (Task 1, user: "Squash and push")
- Backup: local branch `backup/phase3-pre-squash` = aa76ef5 (pre-squash HEAD).
- origin/main (4ffc437) was an ancestor of HEAD, so only 33 unpublished commits were squashed: `git reset --soft origin/main`, one commit **853bbe4** (53 files, no unrelated dirty files). Normal push, no force.
- **Phase 3 shipped as 2 commits.** The Vercel build of 853bbe4 failed in the lint step (`./src/lib/supabase.ts 218:3 Definition for rule '@typescript-eslint/no-explicit-any' was not found`, caused by an eslint-disable comment). Follow-up **120ab9d** `fix(03): remove reference to unloaded eslint rule that failed the Vercel build` (pushed by the orchestrator, normal fast-forward; local build and 78/78 tests pass). Amending would have meant force-pushing a published commit, so a follow-up commit was used.

## Production deploy confirmation (Task 2, user pre-approved "insert after deploy check")
- GitHub status for 120ab9d: success. Vercel `dpl_9tH2rDTaWin39Qke2CviGMwcAYUK`: target production, status Ready, aliased to article-group-concierge.vercel.app.
- Code at 120ab9d: `retrieveContext` calls `hybridSearchV2` (src/lib/supabase.ts:451, 463), which calls the `hybrid_search_v2` RPC (migration 005, applied in 03-01; check-hybrid-v2 PASS a confirms it exists, so the exact-function fallback is not taken).
- Live smoke: POST https://article-group-concierge.vercel.app/api/chat with `{"query":"Do you have work in healthcare?"}` returned a layoutPlan normally. EVAL_DEBUG was not used.
- Note: this is indirect evidence (deploy of the v2 code + v2 function present + live response). The live route does not expose which RPC ran.

## Insert log (Task 3)
`npx tsx scripts/insert-held-chunks.ts --insert --yes` inserted 20 chunks across 6 existing documents (embedding cost about $0.0001):
- `85830d1b-5bef-4d79-92fc-f9a2031b82a1` (1) Careers Overview
- `a57d51d3-b339-4be9-90b2-61505044351e` (1) Contact Page
- `0a8ad89e-5121-46b4-aed2-70ba6bd1494d` (1) Employee Rewards and Benefits
- `be42d40d-17ef-4819-ac17-4506b1d61389` (1) How We Work
- `47727981-6674-42ae-bbb0-8428a7bf74bd` (1) Jobs Page
- `7193dae0-3f55-4bd1-a7ec-79bee00acc35` (15) LinkedIn Posts Collection (excluded)

Log: data/.cache/held-insert-log.json.

## Verification
- `--verify`: 6/6 docs OK, expected 5 x 1 + 1 x 15 = 20, actual 20.
- `check-hybrid-v2.ts`: 8/8 PASS. d1 (no excluded/company_info rows with include_company_info=false) and d2 (no excluded rows with include_company_info=true) now run against 5 real company_info chunks, no longer trivially true.
- `eval/recall-offline.ts`: frozen 43/52 (83%), corrected 43/49 (88%), both passes identical; unchanged from 03-07/03-09. The D-303 gate (47/52) remains FAIL (known, RETR-06 not met, reranker off by user decision).

## ROLLBACK PRECONDITION
ROLLBACK PRECONDITION: before rolling production back past the Phase 3 commit, or if hybrid_search_v2 is ever dropped or bypassed, first remove or relabel the 20 held chunks (5 company_info + 15 excluded LinkedIn; needs user approval, it is a destructive DB change). hybrid_search_exact and hybrid_search cannot filter metadata.article_class, so the old code path would surface LinkedIn and company-info text.

Held document_ids are listed above. Changing `metadata.article_class` alone does not count as relabelling (the old functions ignore metadata); relabelling must change something hybrid_search_exact filters on, otherwise remove the chunks. Note that the Phase 3 code also falls back to hybrid_search_exact if v2 is missing, which would expose these chunks.

## Deviations
- [Rule 3 - Blocking] Production build failed after the squash push; fixed by follow-up commit 120ab9d (made by the orchestrator at the user's choice), so Phase 3 is 2 commits, not 1.

## Self-Check: PASSED
