---
status: resolved
trigger: "retrieval-latency: /api/chat/stream retrieval median ~3.7 s before teasers/suppressed event; blocks PERF-01/PERF-02"
created: 2026-11-23
updated: 2026-11-23
---

## Current Focus

hypothesis: CONFIRMED and fixed (fixes 1-3, user-approved code-only). Retrieval was a serial chain of three network-bound steps (OpenRouter embedding -> hybrid_search_v2 RPC with a 123 KB response -> document_metrics), each paying ~330 ms Douala->Supabase round trip locally. No LLM rewrite/intent/rerank step runs (rerank.enabled=false).
test: done
next_action: none. PERF-01/02 are judged by production smoke after deploy (05-10); local eval speed is distance-inflated (Douala to Supabase).
scripts: data/.cache/latency-debug/profile{,2,3,4}.ts, run1.log, raw.json (gitignored)

## Symptoms

expected: retrieval well under ~1.2 s
actual: p1-q01 4882 ms (cold), p2-q01 3013, p1-q05 3655 (median 3655); local smoke suppressed at 5652 ms
errors: none
reproduction: eval/stream-timing.ts style retrieveContext call, or POST /api/chat/stream
started: exposed by Phase 5 generation speedup

## Eliminated

## Evidence

- checked: src/app/api/chat/stream/route.ts, src/lib/supabase.ts retrieveContext, catalogue.ts, rerank config
  found: route does Promise.all([retrieveContext, getCatalogue]). retrieveContext does Promise.all of hybridSearchV2 (embedding fetch then RPC), searchVisualAssets (its own embedding fetch for the same text, then RPC), getCapabilities, getIndustries, getTopics (3 RPC/REST), optional rerank pool (rerank.enabled=false, so skipped). After that, sequentially, getDocumentMetrics. No LLM rewrite/intent step (intent is keyword-only). Rerank off.
  implication: critical path = max(embedding+RPC, embedding+visual RPC, 3 taxonomy) + getDocumentMetrics. Embedding is fetched twice concurrently for the same text (cache set only after resolve).

- timing (laptop in Douala, CM; 5 runs x 4 queries, medians ms): embedding 955-997 (OpenRouter, openai/text-embedding-3-small; first call in process 2995); hybrid_search_v2 RPC 1097-1136; search_visual_assets RPC 417-446; capabilities/industries/topics 319-366 each; getDocumentMetrics 318-353 (sequential, after the RPC); FULL retrieveContext uncached embedding 2501-2560, cached embedding 1502-1646; route Promise.all warm catalogue 2502-2663; catalogue cold load 3477 (5 sequential requests), memo 0; first supabase call in process 552 vs warm trivial call ~330-400.
- RPC cost vs rows returned (same embedding): match_count 1/5/10 = ~590 ms, 20 = 946, 40 = 860, 60 = 1176, 192 = 1417. Response 123 KB gzip at mc=60 vs 2 KB at mc=1. DB compute + 30 KB vector upload is only ~200-250 ms above the 330-400 ms trivial-call floor. case_study-only mc=60 = 736.
- parallel5 (rpc + visual + 3 taxonomy, embedding precomputed) = 1299 vs rpc alone 1112: parallel calls add ~190 ms (connection/bandwidth contention locally), not free.
- Embedding: OpenRouter ~1013 ms median vs round trip to api.openai.com ~250 ms (measured through a 401 response; OPENAI_API_KEY in .env.local is invalid, so direct OpenAI speed is inferred, not measured). openrouter GET /models = 120 ms, so ~700-800 ms is OpenRouter-to-provider embedding work.
- Supabase region not discoverable (Cloudflare-fronted; no pooler host or vercel.json in repo, no .vercel dir). Cloudflare edge for this laptop is DLA (Douala); edge connect+TLS ~90 ms, edge->origin + PostgREST ~300 ms.
- Spend: OpenRouter remaining 29.452472 before, 29.452380 after = ~$0.0001 (few hundred embeddings). No LLM calls, no eval.

## Resolution

root_cause: Critical path is embedding (~1.0 s, OpenRouter) -> hybrid_search_v2 (~1.1 s, dominated by round trip + a 123 KB 60-row response) -> getDocumentMetrics (~0.33 s, sequential after the RPC) = ~2.5 s locally; 05-08 saw 3.0-3.7 s with noise and cold connections. Roughly 1.2-1.6 s of that is local-only (Douala link: ~330 ms per Supabase request, payload transfer); production same-region estimate 0.8-1.2 s (not measured). On a cold serverless instance the catalogue load (3.5 s, 5 sequential requests, downloads all chunk text) runs in parallel but exceeds retrieval, adding ~1 s to first request.
fix: Applied user-approved code-only fixes 1-3. NOT applied (not approved): direct OpenAI embeddings, new SQL function, match_count/selection changes, index changes, vercel.json region pinning.
  1. retrieveContext starts getAllDocumentMetrics (all rows, display_order asc, filtered in memory by retrieved document ids; falls back to the per-document query if the 1000-row API cap is reached) concurrently with the hybrid_search_v2 RPC. New optional onChunks callback fires as soon as the search (and rerank pool) is done, also on a cache hit. The stream route starts getCatalogue first, emits teasers/suppressed from onChunks once the catalogue resolves, and awaits that before orchestrating. Visual-asset, taxonomy and metrics fetches no longer gate the event.
  2. generateEmbedding shares an in-flight promise per text (visual search no longer pays a second embedding). capabilities/industries/topics memoised 1 h (getTaxonomy, failures not memoised). searchVisualAssets short-circuits while visual_assets has no embedded rows, gated on a memoised head count (empty rechecked every 5 min, non-empty every hour, error means search anyway).
  3. catalogue loadRows runs documents, chunk paging, document_capabilities and document_industries concurrently. formatCatalogue/catalogueVersion untouched.
verification: eval:test 219/219 (new eval/retrieval-concurrency.test.ts, 11 tests, faked fetch, includes the 05-03 byte-exact catalogue test), tsc, lint, build clean. Live read-only equivalence old (git HEAD copy) vs new on p1-q01, p2-q01, p1-q05, p3-q02 with the same embedding vector: chunks deep-identical (ids, order, all fields), relatedMetrics, visualAssets, taxonomy identical; catalogue version 5d5fc709abca old and new, text/tags/deliverables identical. Caveats: live document_metrics and visual_assets are both empty (content-range */0), so metrics filtering and the visual short-circuit are proven by the mocked tests, not live data; the embedding API returns vectors differing at ~1e-5 between calls (scores differ at that level regardless of code), hence the shared vector. Timing (laptop in Douala, ms): warm route emulation (4 queries x 5 x 2 runs, n=40) median time to teasers 2491 -> 2084, total retrieval 2491 -> 2084 (min/max 2288/3064 -> 1992/2804); cold first request (3 fresh processes each, old 2646/3043/2990, new 2778/3011/2312, median 2990 -> 2778) is dominated by the first-call embedding (~3 s) so the cold gain is within noise. Remaining local floor: embedding ~1.0 s + RPC ~1.1 s, both unapproved levers. Spend: OpenRouter remaining 29.452376 before, 29.452258 after (~$0.0001).
files_changed: [src/lib/supabase.ts, src/lib/catalogue.ts, src/app/api/chat/stream/route.ts, eval/retrieval-concurrency.test.ts]
