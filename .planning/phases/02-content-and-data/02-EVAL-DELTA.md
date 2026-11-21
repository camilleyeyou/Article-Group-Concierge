# Phase 2 eval delta vs baseline 2026-11-20T15-12-31

Date: 2026-11-21. Final run `2026-11-21T21-15-13` at code commit `bb8d0d8` (all Phase 2 data changes plus the exact-search fix).

**Headline: recall is back to baseline (75%, 39/52) and every quality metric is within noise of the re-graded baseline. The new content is retrieved: all 7 new case studies appear (2-10 queries each) and an article appears in 48/50 responses. Hallucinations stay at 0.**

The first Phase 2 run (`2026-11-21T17-02-54`) showed recall at 21%. Content was not the cause. Search was returning too few rows. See "Recall regression: cause and fix".

## Route and models

| Item | Value |
|---|---|
| Route | `openrouter` (local dev server with EVAL_DEBUG; never set in production) |
| Generation model | `anthropic/claude-sonnet-5.5` |
| Embedding model | `openai/text-embedding-3-small` |
| Judge | `anthropic/claude-opus-5.5` via openrouter (harness v2) |
| Second grader | none (D-19) |

## Runs

| Item | Id |
|---|---|
| Frozen baseline (harness v1) | `2026-11-20T15-12-31` |
| Re-graded baseline (harness v2) | `2026-11-21T07-32-49-regrade` |
| Phase 2 run 1 (lossy search, superseded) | `2026-11-21T17-02-54` |
| **Phase 2 final run (exact search)** | `2026-11-21T21-15-13`, batch `batch-2026-11-21T21-15-12` |

Cost: run 1 $2.98, final run $4.24 (credit $30.27 to $26.03). 50/50 queries succeeded. Phase 2 has one run per state, so Phase 1 noise is used to read the deltas (grounded SD 0.16, voice SD 0.04, responses with unsupported claims 39-42, recall 75% stable).

## Metrics table (final run)

The re-graded baseline is the like-for-like comparison, because the frozen baseline was graded by harness v1.

| Metric | Final | Frozen baseline | Δ vs frozen | Re-graded | Δ vs re-graded | Beyond noise? |
|---|---|---|---|---|---|---|
| grounded | 3.84 | 4.44 | -0.60 | 3.92 | -0.08 | No |
| components | 4.72 | 4.94 | -0.22 | 4.66 | +0.06 | No |
| fallback | 4.60 | 4.50 | +0.10 | 4.66 | -0.06 | No |
| cta | 4.92 | 4.36 | +0.56 | 4.94 | -0.02 | No |
| voice | 4.02 | 3.92 | +0.10 | 4.08 | -0.06 | Borderline (SD 0.04, one run) |
| hallucinations | 0 | 0 | 0 | 0 | 0 | No |
| responses_with_unsupported_claims | 43 | 22 | +21 | 42 | +1 | No (Phase 1 range 39-42) |
| unsupported_claims_total | 106 | 38 | +68 | 113 | -7 | No |
| claims: goal_as_result | 20 | n/a | n/a | 17 | +3 | No (Phase 1 range 12-21) |
| claims: capability_not_shown | 11 | n/a | n/a | 11 | 0 | No |
| claims: generated_tags | 62 | n/a | n/a | 69 | -7 | No (4 above Phase 1 range 57-58, 7 below re-graded) |
| claims: other | 13 | n/a | n/a | 16 | -3 | No |
| recall_pct | 75% | 75% | 0 pp | 75% | 0 pp | No |
| latency_median_s | 20.1 s | 20.1 s | 0.0 s | 20.1 s | 0.0 s | No |
| metrics_not_in_context | 0 | 0 | 0 | 0 | 0 | No |
| strict_fallback_pass | 18 | 16 | +2 | 18 | 0 | No |
| strategy_lead_offered_when_expected | 0 | 0 | 0 | 0 | 0 | No |

Reading: Phase 2 is a content phase, so quality metrics were not expected to move, and they don't. The "Δ vs frozen" column mostly reflects the stricter v2 grader (see the re-graded baseline). Unsupported claims (43/50 responses) are still the main gap against the Core Value; Phase 4 owns them.

## Recall per query (final vs frozen baseline)

Total unchanged at 39/52. Two queries shifted, one each way:

- p1-q06 gained CrowdStrike.
- p3-q05 lost Salesforce/Slack sales enablement. The newly ingested Salesforce partner-ecosystem study took the slot.

## Retrieval of new content

- **Articles:** in 48/50 responses (baseline 0/50); avg 5.66 chunks per query. Articles take about 2 of the ~6 slots in most answers. This is not a recall cost today (recall is unchanged), but Phase 3 should decide whether articles belong in every answer.
- **New case studies (02-02):** Salesforce partner ecosystem 10 queries, Simons education 8, Amazon flagship 8, Box 4, HouseLogic 3, Google for Education 2, Android Gen Z 2.

Site-only queries:

| Query | Final run retrieved | Newly ingested study retrieved? |
|---|---|---|
| p3-q01 | Salesforce partner ecosystem, UpShow/ChromeOS, Salesforce/Slack, ChromeOS, 2 articles | **Yes** (ranked first; both baseline studies kept) |
| p3-q06 | Salesforce partner ecosystem, UpShow/ChromeOS, Omnicell, Salesforce/Slack, 2 articles | **Yes** (run 1 had articles only) |
| p4-q03 | Simons education, Simons brand identity, Google Cloud, Amazon re:MARS, 2 articles | **Yes** (ranked first) |
| p4-q10 | Simons education, Simons brand identity, ChromeOS/Cameyo, Google for Education, 2 articles | **Yes** (2 new studies) |

## Recall regression: cause and fix

Debug session: `.planning/debug/phase2-recall-regression.md`.

- **Symptom:** run 1 recall 11/52; some queries retrieved 0 chunks.
- **Cause:** `content_chunks.embedding` has an ivfflat index (lists = 100) and nothing set `ivfflat.probes` (default 1). Phase 2 grew the table from 43 to 192 rows. After 5 calls in a pooled session, plpgsql's cached generic plan for `hybrid_search` switches to the index, scans 1 of 100 lists and returns 0-14 rows instead of `match_count * 3`. At 43 rows the planner never chose the index, so the bug was latent before Phase 2.
- **Ruled out by exact-search simulation:** articles are neutral, the taxonomy change is +3 against the old taxonomy, the intent remap is +2, and the new studies are -1 (the p3-q05 swap above). Content was not the cause.
- **Fix (additive, per the database rule):** migration `004_hybrid_search_exact.sql` adds `hybrid_search_exact`, the same body as 003's `hybrid_search` plus `set_config('ivfflat.probes', '100', true)` at call time. A function-level `SET` clause fails on Supabase (42501), so the setting is applied in the body. `hybrid_search` is unchanged. `src/lib/supabase.ts` calls the new function and falls back to the old one if it is missing (PGRST202 / 42883). Rollback: `DROP FUNCTION hybrid_search_exact(...)`.
- **Applied:** the user ran 004 in the Supabase SQL Editor on 2026-11-21.
- **Verified (no LLM spend):** 50 consecutive calls each return the full 20 rows; `retrieveContext` recall is 39/52 on localhost; no fallback was logged. The final eval then confirmed 75%.
- **Production:** fixed only once Phase 2 is pushed and Vercel deploys. Until then the live site runs the lossy function on the larger table.
- **Follow-up:** add an eval preflight check that calls the search RPC about 10 times and fails if any call returns fewer than `match_count` rows. At this table size the index gives no speed benefit; Phase 3 (`hybrid_search_v2`) can drop the ivfflat use or size it properly.

## Data changes in this phase

- **Articles (02-01):** 133 chunks inserted across 44 docs (35 thought_leadership, 9 newsletter). Held 6 docs (5 company_info + 1 LinkedIn; 20 chunks) in `data/held-article-chunks.json`. `content_chunks` went 43 to 176 before 02-02.
- **Site work (02-02):** of 18 /work pages, 7 ingested as case studies (16 chunks): Android Gen Z, Google for Education, Amazon flagship (alongside re:MARS), Salesforce partner ecosystem (third-party forecasts stripped), Box, Simons education, NAR HouseLogic. 11 skipped (including the Google hub page, attribution risk). Now 50 case studies.
- **Taxonomy (02-03):** evidence-backed for all 50 studies: 103 links added, 81 removed, 7 new capability slugs, 8 new industry slugs; `technology` 39 to 5. CrowdStrike, AWS keynotes and Task Mate long-form have no industry (strict-evidence choice).
- **Slug maps (02-04):** `npx tsx scripts/check-intent-slugs.ts` prints `capabilities: 14/14 exist` and `industries: 16/16 exist`.
- **Video audit (02-05):** frame-based. 4 wrong heroes unlinked (including the Google cross-product recruiting spot), 1 hero moved, 3 support videos moved or removed, 2 new files linked. Final counts: 10 heroes, 3 vimeo, 6 support, all HTTP 200. "Mismatched videos: 0" in `02-VIDEO-AUDIT.md`.

## Deferred to Phase 3

The 6 held docs (5 company_info + 1 LinkedIn, 20 chunks) in `data/held-article-chunks.json` are not in `content_chunks` (D-18). DATA-01 is met for the inserted set now and for the held set once `hybrid_search_v2` filters `metadata->>'article_class'`. The user chose insert-all for the other 44 docs in 02-01 (simulated recall unchanged, which the final run confirmed).

## Requirement check

- DATA-01 (articles embedded): 133 chunks / 44 docs in `02-01-SUMMARY.md`; 48/50 responses in the final run retrieved an article. Held set completes in Phase 3.
- DATA-02 (site work diffed and ingested): `02-SITE-DIFF.md`, 02-02 summary; 50 case studies; all 7 new studies retrieved in the final run (2-10 queries each).
- DATA-03 (taxonomy evidence-backed): `02-TAXONOMY-PROPOSAL.md`; technology 39 to 5.
- DATA-04 (intent maps use existing slugs): check-intent-slugs 14/14 and 16/16.
- DATA-05 (video audit): `02-VIDEO-AUDIT.md`, "Mismatched videos: 0", all HTTP 200.

All five content requirements are evidenced as done, and the final eval shows no retrieval cost (recall 39/52, unchanged).
