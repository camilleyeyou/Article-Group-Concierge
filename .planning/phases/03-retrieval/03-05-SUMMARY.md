---
phase: 03-retrieval
plan: 05
subsystem: retrieval
tags: [prompt-caching, catalogue, openrouter, debug-payload]
requires:
  - phase: 03-retrieval
    provides: GenerationUsage type, OrchestratorOutput.usage/catalogueVersion, searchFunction (03-02, 03-04)
provides:
  - src/lib/catalogue.ts (formatCatalogue, getCatalogue memoised 1h, catalogueVersion, extractDeliverables)
  - buildSystemBlocks(): SYSTEM_PROMPT block + catalogue block with explicit cache_control (ttl 1h)
  - debug payload fields usage, catalogue {version,text}, retrieval.searchFunction (EVAL_DEBUG only)
  - scripts/check-prompt-cache.ts
affects: [03-03 eval harness (now receives real values), 03-06, Phase 5]
key-files:
  created: [src/lib/catalogue.ts, eval/catalogue.test.ts, scripts/check-prompt-cache.ts]
  modified: [src/lib/orchestrator.ts, src/app/api/chat/route.ts]
key-decisions:
  - "Explicit cache_control on the catalogue block, ttl 1h (accepted by OpenRouter); no top-level automatic caching"
  - "Catalogue version is part of the orchestrator response-cache key"
  - "Catalogue lists only studies with an embedded chunk; no summary or first-sentence text, deliverables dropped if they contain digits"
requirements-completed: [RETR-04]
duration: ~30min
completed: 2026-11-22
---

# Phase 3 Plan 05: Cached catalogue prefix Summary

**The system prompt is now two blocks, SYSTEM_PROMPT then a deterministic 50-study catalogue carrying a 1h cache breakpoint, and a live check shows OpenRouter reporting 10,542 cached tokens read on the second call.**

## Docs check (project rule)
Re-read OpenRouter prompt-caching docs and the Anthropic Messages API reference on 2026-11-22: Sonnet 5.5 minimum cacheable prefix is 512 tokens; explicit per-block `cache_control` with `ttl: "1h"` is supported; the `/messages` response usage carries `cache_creation_input_tokens` and `cache_read_input_tokens` (chat-completions uses `prompt_tokens_details.cached_tokens`, not relevant here). Field names in the plan were correct.

## Cache check (npx tsx scripts/check-prompt-cache.ts)
```
cold getCatalogue: 3363 ms
catalogue: 19475 chars, 50 studies, version 5d5fc709abca
call 1: {"write":10542,"read":0,"uncached":16,"cost":0.04224}
call 2: {"write":0,"read":10542,"uncached":16,"cost":0.0011262}
PASS
```
- Cache hit verified through OpenRouter usage fields (`cache_read_input_tokens` = 10,542 on call 2). The cached prefix is the whole system prompt plus catalogue (~10.5k tokens), not just the catalogue.
- Spend: $0.0434 total (2 calls). No other paid calls.
- TTL used: 1h (accepted, no fallback to 5m needed).
- Cost per call with a warm prefix is about 3% of a cold one for the prefix portion ($0.0011 vs $0.0422).

## Catalogue size
19,475 chars, 50 case studies, 28 with a deliverables field (22 omitted: no "Solution included" sentence or it contained a digit).

## Phase 5 note
`getCatalogue()` runs before the response-cache lookup (the catalogue version is in the cache key, so a stale cached response cannot survive a catalogue change). On a cold start or after the 1h TTL, a response-cache hit still pays the catalogue DB queries. Measured cold `getCatalogue` latency: 3.4 s (includes first Supabase connection). Phase 5 should measure it and pre-warm or key on a cheaper version probe if needed. A comment marks the call site.

## Verification
- `npm run eval:test`: 69 tests, 69 pass, 0 fail (5 new in eval/catalogue.test.ts)
- `npx tsc --noEmit -p .`: clean
- `grep "system: SYSTEM_PROMPT"` in orchestrator = 0; `buildSystemBlocks(` appears 3 times (definition + 2 calls)
- Public JSON: `usage` and `catalogueVersion` are destructured out in route.ts; they appear only inside `debug`, which still requires `debug: true` and `EVAL_DEBUG=true`.

## Task Commits
1. Task 1, catalogue module and tests: `869ede2`
2. Task 2, cached system blocks, usage, debug payload, cache-check script: `8dd35e0`

## Deviations from Plan
- **[Rule 1 - Bug avoidance]** `getCatalogue` pages content_chunks in 1000-row batches and filters `embedding IS NOT NULL` server-side (rather than selecting the vector column), since Supabase caps responses at 1000 rows and vectors are large. Same result set as the plan describes.
- The route's catalogue debug text is returned only when the live catalogue version equals the generation's version (as planned); otherwise text is null and a warning is logged.

## Notes
- The response-cache entry stores the first call's `usage`; eval runs use skipCache, so recorded usage is always from the real call.
- Plan 03-03's "search function not recorded" warning in eval/run.ts should now be quiet because `debug.retrieval.searchFunction` is populated (not exercised by a paid eval here).
- RETR-05 untouched. RETR-06 unchanged.

## Known Stubs
None.

## Self-Check: PASSED
