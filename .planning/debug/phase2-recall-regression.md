---
status: resolved
trigger: "Phase 2 eval recall fell 39/52 -> 11/52 (run 2026-11-21T17-02-54 vs baseline 2026-11-20T15-12-31). Find which Phase 2 change (articles, new studies, taxonomy rewrite, intent maps) or interaction causes it, with numbers."
created: 2026-11-21
updated: 2026-11-21
---

## Current Focus

hypothesis: CONFIRMED. Root cause is lossy ivfflat index scans inside the live hybrid_search, not any Phase 2 content/taxonomy/intent change.
test: done (see Evidence)
expecting: n/a
next_action: user/orchestrator decides on fix option (needs a DB change; see Resolution). Diagnose-only session: no src/ or DB changes made.
scripts: data/.cache/recall-debug/{dump-chunks,allscores3,sim,lossy-capture,lossy-run,compare,detail,live-all}.ts (gitignored, throwaway, read-only against Supabase)

## Symptoms

expected: recall of expected case-study slugs ~39/52 as in baseline 2026-11-20T15-12-31 (code a5b2722)
actual: 11/52, no slug gained; avg chunks/query 3.88 -> 2.98; 32/50 responses include an article (baseline 0); zero-chunk answers p2-q06, p2-q10, p3-q03
errors: none (50/50 queries succeeded)
reproduction: eval batch batch-2026-11-21T17-02-49 at code 10071f0 against live DB
started: after Phase 2 (commits after 8c158c7, all data changes live in shared DB)

## Eliminated

- hypothesis: article crowding (02-01) caused the drop
  evidence: exact pipeline with articles = 39/52, without articles = 39/52 (variant c). Articles take the separate 2-article slots of the 4+2 cap and never displace case studies.
  timestamp: 2026-11-21

- hypothesis: taxonomy rewrite (02-03) filters out the right studies
  evidence: exact pipeline with old taxonomy (backup) = 36/52 vs live 39/52 (variant d). The new taxonomy is +3, not a loss.
  timestamp: 2026-11-21

- hypothesis: intent keyword remap (02-04) caused the drop
  evidence: exact pipeline with old maps = 37/52 vs new 39/52 (variant b). Remap is +2.
  timestamp: 2026-11-21

- hypothesis: zero-chunk answers come from a missing unfiltered fallback
  evidence: fallback exists (src/lib/supabase.ts L375-384) and runs; it calls the same lossy RPC, which returned 0 rows for those 3 queries.
  timestamp: 2026-11-21

- hypothesis: OpenRouter query embeddings differ from cached ones
  evidence: fresh vs cached cosine 1.0000.
  timestamp: 2026-11-21

## Evidence

- timestamp: 2026-11-21 (session start)
  checked: eval/results/*/responses.json recall recomputed with eval/metrics.ts rule
  found: baseline 39/52 (git 6f16e6a), phase 2 run 11/52 (git 10071f0). Reproduces the report.
  implication: metric/expected slugs are consistent between runs.

- timestamp: 2026-11-21
  checked: data/.cache/dev.log (dev server log of the phase 2 eval run)
  found: "Raw search results chunks_returned" is far below the 20 (one search) / up to 40 (primary+fallback) expected. Examples: no-intent queries (single UNFILTERED search, match_count 20) returned 0 rows (p1-q08 pen test, p2-q08, p3-q07, p5 restaurant queries), 8 rows (p5-q06), 2 rows (p5-q07). Zero-chunk queries p2-q06/p2-q10/p3-q03 got 0 rows from BOTH the filtered primary and the unfiltered fallback.
  implication: the unfiltered fallback exists in code (src/lib/supabase.ts ~L375-384) but the RPC itself returns too few rows. Not an intent/taxonomy-only effect.

- timestamp: 2026-11-21
  checked: direct RPC probe (cached query embeddings, read-only), first calls of the session
  found: unfiltered hybrid_search for p2-q06, p2-q10, p1-q01, p1-q08, p2-q08, p3-q07, p5-q06, p5-q07 each returned 20 rows. Fresh OpenRouter embedding is identical to cached (cos 1.0000).
  implication: embedding is not the cause; row counts are not a pure function of inputs.

- timestamp: 2026-11-21
  checked: real retrieveContext() from src/lib/supabase.ts in a tsx script
  found: 5-query probe gave good results (p3-q03 -> Chrome Enterprise, Android, Salesforce/WhatsApp; p2-q10 -> AIG, ADP; p1-q07 -> CrowdStrike). A full 50-query loop minutes later reproduced the eval: recall 11/52, avg chunks 3.12, 32/50 with an article, p2-q06/p2-q10/p3-q03 = 0 chunks. p1 queries OK, degradation from p2 on.
  implication: (a) reproduces ~11/52 with current code + current DB, but the result depends on session/plan state, not only on data.

- timestamp: 2026-11-21
  checked: loop of 50 UNFILTERED RPC calls with cached embeddings
  found: row counts 0..14 (never 20): e.g. p1-q05 0, p1-q08 0, p2-q06 0, p2-q10 0, p3-q03 0, max 14. Same calls returned 20 earlier in the session.
  implication: lossy, non-deterministic row loss inside hybrid_search.

- timestamp: 2026-11-21
  checked: live function signature (debug payload columns pdf_url, hero_video_url, semantic_score) vs supabase/migrations
  found: live hybrid_search = supabase/migrations/003_pdf_first_ui_restructure.sql version: `ORDER BY cc.embedding <=> query_embedding LIMIT match_count * 3` in the semantic CTE, filters applied in the same WHERE. schema.sql creates `idx_chunks_embedding ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`. No script sets ivfflat.probes (default 1) or reindexes.
  implication: an ivfflat index scan with probes=1 only visits 1 of 100 lists, so it can return far fewer than LIMIT rows and miss nearest neighbours.

- timestamp: 2026-11-21
  checked: row counts per call in fresh node processes (unfiltered, cached embeddings)
  found: match_count=200 run: 10/10 calls returned all 192 chunks. Next process, match_count=20: first 5 calls returned 20, then 1,3,0,14,4. Next process match_count=64: all degraded (9,9,9,7,0,...). A 50-query match_count=200 run: first 15 exact (192), then 0,2,0,2,0,7,14,0,... Degraded counts are identical across match_count values (p2-q06 0, p3-q02 14, p4-q01 9 ...), and max is 14.
  implication: classic plpgsql plan-cache behaviour: first 5 executions per DB session use a custom plan (exact seq scan + sort), then the cached GENERIC plan is used, which picks the ivfflat index for `ORDER BY embedding <=> q LIMIT ...`; with probes=1 it returns only the rows in the single nearest list (<=14 here). PostgREST pools connections, so once every pooled session has executed it 5+ times, every call is lossy. Degradation is independent of LIMIT and of filters.

- timestamp: 2026-11-21
  checked: DB dump (read-only): content_chunks / documents / link tables
  found: 192 chunks (59 case_study = 43 old + 16 new; 133 article), 0 null embeddings, 100 docs (50 case studies), 109 capability links, 51 industry links, visual_assets 0 rows.
  implication: Phase 2 grew content_chunks 4.5x (43 -> 192).

- timestamp: 2026-11-21
  checked: old intent maps (77f339d == baseline 6f16e6a/a5b2722) vs pre-change taxonomy slugs (data/taxonomy-backup.pre-change.json)
  found: old capability keys content-strategy, social-media, digital-marketing, experiential, web-development did NOT exist in the DB (only brand-strategy, creative-direction, video-production did). Old industry keys consumer, entertainment, nonprofit, real-estate, education did not exist (technology, finance, healthcare did).
  implication: in the baseline many filtered primary searches matched nothing; the unfiltered fallback did most of the work. 02-04 made every slug real, so the filtered primary now returns (boosted x1.1) results.

- timestamp: 2026-11-21
  checked: exact local simulator (data/.cache/recall-debug/sim.ts): exact per-chunk semantic+keyword scores from the RPC's exact (custom-plan) responses for all 50 queries (192/192 rows each; local cosine matches RPC semantic_score within 6e-7), then hybrid_search 003 semantics (filter EXISTS -> top 3n by distance -> top n by combined) and retrieveContext (filtered primary x1.1 + unfiltered fallback, 0.15 threshold, best per doc, 4 case studies + 2 articles)
  found: baseline-equivalent variant (old intent maps, pre-change taxonomy, no articles, no new studies) gives 39/52, avg 3.88 chunks, and its chunk lists are IDENTICAL (chunk ids, order) to the baseline eval for 50/50 queries.
  implication: simulator is exact. Recall table (exact search): current 39/52 (avg 5.66, 48/50 with article, 0 zero-chunk); old intent 37; no articles 39; old taxonomy 36; old intent+old tax 36; no new studies 40; no intent filter at all 36; no 1.1 boost 37.

- timestamp: 2026-11-21
  checked: lossy model: captured the degraded candidate set per query (unfiltered RPC, match_count 200, generic plan) and ran the same pipeline restricted to it
  found: current state lossy = 4/52, avg 2.6 chunks, 31/50 with article, 11 zero-chunk. Old intent / old taxonomy / no articles all still 4/52 lossy. Baseline data under lossy search would also be 4/52 (avg 1.46). Chunk-list match vs the phase 2 eval: 40/50 identical to lossy sim, 6 identical to exact sim (p1-q01..q05 at dev-server start, plus one later), 4 mixed (primary and fallback served by sessions in different plan states). Live retrieveContext loop today: 11/52, avg 3.12, 32 with article (= eval).
  implication: the whole regression is search-path loss. The degraded set for p2-q06, p2-q10, p3-q03 is EMPTY (0 rows), which is why both primary and fallback returned nothing. Baseline + both Phase 1 runs (43 chunks) show no short retrievals and match exact, so at 43 rows the plan stayed exact; it flipped once the table reached 192 rows.

- timestamp: 2026-11-21
  checked: EXPLAIN via PostgREST plan media type
  found: 406 (plan output disabled)
  implication: the exact planner cost crossover (why 192 rows flips the generic plan to the index) is inferred, not observed.

## Resolution

root_cause: The live hybrid_search (supabase/migrations/003_pdf_first_ui_restructure.sql version) does `ORDER BY cc.embedding <=> query_embedding LIMIT match_count * 3` over content_chunks, which has `idx_chunks_embedding USING ivfflat ... WITH (lists = 100)` and default ivfflat.probes = 1. plpgsql caches the function's query plan per DB session: the first 5 executions use custom plans (exact), after that the generic plan uses the ivfflat index, which visits only the single nearest of 100 lists and returns 0-14 rows instead of 3n. Filters are applied after the index scan, so the filtered primary and the unfiltered fallback both come from the same tiny list. With 43 chunks (baseline, Phase 1) the plan stayed exact; after Phase 2 grew the table to 192 chunks, pooled PostgREST sessions switch to the lossy index plan. Phase 2 content, taxonomy and intent changes are recall-neutral or positive under exact search (39/52 current vs 39/52 baseline-equivalent).
fix: not applied (diagnose-only). Options: (1) additive hybrid_search_v2 = 003 body + `SET ivfflat.probes = 100` (or enable_indexscan=off) as a function attribute, and switch src/lib/supabase.ts hybridSearch to call it (DB additive + code; expected 39/52). (2) ALTER FUNCTION hybrid_search ... SET ivfflat.probes = 100 in place (DB only, non-destructive but in-place on prod function; 39/52). (3) DROP INDEX idx_chunks_embedding (DB only, schema-destructive though re-creatable; 39/52). Rebuilding the index with fewer lists does not fix it (still probes=1). No reliable code-only fix.
verification: exact simulator reproduces baseline chunk lists 50/50 and predicts 39/52 for current state; lossy model reproduces 40/50 phase 2 chunk lists exactly and explains the 3 zero-chunk queries.
files_changed: []

## Fix applied

Fixed by migration 004 (`hybrid_search_exact`, probes set via set_config in the body) and the fallback in src/lib/supabase.ts. Applied by the user 2026-11-21. Final eval 2026-11-21T21-15-13: recall 75% (39/52), matching baseline.
