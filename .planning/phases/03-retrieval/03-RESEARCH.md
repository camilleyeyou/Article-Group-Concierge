# Phase 3: Retrieval - Research

**Researched:** 2026-11-21
**Domain:** Hybrid retrieval (Postgres full-text + pgvector, RRF), Anthropic prompt caching through OpenRouter, eval-driven recall tuning
**Confidence:** HIGH for the current-state analysis and the offline simulation; MEDIUM for OpenRouter cache usage fields on the `/api/v1/messages` route (schema confirmed, live behaviour not yet observed); LOW for reranker latency.

## Summary

The live path is `route.ts → retrieveContext()` (src/lib/supabase.ts) `→ hybridSearch() → rpc('hybrid_search_exact')`, which falls back to `hybrid_search` if 004 is missing. The 0.15 cutoff, the intent filter, the ×1.1 boost, best-chunk-per-document dedup and the **4 case studies + 2 articles cap** all live in TypeScript. The SQL returns `match_count = 20` rows, ranked by `0.7·semantic + 0.3·ts_rank(plainto_tsquery)`, from the 60 semantically nearest chunks. `formatContext()` (src/lib/orchestrator.ts) turns those ≤6 chunks into the user message, and the system prompt is a single string sent through `anthropic.messages.create` (Anthropic SDK 0.30.1 pointed at OpenRouter's `/api/v1/messages`).

**Main finding:** I rebuilt the pipeline offline from the Phase 2 data dump (192 chunks, 50 query embeddings, real Postgres 16 `english` text search). The simulator reproduces the eval's 39/52 exactly, with the same per-query misses. It shows that **RETR-01..03 as written do not get to 90% on their own.** At the current 4-case-study cap, every RRF / OR-keyword / title-weight / tag-weight / whole-word-intent variant scores 37–40/52 (71–77%). Recall is capped by the number of case-study slots and by the quality of the short single-chunk summaries, not by keyword semantics or the cutoff. Removing the 0.15 cutoff changes nothing on this set (39 → 39), and whole-word intent changes nothing either (39 → 39), although both are still correct fixes. Raising the cap to 6 case studies gives 43–45/52 (83–87%). A candidate pool of semantic top-10 ∪ keyword top-10 (~15 docs) contains 47/52 (90%), and semantic top-15 ∪ keyword top-10 (~20 docs) contains 48/52 (92%). **Reaching ≥90% therefore realistically needs the RETR-06 contingency: rerank a ~20-doc pool down to ≤6.** Plan it as a gated wave from the start, not as an afterthought.

Three of the 52 expected labels look unsupported by the indexed text. Chorus (Alphabet X) is expected for "security product videos" and "cybersecurity clients?", but its chunk describes supply-chain asset visibility and never mentions security. Renew Home is expected as a "cloud-security challenger" analogue. No honest retriever finds these, so the practical ceiling is 49/52 (94%), and 90% means getting 47 of the remaining 49. The user should know this before the phase starts. Do not edit `eval/queries.json` labels without approval.

RETR-04 is cheap and well-documented: Sonnet 5.5's minimum cacheable prefix is **512 tokens**, and the system prompt alone is ~2.4k tokens. Put the catalogue in a second system text block with an explicit `cache_control` breakpoint. On OpenRouter's Messages route, the usage object carries Anthropic's `cache_creation_input_tokens` / `cache_read_input_tokens`. RETR-05 padding is caused by the prompt ("MANDATORY: If case studies are in context, include CaseStudyTeaser for each one") combined with retrieval always returning 4. In the latest run, 46/50 responses show exactly 4 teasers, including every restaurant and off-topic query. The eval rubric hard-codes the same rule (eval/rubric.ts:55), so it must change in lockstep.

**Primary recommendation:**
- Build `hybrid_search_v2` as a parameterised, additive SQL function: OR tsquery, A/B/D weights, RRF k=60, ranks partitioned by doc_type, metadata exclusions, no ANN `ORDER BY … LIMIT`.
- Raise the case-study candidate cap to 6 and make teaser display "relevant only" through a shared config flag.
- Measure recall offline first, for free.
- If offline recall is < 47/52, add a reranker over a ~20-doc pool (option A: `cohere/rerank-5-fast` via the existing OpenRouter key; option B: Haiku 5.5 listwise selection) before spending on the eval.

<user_constraints>
## User Constraints (from CONTEXT.md)

No `03-CONTEXT.md` exists (discuss step not yet run). The constraints below come from the orchestrator brief, CLAUDE.md, STATE.md and carried-forward Phase 2 decisions. Treat them as locked.

### Locked Decisions
- New SQL goes in `hybrid_search_v2` **alongside** `hybrid_search` and `hybrid_search_exact`. Never replace in place; production shares the Supabase project. Ask before any destructive DB change or full re-index.
- Generation model stays `anthropic/claude-sonnet-5.5` (via OpenRouter); judge stays Opus 5.5.
- Check current docs before choosing the prompt-caching approach and any reranker/query rewriting. Reranker/query rewriting is used **only** if recall < 90% after RETR-01..05.
- Budget: OpenRouter credit ~$26. One eval run costs ~$3.50–4.25. Minimise eval runs, and use offline recall checks where possible.
- One phase at a time. Rerun the eval at phase end, report every metric's delta vs `2026-11-20T15-12-31` (and the re-graded `2026-11-21T07-32-49-regrade`), squash to one commit.
- `EVAL_DEBUG=true` never in production. Supabase free tier may pause; restore before the eval.
- Keep the design simple (corpus ≈ 50 case studies + 44 articles).
- Carried from Phase 2 (D-15, D-16, D-18): company-info docs are retrieved only for questions about AG itself; the LinkedIn collection (`article_class = 'excluded'`) is never returned. The 6 held docs (20 chunks, `data/held-article-chunks.json`, **no embeddings yet**) are inserted only once `hybrid_search_v2` filters `metadata->>'article_class'`. Phase 3 owns finishing DATA-01.
- Carried from Phase 2 (D-04): re-chunking the 43 single-chunk case studies with fuller text is allowed in Phase 3 **only if recall needs it** (it is a re-index, so ask first).

### Claude's Discretion
- Exact SQL shape, RRF k, weights, case-study cap, whether intent is a soft boost or removed, catalogue fields, cache TTL, reranker choice (if needed).

### Deferred Ideas (OUT OF SCOPE)
- Server-side teaser tags (GEN-03), honesty prompt rewrite (GEN-01/02), voice (GEN-04): Phase 4. RETR-05 touches the prompt only as far as removing padding.
- Streaming / latency targets (PERF-01/02): Phase 5. Note for Phase 5: an LLM-based reranker adds ~1 s or more before teasers.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RETR-01 | `hybrid_search_v2` alongside `hybrid_search`, whole-corpus OR keyword search, title/client weighting, RRF | SQL design + example below. OR tsquery via `replace(plainto_tsquery()::text,' & ',' \| ')` verified on PG16. `websearch_to_tsquery` still ANDs (verified). Sim: on its own, at 4 slots, it does not raise recall (38–40/52); its value is robustness for short and keyword queries, plus the pool for reranking |
| RETR-02 | Whole-word intent matching or remove filter | Whole-word changes intent on 19/50 queries (e.g. "ai" in "against", "app" in "approach"). Removing the filter entirely costs 3 hits in the current pipeline (36 vs 39). Recommend whole-word plus an optional plural suffix, used as a **soft** signal in v2 (small additive boost), not a hard filter |
| RETR-03 | No 0.15 cutoff | Cutoff lives in TS (`minRelevanceScore = 0.15`, supabase.ts). Removing it is recall-neutral (sim 39→39). With RRF, scores are ~0.016–0.033, so any absolute cutoff would be meaningless anyway. Also remove the "top-2 fallback case studies" branch |
| RETR-04 | Catalogue in system prompt as cached prefix; verify hits via usage fields | Sonnet 5.5 min 512 tokens. Explicit `cache_control` on the last system block. Usage `cache_read_input_tokens`/`cache_creation_input_tokens` on OpenRouter `/messages` (schema). SDK 0.30.1 non-beta types lack `cache_control`, so cast or use `beta.promptCaching` |
| RETR-05 | <4 relevant → no padding | Padding comes from prompt lines "MANDATORY … include CaseStudyTeaser for each one" plus the fixed 4-slot retrieval. Latest run: 46/50 responses show exactly 4 teasers, incl. all 10 restaurant queries. Rubric line 55 encodes the same rule, so move the rule into `concierge-config.ts` |
| RETR-06 | ≥90% recall; reranker/query rewriting only if needed | Sim ceiling analysis: 4 slots ≤ 40/52, 6 slots ≤ 45/52, pool(~15–20 docs) 47–48/52. Reranker options with current pricing below. Label-quality caveat: 3 labels likely unsupported |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Core value:** never misrepresent AG's work. Every claim about a client, outcome, metric or capability must be supported by indexed content. This applies to the catalogue (no outcomes or goals in it) and to the reranker (it must not invent relevance).
- Models fixed: Sonnet 5.5 generation, Opus 5.5 judge.
- Process: one phase at a time. After the phase, rerun the eval, report deltas vs baseline, squash into one commit before pushing.
- Evidence: verify hypotheses against code and data before acting. Check current docs before choosing external products, APIs or model names.
- Database safety: ask before destructive DB change or full re-index. Add new functions alongside the old ones.
- Budget: OpenRouter key capped; ~$26 left now.
- `/api/chat` honours `debug: true` only when `EVAL_DEBUG=true`, never in production.
- Supabase free tier pauses; restore before eval runs.
- GSD workflow: file changes only through GSD commands (`/gsd:execute-phase`).
- Project skill `.claude/skills/ui-ux-pro-max` is UI-only and not relevant to this phase.

## Current Retrieval Path (verified in code)

| Step | Where | What happens |
|---|---|---|
| 1 | `src/app/api/chat/route.ts` | `retrieveContext({query, capabilitySlugs, industrySlugs, maxChunks: 10, maxAssets: 5, skipCache: debug})` |
| 2 | `retrieveContext` (supabase.ts ~L340) | `detectQueryIntent(query)` (lowercase **substring** match, `src/lib/intent-keywords.ts`). If any slugs are detected: **primary** filtered search + **fallback** unfiltered search, run in parallel; otherwise one unfiltered search. Each uses `matchCount = maxChunks*2 = 20` |
| 3 | `hybridSearch` | Embeds the query (`openai/text-embedding-3-small` via OpenRouter, in-memory 24 h cache), then `rpc('hybrid_search_exact', {query_embedding, query_text, doc_types:null, capability_slugs, industry_slugs, topic_slugs:null, match_count:20, semantic_weight:0.7})`. Falls back to `hybrid_search` on PGRST202/42883 |
| 4 | SQL `hybrid_search_exact` (004) | Sets `ivfflat.probes=100`. Filters by EXISTS(capability/industry). Takes the top `3n=60` chunks by cosine distance (`ORDER BY embedding <=> q LIMIT 60`), then `ts_rank(to_tsvector(content‖title‖client), plainto_tsquery(q))` (**AND** semantics, no weights), `combined = 0.7·sem + 0.3·kw`, returns the top 20 |
| 5 | TS merge | Primary rows ×1.1 boost, then fallback rows, dedup by chunk_id, sort by combined |
| 6 | TS cutoff | `minRelevanceScore = 0.15` (supabase.ts default param). If everything is below it, keep the top 10 |
| 7 | TS selection | Best chunk per document; **max 4 case studies + max 2 articles**. If no case study passed, include the top 2 raw case studies anyway (padding source) |
| 8 | `formatContext` (orchestrator.ts ~L235) | Labels each chunk 🟢/🟡/🔴 from `combined_score` (≥0.35 / ≥0.20). Prints title, client, slug, vimeo, thumbnail, content. **With RRF scores (~0.03) every chunk would be labelled 🔴 LOW, so this must change** |
| 9 | `orchestrate` | `anthropic.messages.create({model, max_tokens:16000, system: SYSTEM_PROMPT (string), messages:[…history, {user: query + formatted context}]})`. Non-streaming; `orchestrateStream` exists but is unused |
| 10 | Eval recall | `eval/metrics.ts` L115: expected slugs ∈ `record.retrieval.chunks[].slug` (the final ≤6 chunks from the debug payload). **Recall is measured on retrieval output, not on what the model shows** |

## Root Cause of the 13 Misses (run 2026-11-21T21-15-13)

Ranks are doc-level among the 50 case studies, from the offline simulator (semantic = best chunk cosine; keyword = OR-tsquery, title/client A, tags B, content D, IDF-weighted).

| Query | Missing slug | Sem rank | Kw rank (OR) | Cause | Fixable by |
|---|---|---|---|---|---|
| p1-q02 cloud-security challenger | renew-home | 23 | 8 | Weak label: energy company, no security | Probably nothing honest (label issue) |
| p1-q04 sales decks / messaging house | salesforce-slack-sales-enablement | 2 | 2 | Cap of 4 + filtered-primary ×1.1 boost reorders | v2 RRF (hit in v2 top-4) |
| p1-q05 security explainer video | chorus | 41 | 28 | **Label unsupported**: Chorus text has no security | Nothing honest |
| p1-q06 "messaging house + marketecture?" | salt-security | 9 | 12 | Short query; Salt ranks ~9 | Bigger cap or reranker |
| p1-q07 "cybersecurity clients?" | salt-security | 8 | – | Rank 5 in the current pipeline (Chrome family takes 3 slots); "cybersecur" lexeme not in Salt text ("API security") | Cap 6 (current pipeline) or reranker |
| p1-q07 | chorus | 38 | – | **Label unsupported** | Nothing honest |
| p1-q10 positioning + marketecture + RSA | crowdstrike | 1 | 6 | Current: intent filter (substring) + 0.15 blend demoted it | v2 RRF (hit) |
| p2-q02 investor-day keynote | adp-keynotes | 8 | 3 | Semantic: chunk opens with HR/payroll; cap 4 | v2 RRF (hit in top-4) |
| p2-q05 Fortune 100 regulated / insurer | j-p-morgan | 14 | 4 | Semantic weak; cap | Reranker |
| p2-q05 | adp-keynotes | 15 | 16 | Semantic + keyword weak (label arguable) | Reranker, maybe not |
| p2-q07 "CEO keynote support" | adp-keynotes | 5 | 2 | AND tsquery: kw = 0 for all ("support" absent) | v2 OR keyword (hit) |
| p3-q05 sales/partner asset alignment | salesforce-slack | 3 | 5 | Cap 4; the new Salesforce partner study took the slot | v2 or cap 5 |
| p3-q10 co-branded video + partner event | android-virtual-event | 20 | 3 | Multi-part query; semantic diluted | Reranker / multi-part handling |

**Classification of the 13:** keyword AND semantics 1 (p2-q07); intent filter / boost ordering 2 (p1-q04, p1-q10); 4-slot cap with the right doc at ranks 5–9: 4 (p1-q06, p1-q07 Salt, p2-q02, p3-q05); weak semantic match (rank 14–23) 4 (p1-q02, p2-q05 ×2, p3-q10); unsupported label 2 (Chorus ×2). **The 0.15 cutoff caused none of them.**

**Trade-off seen in simulation:** the v2 design fixes p1-q04, p1-q10, p2-q02, p2-q07 and p3-q05, but loses hits the current pipeline gets through its intent filter or AND keyword (p1-q07 CrowdStrike, p2-q03 AIG via the finance filter, p2-q10 ADP, p3-q06, p3-q10 AWS/NVIDIA, p4-q01 Google Cloud). Net at 4 slots: 38–40 vs 39.

### Simulation results (offline, exact reproduction of 39/52)

| Variant | 4 CS | 5 CS | 6 CS | 8 CS |
|---|---|---|---|---|
| Current pipeline (as live) | 39 | — | — | — |
| Current, no 0.15 cutoff | 39 | 41 | 45 | 46 |
| Current, whole-word intent | 39 | — | — | — |
| Current, no intent filter | 36 | — | — | — |
| v2 chunk-level RRF k60, OR kw, title/client A | 38 | 40 | 43 | — |
| same + intent boost 0.005 | 40 | 43 | 44 | — |
| v2 doc-level RRF, OR kw + tags (B) + IDF, k60 | 39 | 42 | 43 | 46 |
| v2 doc-level, k10, wA=5 wT=3 | 40 | 44 | 44 | 45 |
| Semantic only | 35 | 38 | 39 | 41 |
| **Pool: sem top-10 ∪ kw top-10 (~15 docs)** | | | | **47** |
| **Pool: sem top-15 ∪ kw top-10 (~20 docs)** | | | | **48** |

Takeaways: (1) don't over-tune weights to 52 labels, since the differences are ±2 and within label noise; (2) slots matter more than fusion details; (3) only a reranker over a ~20-doc pool has headroom to reach 47+.

## Standard Stack

### Core
| Library / service | Version | Purpose | Why |
|---|---|---|---|
| Postgres full-text search (`english` config) | Supabase PG (local check on 16.11) | OR keyword search, `setweight`, `ts_rank` | Already in DB, no new dependency |
| pgvector `<=>` cosine | existing | Semantic side | Existing 1536-d embeddings (`text-embedding-3-small`; must not change) |
| `@anthropic-ai/sdk` | **0.30.1 installed** (package.json `^0.30.0`) | Generation via OpenRouter `/api/v1/messages` | Already used. Non-beta types lack `cache_control`; see Pitfall 4 |
| OpenRouter | — | Single route for embeddings, generation, rerank (if needed) | User decision; same key and credit |

### Supporting (RETR-06 contingency only; pick after the offline gate)
| Option | Price (checked 2026-11-21) | Pros | Cons |
|---|---|---|---|
| **A. `cohere/rerank-5-fast` via OpenRouter `POST /api/v1/rerank`** | $0.02 / M tokens (~20 docs × 300 tok ≈ $0.0001/query) | Purpose-built, calibrated `relevance_score` (also usable for RETR-05 display), same key, one HTTP call, no streaming needed | Sends case-study text to Cohere, a **new processor** (user should OK this). Latency not verified (LOW) |
| B. LLM listwise selection, e.g. Claude Haiku 5.5 via OpenRouter | ~$0.10 / M input (≈6k tok ≈ $0.0006/query) | No new data processor (Anthropic already used). Can be told "return only genuinely relevant slugs", which doubles as the RETR-05 gate | Adds ~1 s or more before teasers (hurts Phase 5 PERF-01). Output parsing; nondeterminism |
| (Not recommended) query rewriting | — | — | Most misses are cap/semantic-depth issues, not query phrasing |

Other OpenRouter rerankers listed today: `cohere/rerank-5-pro` ($0.05/M), `cohere/rerank-4-pro` ($0.0025/search), `mongodb/rerank-2.5(-lite)`, `qwen/qwen3-reranker-*`, `nvidia/nemotron-3.5-rerank-8b:free`. Verify the model id on openrouter.ai before coding.

**Installation:** none needed for the core work. The reranker (if needed) is a `fetch` to `https://openrouter.ai/api/v1/rerank` (body: `model`, `query`, `documents[]`, `top_n`; response: `results[{index, relevance_score}]`, `usage.cost`).

### Alternatives Considered
| Instead of | Could use | Trade-off |
|---|---|---|
| OR via `replace(plainto_tsquery()::text,' & ',' \| ')` | `websearch_to_tsquery` | Still ANDs plain words (verified: `'messag' & 'hous' & 'marketectur'`); `-` means NOT |
| RRF in SQL | Weighted score sum | Scales differ (sem 0.14–0.67 vs kw 0–0.93), which is why the 70/30 blend misbehaves; RRF is scale-free |
| Re-chunk the 43 summaries from full PDFs (D-04) | — | Could lift semantic depth (ADP keynote, JPM), but it is a re-index (ask first) and its effect is unmeasured; keep as fallback B if the reranker is rejected |

## Architecture Patterns

### Recommended changes (file map)
```
supabase/migrations/005_hybrid_search_v2.sql   # NEW, additive; user runs it in the SQL Editor (no DATABASE_URL in .env.local)
src/lib/intent-keywords.ts                     # whole-word (+plural) matching
src/lib/supabase.ts                            # hybridSearchV2(), retrieveContext() rewrite: no cutoff, no fallback-2, CS/article caps from config
src/lib/catalogue.ts                           # NEW: buildCatalogue() deterministic text from DB (cached in memory)
src/lib/orchestrator.ts                        # system as blocks + cache_control; formatContext labels by rank, not score; teaser rule from config; usage capture
src/lib/concierge-config.ts                    # retrieval.maxCaseStudies, maxArticles, teaserPolicy ('relevant_only')
src/app/api/chat/route.ts                      # debug.usage, debug.catalogueVersion (eval only)
eval/rubric.ts                                 # component rule reads teaserPolicy from config (line 55)
eval/recall-offline.ts (or scripts/)           # NEW: free recall check against real retrieveContext
scripts/check-hybrid-v2.ts, scripts/check-prompt-cache.ts   # NEW verification scripts
```

### Pattern 1: `hybrid_search_v2` (RRF, OR keywords, weighted fields, partitioned ranks)
**What:** One SQL function that scores **every** eligible chunk (corpus ~210 rows, so a seq scan is ~1–2 ms). It ranks semantic and keyword separately **within each doc_type**, fuses with RRF, adds an optional small intent bonus, applies the metadata exclusions, and returns the top `match_count` chunks with diagnostics.
**Why partition by doc_type:** 133 article chunks otherwise dilute case-study ranks. The app already keeps case studies and articles in separate slots.
**Why no `ORDER BY embedding <=> q LIMIT`:** that is the only plan shape that can use the ivfflat index, which is what made `hybrid_search` lossy (probes=1). Window ranks over the full set can't use the ANN index. Keep `set_config('ivfflat.probes','100',true)` anyway as a guard.

```sql
-- 005_hybrid_search_v2.sql  (additive; hybrid_search and hybrid_search_exact untouched)
-- Rollback: DROP FUNCTION hybrid_search_v2(vector, text, int, document_type[], text[], text[], boolean, int, float);
CREATE OR REPLACE FUNCTION hybrid_search_v2(
  query_embedding vector(1536),
  query_text TEXT,
  match_count INT DEFAULT 60,                -- chunk rows returned (both doc types)
  doc_types document_type[] DEFAULT NULL,
  boost_capability_slugs TEXT[] DEFAULT NULL, -- whole-word intent, soft signal only
  boost_industry_slugs TEXT[] DEFAULT NULL,
  include_company_info BOOLEAN DEFAULT FALSE, -- D-15
  rrf_k INT DEFAULT 60,
  intent_boost FLOAT DEFAULT 0.0             -- e.g. 0.003 ≈ +10 ranks at k=60; 0 disables
)
RETURNS TABLE (
  chunk_id UUID, document_id UUID, document_title TEXT, document_type document_type,
  client_name TEXT, slug TEXT, vimeo_url TEXT, thumbnail_url TEXT, pdf_url TEXT, hero_video_url TEXT,
  content TEXT, chunk_type TEXT, metadata JSONB,
  semantic_score FLOAT, keyword_score FLOAT, semantic_rank INT, keyword_rank INT,
  intent_match BOOLEAN, combined_score FLOAT          -- combined_score = RRF score (keeps TS type compatible)
) AS $$
#variable_conflict use_column
DECLARE
  or_query tsquery := NULLIF(replace(plainto_tsquery('english', query_text)::text, ' & ', ' | '), '')::tsquery;
BEGIN
  PERFORM set_config('ivfflat.probes', '100', true);
  RETURN QUERY
  WITH base AS (
    SELECT cc.id AS c_id, cc.document_id AS d_id, d.title AS d_title, d.doc_type AS d_type,
           d.client_name AS d_client, d.slug AS d_slug, d.vimeo_url AS d_vimeo, d.thumbnail_url AS d_thumb,
           d.pdf_url AS d_pdf, d.hero_video_url AS d_hero, cc.content AS c_content, cc.chunk_type AS c_type,
           cc.metadata AS c_meta,
           (1 - (cc.embedding <=> query_embedding))::FLOAT AS sem,
           setweight(to_tsvector('english', d.title), 'A')
        || setweight(to_tsvector('english', COALESCE(d.client_name, '')), 'A')
        || setweight(to_tsvector('english', COALESCE(tags.names, '')), 'B')
        || setweight(to_tsvector('english', cc.content), 'D') AS vec,
           COALESCE(tags.cap_slugs && boost_capability_slugs, FALSE)
        OR COALESCE(tags.ind_slugs && boost_industry_slugs, FALSE) AS intent_hit
    FROM content_chunks cc
    JOIN documents d ON d.id = cc.document_id
    LEFT JOIN LATERAL (
      SELECT string_agg(x.name, ' ') AS names,
             array_agg(x.slug) FILTER (WHERE x.kind = 'cap') AS cap_slugs,
             array_agg(x.slug) FILTER (WHERE x.kind = 'ind') AS ind_slugs
      FROM (
        SELECT c.name, c.slug, 'cap' AS kind FROM document_capabilities dc JOIN capabilities c ON c.id = dc.capability_id WHERE dc.document_id = d.id
        UNION ALL
        SELECT i.name, i.slug, 'ind' FROM document_industries di JOIN industries i ON i.id = di.industry_id WHERE di.document_id = d.id
      ) x
    ) tags ON TRUE
    WHERE cc.embedding IS NOT NULL
      AND (doc_types IS NULL OR d.doc_type = ANY(doc_types))
      AND COALESCE(cc.metadata->>'article_class', '') <> 'excluded'                       -- D-16
      AND (include_company_info OR COALESCE(cc.metadata->>'article_class', '') <> 'company_info') -- D-15
  ),
  scored AS (
    SELECT b.*, CASE WHEN or_query IS NOT NULL AND b.vec @@ or_query THEN ts_rank(b.vec, or_query) ELSE 0 END::FLOAT AS kw
    FROM base b
  ),
  ranked AS (
    SELECT s.*,
           rank() OVER (PARTITION BY s.d_type ORDER BY s.sem DESC)::INT AS srank,
           CASE WHEN s.kw > 0 THEN rank() OVER (PARTITION BY s.d_type, (s.kw > 0) ORDER BY s.kw DESC) END::INT AS krank
    FROM scored s
  )
  SELECT r.c_id, r.d_id, r.d_title, r.d_type, r.d_client, r.d_slug, r.d_vimeo, r.d_thumb, r.d_pdf, r.d_hero,
         r.c_content, r.c_type, r.c_meta, r.sem, r.kw, r.srank, r.krank, r.intent_hit,
         (1.0 / (rrf_k + r.srank) + COALESCE(1.0 / (rrf_k + r.krank), 0)
          + CASE WHEN r.intent_hit THEN intent_boost ELSE 0 END)::FLOAT
  FROM ranked r
  ORDER BY 19 DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION hybrid_search_v2(vector, text, int, document_type[], text[], text[], boolean, int, float)
  TO anon, authenticated, service_role;
```
Notes: this is a sketch; the planner should have the executor dry-run it locally or in the SQL Editor. Expected-shape points: `&&` with a NULL array yields NULL, hence the COALESCE. The capability/industry `name` columns exist (`schema.sql` L20–36). If `ORDER BY 19` is disliked, repeat the expression. The `tags` names put words like "Events & Keynotes" into the B weight, which is how "keynote" or "cybersecurity" queries can reach a study through its taxonomy.

### Pattern 2: `retrieveContext` v2 (TS)
- One RPC call (`hybrid_search_v2`, `match_count` 60). No primary/fallback pair, no ×1.1 boost, no 0.15 cutoff, no "top-2 fallback case studies".
- Intent: `detectQueryIntent` whole-word, passed as `boost_*_slugs` with `intent_boost` from config (start at 0.003; set 0 to disable). Simulation: +1 to +2 hits, fragile.
- `include_company_info`: true only when the query is about AG itself (small whole-word keyword list: careers, jobs, hiring, benefits, office, located, contact, remote, "how do you work", "your team"). Planner decides; default false.
- Dedup best chunk per document (existing helper), take `maxCaseStudies` (config, **6**) and `maxArticles` (config, 2). Keep the order by RRF.
- Keep the fallback to `hybrid_search_exact` on PGRST202/42883 so code can deploy before the migration. Map v2 rows to the same `HybridSearchResult` shape.
- **Contingency hook (RETR-06):** `retrieveContext` takes a candidate pool (≈20 case-study docs: sem top-15 ∪ kw top-10, i.e. from v2 rows by `semantic_rank`/`keyword_rank`) → `rerank()` → top `maxCaseStudies`. Put it behind a config flag so the gate decides.

### Pattern 3: Cached catalogue prefix (RETR-04)
```ts
// Source: platform.claude.com prompt-caching docs; openrouter.ai prompt-caching docs
const response = await anthropic.messages.create({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  system: [
    { type: 'text', text: SYSTEM_PROMPT },
    { type: 'text', text: catalogueText, cache_control: { type: 'ephemeral' /* or ttl: '1h' */ } },
  ] as any, // SDK 0.30.1 non-beta TextBlockParam has no cache_control; body passes through unchanged
  messages,
});
const u = response.usage as any;
// u.cache_creation_input_tokens (write), u.cache_read_input_tokens (hit), u.input_tokens (uncached remainder), u.cost (OpenRouter extra)
```
- Use an **explicit** breakpoint on the last system block. Don't use top-level automatic caching: it moves the breakpoint to the last block, i.e. the per-request user message, so every call writes a new cache entry (1.25×) and never hits.
- Byte-identical prefix: build the catalogue deterministically (sort by slug, fixed field order, no timestamps or scores), memoise per process with a 1 h refresh, and expose a hash (`catalogueVersion`) in the debug payload.
- Catalogue fields per case study: `title | client | slug | capabilities (names) | industries (names) | video: yes/no` + optionally the verbatim **"Solution included …"** deliverables sentence (41/50 studies have one, avg 239 chars). Do **not** include the first sentence (usually the client's situation or goal, which is goal-as-result bait) or any metrics. Size: ~2.5k tokens without deliverables, ~4.8k with first sentences (measured), probably ~4k with deliverables. All well above the 512-token minimum. Total system prefix ≈ 5–7k tokens.
- Prompt rule to add with it: "The catalogue lists what AG's portfolio contains. Use it to know what exists (never claim AG lacks work that is in the catalogue). Facts, outcomes and CaseStudyTeaser components must come only from RETRIEVED CONTEXT." This keeps automated checks valid: `eval/lib.ts` flags any teaser slug not in retrieval.
- TTL: the default 5 min is enough for the eval (4 s gap between queries, so 49/50 hits after the first write). For demos/production with sparse traffic, `ttl: '1h'` (2× write ≈ +$0.01 per write at ~5k tokens) makes hits likely. Recommend 1h. Cost delta is negligible: Sonnet 5.5 hit $0.10/M vs $2/M base.
- Sonnet 5.5 thinks by default. Changing thinking params invalidates the messages cache (and on some models the system cache), so keep thinking params constant across calls.

### Pattern 4: RETR-05 "relevant only" teasers via shared config
- Add `CONCIERGE_CONFIG.teasers = { policy: 'relevant_only', maxShown: 4 }` (or similar) and render **both** the prompt lines and the rubric line 55 from it (EVAL-04 pattern).
- Prompt edits (minimal; GEN-01 owns the full honesty rewrite): remove "If ANY case studies appear in the context, you MUST include them…", "MANDATORY: If case studies are in context, include CaseStudyTeaser for each one", and the "Case Study Inclusion Rule" block. Replace with: "Include a CaseStudyTeaser only for retrieved case studies that genuinely match the request; showing 1–3 (or none, with an honest note) is correct when that is what exists. Never present adjacent work as a direct match."
- `formatContext`: replace score-based 🟢/🟡/🔴 labels (meaningless with RRF) with rank and match signals, e.g. `Match: keyword+semantic (rank 1)`, or with the reranker's `relevance_score` if option A is adopted.
- The component-count rule "typical 4–8" stays a soft rule. The rubric already treats under-4 as minor (rubric.ts L55).

### Anti-Patterns to Avoid
- **Tuning weights until the 52 labels hit 47:** differences of ±2 are label noise, and Phase 6 uses an expanded set. Prefer principled defaults (k=60, A/B/D) and fix structural limits (slots, pool + rerank).
- **Replacing `hybrid_search` / `hybrid_search_exact`** or altering `content_chunks` (adding a generated tsvector column touches the live table). Compute vectors on the fly; the corpus is tiny.
- **ANN `ORDER BY <=> LIMIT` in v2:** reintroduces the Phase 2 lossy plan.
- **Inserting the held chunks before production calls v2:** live `hybrid_search_exact` can't filter `article_class`, so LinkedIn/company-info would surface on the live site immediately.
- **An absolute score cutoff on RRF scores:** it reintroduces RETR-03's problem in another form. Gate display at generation (prompt) or on calibrated reranker scores.
- **Putting per-request data in the cached block,** or building the catalogue from an unordered query.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Stemming / stopwords for keyword search | JS tokenizer/stemmer | Postgres `to_tsvector('english')`, `plainto_tsquery` | Same lexemes as the DB; verified behaviour |
| OR query parsing | Custom string splitting | `replace(plainto_tsquery('english', q)::text, ' & ', ' \| ')::tsquery` | Handles punctuation, hyphenated words ("go-to-market" → `'go-to-market' \| 'go' \| 'market'`), stopword-only queries (NULL) |
| Reranking (if needed) | Cosine re-scoring heuristics | OpenRouter `/api/v1/rerank` (Cohere) or a Haiku listwise call | Calibrated scores; the corpus is too small to train anything |
| Cache verification | Timing-based guesses | `usage.cache_read_input_tokens` / `cache_creation_input_tokens` | Deterministic, documented fields |
| Offline recall | A second re-implementation of retrieval | Call the real `retrieveContext()` from a tsx script | Measures exactly what the eval measures, at ~$0 |

## Common Pitfalls

### Pitfall 1: Recall target structurally capped by labels and slots
**What goes wrong:** the phase builds RETR-01..05 perfectly, spends $4 on the eval, and gets ~80%.
**Why:** 4 slots ≤ 40/52 in every simulated variant; 3 labels are unsupported.
**How to avoid:** run the offline recall gate right after v2 is live (free). Decide on the reranker wave *before* the eval. Raise the label question with the user early (correcting labels would also re-score the baseline: 39/49 = 80%).
**Warning signs:** offline recall < 47/52 after Wave 1.

### Pitfall 2: Rubric and prompt drift on the teaser rule
**What goes wrong:** the prompt now says "relevant only", while rubric L55 still says "a CaseStudyTeaser for retrieved case studies" is mandatory, so the components score drops for correct behaviour.
**How to avoid:** drive both from `concierge-config.ts`, and add a test in `eval/rubric.test.ts`.

### Pitfall 3: RRF scores break score-based consumers
`formatContext` relevance labels (≥0.35/≥0.20) and the grader context line `score x.xxx` (eval/rubric.ts L113) assume 0–1 blended scores. With RRF (~0.016–0.033) everything reads as LOW. Keep `combined_score` for type compatibility, but label by rank/signals in the prompt. The grader line is cosmetic, but update it to show ranks too.

### Pitfall 4: SDK 0.30.1 types
Non-beta `TextBlockParam` and `Usage` types have no `cache_control` / cache fields (verified in node_modules). Either cast (`as any`) for the system blocks and usage, or use `anthropic.beta.promptCaching.messages.create` (typed, adds the old `prompt-caching-2024-07-31` beta header). Casting is simpler and avoids beta headers through OpenRouter. Don't upgrade the SDK in this phase unless needed (it is a major-version jump with unknown blast radius).

### Pitfall 5: The catalogue widens what the model can claim
If the model names catalogue studies (title/client) that weren't retrieved, the grader, which sees only retrieved context, will flag them, and grounded drops. Options: (a) prompt "facts and teasers only from retrieved context" (recommended in all cases); (b) also include the catalogue in the debug payload and in the grader's context section, since it *is* what the app saw (consistent with EVAL-03). (b) touches the harness, so let the user decide (Open Question 2).

### Pitfall 6: Migration must be applied by the user
`.env.local` has no `DATABASE_URL`, and Phase 2 had the user run 004 in the SQL Editor. Plan a `checkpoint:human-action` for 005, and keep the TS fallback (PGRST202/42883 → `hybrid_search_exact`) so code order doesn't matter.

### Pitfall 7: Held chunks and production order
Embed the 20 held chunks (~$0.0001) and insert them **after** (1) 005 is applied and (2) the code that calls v2 is deployed to production. Otherwise company-info/LinkedIn surfaces live through `hybrid_search_exact`. Alternatively, defer the insert to the very end of the phase, after the push.

### Pitfall 8: Whole-word matching drops plurals and variants
`\bbrand\b` no longer matches "brands" or "branded". Use `(?<![a-z0-9])kw(?:s|es)?(?![a-z0-9])` on the lowercased query, and add explicit variants where needed ("branded", "keynotes"). Multi-word keys are matched the same way. Keep the 02-04 test that every slug exists.

### Pitfall 9: Lossy-plan regression detector
Phase 2's follow-up was never implemented: the preflight has no RPC row-count check. Add one for v2 (≥10 consecutive calls, each returns `match_count` rows) in `check-hybrid-v2.ts`, and optionally in `eval/preflight.ts`.

## Code Examples

### Whole-word intent (RETR-02)
```ts
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function hit(lowerQuery: string, keyword: string): boolean {
  const k = esc(keyword.toLowerCase()).replace(/\\-|\s+/g, '[\\s-]+'); // "go-to-market" ~ "go to market"
  return new RegExp(`(?<![a-z0-9])${k}(?:s|es)?(?![a-z0-9])`).test(lowerQuery);
}
// tests: hit('how do you maintain', 'ai') === false; hit('against a bigger incumbent', 'ai') === false;
//        hit('ai strategy', 'ai') === true; hit('our brands', 'brand') === true; hit('approach', 'app') === false
```

### Cache-hit check script (RETR-04)
```ts
// scripts/check-prompt-cache.ts — ~$0.03. Two identical calls; the second must read from cache.
for (const i of [1, 2]) {
  const r = await anthropic.messages.create({ model: MODEL, max_tokens: 256,
    system: buildSystemBlocks() as any, messages: [{ role: 'user', content: 'Reply OK.' }] });
  const u = r.usage as any;
  console.log(i, { write: u.cache_creation_input_tokens, read: u.cache_read_input_tokens, uncached: u.input_tokens, cost: u.cost });
}
// PASS if call 2 has cache_read_input_tokens >= catalogue+prompt size (~5k) and call 1 has a write > 0 (or a read, if warm).
// If both are 0/null: confirm the prefix is >= 512 tokens, check provider routing (OpenRouter /api/v1/generation?id=…).
```
Keep `max_tokens` comfortably above the default thinking budget. Don't use `max_tokens: 0` pre-warming (rejected when thinking is enabled).

### Offline recall (cheap, real code path)
```ts
// eval/recall-offline.ts — imports retrieveContext; dotenv first; no dev server, no generation, no grading.
// Optional: seed the embedding cache from data/.cache/query-embeddings.json so it costs $0 and is deterministic.
for (const q of queries) {
  const ctx = await retrieveContext({ query: q.text, skipCache: true });
  const got = new Set(ctx.chunks.map(c => c.slug));
  // recall rule identical to eval/metrics.ts L115; also print per-query misses,
  // case studies per query, and for zero-expected queries the CS count (padding proxy)
}
// Run the loop twice: the second pass exercises cached plpgsql plans (lossy-plan regression check).
```

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| Weighted sum of semantic + `ts_rank` | Reciprocal Rank Fusion (k≈60) | Scale-free; no cutoff calibration |
| `plainto_tsquery` (AND) | OR-ed lexemes + field weights (title/client A) | Short and keyword queries ("marketecture", "CEO keynote support") match |
| Anthropic prompt-caching beta header | GA `cache_control` (5m / 1h TTL); Sonnet 5.5 min 512 tokens; Sonnet 5.5 cache read 0.05× base | Cheap to cache a 5–7k prefix |
| Separate reranker vendor accounts | OpenRouter `/api/v1/rerank` (launched April 2026) | Same key and credit |

## Open Questions

1. **Eval labels (Chorus ×2, Renew Home).** What we know: their indexed text doesn't support the expected match. Unclear: whether the user wants them corrected (which changes baseline comparability) or kept. Recommendation: raise it at plan approval. Keep labels frozen for the Phase 3 delta report; report "recall excluding disputed labels" as a secondary line.
2. **Should the grader see the catalogue?** Recommendation: yes, add `debug.catalogue` and a short "Portfolio catalogue (titles/tags only)" section to the grader prompt, since it is what the app saw. User decision because it touches the harness.
3. **Reranker choice if the gate fails.** A (Cohere via OpenRouter, a new data processor, fast and cheap) vs B (Haiku 5.5, no new processor, slower). Recommendation: A if the user accepts Cohere seeing case-study text; else B. The reranker's calibrated score also gives RETR-05 a principled "show fewer" signal.
4. **Case-study cap.** 6 is recommended (sim +4–6 hits vs 4). Larger context means more for the model to ignore; RETR-05's prompt change is what prevents that turning into padding. Consider adding a diagnostic "shown recall" (expected slugs among response teasers) to the report so the gap between retrieved and shown stays visible. It is additive and doesn't change `recall_pct`.
5. **`documents.summary` column** exists in the schema, but its population and faithfulness are unverified. Check it before using it in the catalogue; the "Solution included" sentence is a verified alternative.
6. **Articles in 48/50 answers.** v2 keeps 2 separate article slots, which never displace case studies. Whether to show articles less often belongs with GEN/RETR-05 prompt rules, not retrieval.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Supabase project (free tier) | All retrieval, migration | ✓ (pauses when idle) | — | Restore in dashboard; `npm run eval:preflight` detects it |
| SQL execution for migration 005 | RETR-01 | ✗ for the agent (no `DATABASE_URL`) | — | **User runs it in the Supabase SQL Editor** (as with 004) |
| OpenRouter key/credit | Embeddings, generation, cache check, eval, rerank | ✓ | ~$26 | — |
| Node / tsx | Scripts, tests | ✓ | node v24.13.0 | — |
| Local Postgres (optional) | Offline keyword simulation | ✓ | /opt/local/bin postgres 16.11 (MacPorts, no pgvector) | Not needed once v2 exists: iterate via RPC parameters |
| Dev server + `EVAL_DEBUG=true` (local only) | Eval run | ✓ | — | — |
| Phase 2 dumps | Free simulation | ✓ | `data/.cache/recall-debug/chunks.json` (192 chunks + taxonomy), `data/.cache/query-embeddings.json` (50) | Re-dump with `dump-chunks.ts` (read-only) |

## Validation Architecture

(Included at the orchestrator's request; `workflow.nyquist_validation` is false in config.)

### Test framework
| Property | Value |
|---|---|
| Framework | `node:test` via `tsx --test` |
| Config file | none (script in package.json) |
| Quick run command | `npm run eval:test` (free, < 10 s) |
| Full suite command | `npm run eval:test && npx tsx scripts/check-intent-slugs.ts && npx tsx scripts/check-hybrid-v2.ts && npx tsx eval/recall-offline.ts` |

### Phase Requirements → Test Map
| Req | Behaviour | Type | Command | Cost | Exists? |
|---|---|---|---|---|---|
| RETR-01 | v2 exists; old functions untouched; p1-q06 returns CrowdStrike in top-4 case studies; ≥10 consecutive calls return full rows; `excluded` never returned; `company_info` only with flag | integration (RPC) | `npx tsx scripts/check-hybrid-v2.ts` | ~$0 (cached embeddings) | ❌ Wave 0 |
| RETR-02 | "maintain"/"against" don't fire `ai`; plurals match; slugs exist | unit | `npm run eval:test` (extend `eval/intent-keywords.test.ts`) | free | partial |
| RETR-03 | no `minRelevanceScore`, no fallback-2 branch; retrieveContext returns `min(available, cap)` case studies | unit/grep + offline | `grep -n "minRelevanceScore" src/lib/supabase.ts` (expect none) + recall-offline CS-count column | free | ❌ |
| RETR-04 | catalogue deterministic (same bytes twice, sorted), ≥512 tokens, no metrics; second call shows `cache_read_input_tokens > 0` | unit + live script | `npm run eval:test` (catalogue test) + `npx tsx scripts/check-prompt-cache.ts` | ~$0.03 | ❌ |
| RETR-04 (eval) | per-response usage recorded in debug payload; report "cache hits n/50" | eval | phase-end eval | in eval | ❌ |
| RETR-05 | prompt/rubric rendered from one teaser-policy config; on the 20 zero-expected queries, mean teasers drops from 3.8 (latest run) toward 0–2; fallback score not worse; shown-recall diagnostic | unit + eval | `npm run eval:test` (config/rubric tests) + phase-end eval report | in eval | ❌ |
| RETR-06 | recall ≥ 47/52 | offline gate, then eval | `npx tsx eval/recall-offline.ts` (gate), then `npm run eval:batch -- --runs 1` | $0 / ~$4.25 | ❌ |

### Sampling rate
- **Per task commit:** `npm run eval:test`.
- **After 005 applied / after each retrieval change:** `scripts/check-hybrid-v2.ts` + `eval/recall-offline.ts` (free; run twice in a row).
- **Gate before the eval:** offline recall ≥ 47/52. If not met → reranker wave → re-gate.
- **Phase gate:** one eval run (~$4.25; credit after ≈ $21), preflight first (Supabase restored, credit). Delta report vs frozen + re-graded baselines. A second run only if a metric lands within noise of a bar.

### Wave 0 gaps
- [ ] `eval/recall-offline.ts`: real `retrieveContext`, seeded embeddings, per-query misses, CS counts, double pass
- [ ] `scripts/check-hybrid-v2.ts`: RPC assertions above
- [ ] `scripts/check-prompt-cache.ts`: usage-field check
- [ ] Tests: whole-word intent cases; catalogue determinism/size/no-metrics; teaser policy shared by prompt and rubric

## Sources

### Primary (HIGH confidence)
- Code read: `src/lib/supabase.ts`, `intent-keywords.ts`, `orchestrator.ts`, `concierge-config.ts`, `llm-config.ts`, `src/app/api/chat/route.ts`, `eval/metrics.ts`, `eval/rubric.ts`, `eval/lib.ts`, `supabase/migrations/003…`, `004…`, `supabase/schema.sql`; `node_modules/@anthropic-ai/sdk` 0.30.1 types.
- Data: `eval/results/2026-11-21T21-15-13/responses.json` (misses, teaser counts), `eval/queries.json`, `data/.cache/recall-debug/chunks.json`, `data/.cache/query-embeddings.json`, `data/held-article-chunks.json`.
- Offline simulation (this session): numpy cosine + local PostgreSQL 16.11 `english` text search over the dumped corpus. It reproduces the live 39/52 and the same 13 misses. Scripts in the session scratchpad only, not committed.
- Anthropic prompt caching docs: https://platform.claude.com/docs/en/build-with-claude/prompt-caching (512-token minimum for Sonnet 5.5, prefix order, invalidation, usage fields, TTL, pricing).
- OpenRouter prompt caching: https://openrouter.ai/docs/features/prompt-caching (cache_control syntax, 4 breakpoints, TTL, sticky routing, usage fields).
- OpenRouter Anthropic Messages API: https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-a-message (usage includes `cache_creation_input_tokens`, `cache_read_input_tokens`, `cost`; system blocks accept `cache_control`).

### Secondary (MEDIUM confidence)
- OpenRouter rerank API: https://openrouter.ai/docs/api/api-reference/rerank/submit-a-rerank-request (request/response schema).
- OpenRouter rerank models and pricing: https://openrouter.ai/collections/rerank-models (snapshot 2026-11-21; verify ids before use).
- OpenRouter changelog (rerank endpoint, April 2026): https://openrouter.ai/docs/changelog/2026/4/4

### Tertiary (LOW confidence)
- Reranker and Haiku latency estimates: not measured.
- Whether OpenRouter fills the cache usage fields on `/messages` in practice: schema says yes; confirm with `check-prompt-cache.ts` (fallback: `/api/v1/generation`).

## Metadata

**Confidence breakdown:**
- Current-path analysis and miss root causes: HIGH (code + exact simulator reproduction).
- v2 SQL design: MEDIUM-HIGH (OR tsquery and weights verified on PG16; full function not executed on Supabase).
- Recall projections: MEDIUM (exact for this snapshot and these labels; label noise ±2).
- Prompt caching: HIGH for the Anthropic semantics; MEDIUM for OpenRouter `/messages` usage reporting.
- Reranker: MEDIUM pricing, LOW latency.

**Research date:** 2026-11-21
**Valid until:** ~2026-12-21 (OpenRouter model ids and prices change fast; re-check before adding a reranker).
