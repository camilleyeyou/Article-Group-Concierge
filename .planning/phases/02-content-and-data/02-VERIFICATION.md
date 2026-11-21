---
phase: 02-content-and-data
verified: 2026-11-21T23:00:00Z
status: passed
score: 5/5 success criteria verified (SC1 with the recorded D-18 deviation: 44/50 articles chunked now, 6 held for Phase 3)
overrides:
  - criterion: "SC1 / DATA-01: all 50 articles have chunks and embeddings"
    decision: "D-18 (02-CONTEXT.md): hold the 5 company-info docs and the LinkedIn collection until hybrid_search_v2 can filter them; insert the other 44 now"
    state: "44/50 chunked (133 chunks), 6 held with 0 chunks (text in data/held-article-chunks.json, no embeddings)"
    owner: "Phase 3 (hybrid_search_v2 filter on metadata->>'article_class', then insert held chunks)"
deferred_items:
  - "Embed and insert the 6 held docs (20 chunks) once hybrid_search_v2 filters article_class (Phase 3)"
  - "Production still runs the lossy hybrid_search and the old intent maps until the Phase 2 squash is pushed and Vercel deploys"
---

# Phase 2: Content and data Verification Report

**Phase Goal:** The index contains all of AG's work with accurate tags and correct videos, so nothing real is missing or mislabelled.
**Verified:** 2026-11-21
**Status:** passed
**Re-verification:** No (initial verification)

Method: every check below was run read-only against the shared production Supabase project. The only scripts run were the existing verify modes, plus select-only `node -e` queries and RPC reads that reused cached query embeddings. No inserts, updates, deletes, `--apply`, `--yes` or `--restore` were run, and no LLM spend was made beyond the few query embeddings the verify modes make.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | All 50 articles have chunks and embeddings, and `hybrid_search` can return at least one for a relevant query | VERIFIED (D-18 deviation) | DB: 50 article docs, 44 with chunks, 6 without. The 6 without are exactly the held set: How We Work, Jobs, Careers, LinkedIn collection, Contact, Benefits. `embed-articles.ts --verify` returns VERIFY OK: the held docs have 0 chunks, there are no duplicate (doc, chunk_index) pairs and the summary count is still 43. The 3 article probes return the right article at rank 1 in `hybrid_search`, and the unfiltered probe returns 20 article rows. `content_chunks` = 192 (43 + 133 + 16). Holding the 6 docs is the user decision D-18, which asked for it to be recorded here. |
| 2 | Site work missing from the index = 0, including Simons education and Salesforce partner ecosystem | VERIFIED | 02-SITE-DIFF.md covers all 18 /work pages, each with a recorded decision: 7 ingested, 11 already indexed, near-matched or skipped. The skipped Google hub page is an umbrella over already-indexed engagements and was skipped for attribution risk. `ingest-site-work.ts --verify` returns VERIFY OK, and all 7 new slugs, including `simons-foundation-launching-a-first-ever-education-division-...` and `salesforce-supporting-the-largest-partner-ecosystem-...`, rank 1 for their own probes. There are no duplicate slugs. DB has 50 case studies, none without chunks. |
| 3 | Taxonomy no longer 39/43 "technology"; links match content; intent maps use only DB slugs | VERIFIED | `taxonomy.ts --check --against-db` returns CHECK --against-db OK, and the DB distribution equals the approved proposal. `technology` is linked to 5 case studies (was 39). Every case study has at least 1 capability. 3 studies have no industry, by the user's strict-evidence choice. Articles have 0 capability/industry links (D-08). Each added link has a verbatim quote in data/taxonomy-proposal.json, approved by the user. `check-intent-slugs.ts` prints `capabilities: 14/14 exist`, `industries: 16/16 exist` (exit 0). `supabase.ts` imports `detectQueryIntent` from `intent-keywords.ts`, and no old maps remain in `supabase.ts`. |
| 4 | Mismatched videos = 0; all 12 case-study videos audited; Google cross-product fixed or removed; audit recorded | VERIFIED | 02-VIDEO-AUDIT.md audits 25 rows: all 12 original heroes, the support rows, the Vimeo links and the unlinked files. Each row has a verdict and the user's approval. DB: `google-crafting-a-cross-product-narrative` has `hero_video_url` = null and `vimeo_url` = null, and 0 docs reference "Recruiting". The 10 heroes, 3 vimeo.com links and 6 support rows match the audit's "Final state". There are 0 duplicate support rows and 0 support rows equal to their own hero, so the idempotency-bug cleanup holds. 0 stale `vimeo_url` mirrors. |
| 5 | Eval rerun; every metric's delta vs baseline 2026-11-20T15-12-31 reported | VERIFIED | `eval/results/2026-11-21T21-15-13/report.md` shows recall 39/52 (75%). 02-EVAL-DELTA.md reports every metric against both the frozen baseline and the re-graded baseline `2026-11-21T07-32-49-regrade`, with a noise column. The run-1 regression (21%) is explained and fixed. |

**Score:** 5/5. SC1 is met for the 44 non-held articles now, and for the 6 held articles in Phase 3, per D-18.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/embed-articles.ts` | Idempotent article embed with prepare/simulate/insert/verify | VERIFIED | Insert refuses to run without `--yes`. Verify is read-only and passes. |
| `data/article-classes.json`, `data/held-article-chunks.json` | Classes and held text | VERIFIED | Present. The held set matches the 6 chunkless docs in the DB. |
| `scripts/site-work-diff.ts`, `scripts/ingest-site-work.ts`, `data/site-work.json` | Diff and insert-only ingest | VERIFIED | Without `--dry-run`, `--yes` or `--verify` the script refuses to run. Verify passes. |
| `scripts/taxonomy.ts`, `data/taxonomy-proposal.json`, `data/taxonomy-backup*.json` | Check/apply/restore with backup | VERIFIED | `--check --against-db` passes. Backup and restore path are present. |
| `src/lib/intent-keywords.ts` | Pure maps + `detectQueryIntent` + `allIntentSlugs` | VERIFIED | Wired into `supabase.ts:23` and `:355`. Unit tests are in `eval/intent-keywords.test.ts`. |
| `scripts/check-intent-slugs.ts` | Read-only DB proof | VERIFIED | Exit 0, 14/14 and 16/16. |
| `scripts/video-audit.ts`, `data/video-fixes.json`, `data/video-backup.json` | Audit, apply with backup | VERIFIED | Not run (it has no read-only verify mode). State was checked by direct select. |
| `supabase/migrations/004_hybrid_search_exact.sql` | Additive exact-search function | VERIFIED | The body is identical to 003's `hybrid_search` apart from `PERFORM set_config('ivfflat.probes','100',true)`. `hybrid_search` is untouched, and a rollback line is included. |
| `src/lib/supabase.ts` `hybridSearch` | Calls exact function, falls back on PGRST202/42883 | VERIFIED | Lines 149–157. |
| Phase docs (ARTICLES-IMPACT, SITE-DIFF, TAXONOMY-PROPOSAL, VIDEO-AUDIT, EVAL-DELTA) | Recorded decisions and results | VERIFIED | Each has an "Applied" section with the user's decision and dated approval. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `supabase.ts` retrieveContext | `intent-keywords.ts` | `import { detectQueryIntent }` | WIRED | Used for the filtered primary search. The unfiltered fallback search is kept, so a 0-doc slug (e.g. `social-strategy`) can't empty the results. |
| `supabase.ts` hybridSearch | DB `hybrid_search_exact` | `supabase.rpc` | WIRED | Live RPC returned 20/20 rows on 12 consecutive calls with cached eval-query embeddings. |
| intent slugs | DB `capabilities`/`industries` | `check-intent-slugs.ts` | WIRED | All exist. |
| New case studies | `content_chunks` + taxonomy links | ingest + taxonomy apply | WIRED | All 50 case studies have chunks and at least 1 capability link. |
| Video fixes | `documents.hero_video_url`, `support_videos` | `video-audit.ts --apply` (already run) | WIRED | DB state equals the audit's final state. |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| Retrieval of articles | article chunks | `content_chunks` via `hybrid_search_exact` | 48/50 eval responses include an article (02-EVAL-DELTA) | FLOWING |
| Retrieval of new studies | 7 new case studies | same | Retrieved in 2–10 eval queries each; ranked first on p3-q01 and p4-q03 | FLOWING |
| Video components | hero/support URLs | `documents`, `support_videos` | 10 heroes, 6 support, 3 vimeo; audit records storage URLs at HTTP 200 (not re-fetched here) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Types compile | `npx tsc --noEmit` | clean | PASS |
| Unit tests incl. intent-keywords | `npm run eval:test` | 55/55 pass | PASS |
| Intent slugs exist | `npx tsx scripts/check-intent-slugs.ts` | 14/14, 16/16, exit 0 | PASS |
| Taxonomy matches approved proposal | `npx tsx scripts/taxonomy.ts --check --against-db` | CHECK --against-db OK | PASS |
| Articles embedded, held set empty, probes hit | `npx tsx scripts/embed-articles.ts --verify` | VERIFY OK | PASS |
| Site work ingested, probes rank 1 | `npx tsx scripts/ingest-site-work.ts --verify` | VERIFY OK, 7/7 rank 1, summary chunks 43 | PASS |
| Exact search returns full counts | select-only RPC loop, 12 calls | `hybrid_search_exact` 20/20 every call | PASS |
| Video and chunk state | select-only queries | as in Truths 1 and 4 | PASS |

Note: in this short test the old `hybrid_search` also returned 20 rows on all 12 calls. The debug session says the lossy plan appears after about 5 calls in one pooled session, and this read-only test doesn't reliably reproduce it. That doesn't affect the verdict, because the app uses the exact function. It does support the follow-up to add an eval preflight row-count check.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| DATA-01 | 02-01 | All 50 articles chunked and embedded (additive), retrievable | SATISFIED (with D-18) | 44/50 chunked (133 chunks), additive (summary chunks still 43, no doc rows changed), probes hit. The 6 held docs are deferred to Phase 3 by user decision. |
| DATA-02 | 02-02 | Site diff lists every missing piece; each ingested after confirmation, incl. Simons education and Salesforce | SATISFIED | 18/18 pages decided; 7 ingested after user approval, including both named items; VERIFY OK. Third-party forecasts were removed from the Salesforce text. |
| DATA-03 | 02-03 | Taxonomy accurate, not 39/43 technology; applied only after approval | SATISFIED | technology 39 → 5; quote-backed links; user approved all 50 rows; backup taken first; DB check OK. |
| DATA-04 | 02-04 | `detectQueryIntent` maps reference only DB slugs | SATISFIED | check-intent-slugs exit 0; tests pass. |
| DATA-05 | 02-05 | Every case-study video checked; mismatches fixed or removed; audit recorded | SATISFIED | 25-row audit; Google cross-product unlinked (DB null); audit file records "Mismatched videos: 0". |

There are no orphaned requirements: REQUIREMENTS.md maps only DATA-01..05 to Phase 2, and every one is claimed by a plan. 02-06 claims none, which is correct for the eval plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (new/modified phase files) | — | No TODO/FIXME/placeholder found | — | — |
| `src/lib/intent-keywords.ts` | maps | Broad substring keywords ('ai', 'app', 'web', 'tech', 'content', 'security', 'mobile') can trigger false filters | Warning | Documented in 02-04-SUMMARY. The unfiltered fallback limits the damage. Whole-word matching belongs to RETR-02 (Phase 3). Not a DATA-04 failure. |
| `src/lib/intent-keywords.ts` | 'content' → content-strategy | 'content' now filters to content-strategy (4 docs), not content-marketing (12 docs) | Info | Primary search is narrower; the fallback still covers it. Worth checking in Phase 3. |
| `scripts/embed-articles.ts`, `scripts/ingest-site-work.ts` | verify | Verify probes call the old `hybrid_search` | Info | Verify modes may hit the lossy plan under load. They passed here. |
| `.planning/debug/phase2-recall-regression.md` | 2 | `status: diagnosed`, not resolved | Info | The fix is applied and confirmed by the final eval. The status field could be closed out. |

### Human Verification Required

None blocks this phase. The user already reviewed and approved the frame-based video verdicts, the taxonomy and the site-work decisions. Recommended checks after deploy:

1. **Production deploy check.** After the Phase 2 squash is pushed and Vercel deploys, run a few live queries and confirm the full result count. Until then, the live site runs the lossy `hybrid_search` against 192 rows. Its old intent maps also target the remapped taxonomy, so the 'technology' filter matches only 5 docs. Deploy soon after the squash.
2. **Unverified video rows before the owner demo.** #18 (ROYBI support on Meta) and #16/#17 rest on keyframes only, with no transcripts. The Vimeo links #19/#20 could not be fetched from this machine. Watch them once.

### Gaps Summary

There are no blocking gaps. The phase goal holds in the DB: all 50 case studies are indexed with chunks, all 18 /work pages are accounted for, taxonomy links are evidence-backed and match the approved proposal, intent slugs all exist, and the Google cross-product and other mismatched videos are unlinked or moved. The final eval shows recall unchanged at 75% with the new content being retrieved.

The one deviation from the literal success criterion is the 6 held company-info/LinkedIn docs (DATA-01). This was the user decision D-18, made to keep production retrieval from surfacing them, and Phase 3 owns finishing it. Other follow-ups (none blocking):
- the eval preflight row-count check;
- the ivfflat index sizing, or dropping it in `hybrid_search_v2`;
- whole-word intent matching;
- deciding whether articles belong in 48/50 answers;
- 3 case studies with no industry;
- unsupported claims are still at 43/50 responses. This is the main Core Value gap, owned by Phase 4.

---

_Verified: 2026-11-21_
_Verifier: Claude (gsd-verifier)_
