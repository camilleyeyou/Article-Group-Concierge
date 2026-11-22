---
phase: 03-retrieval
plan: 08
subsystem: retrieval
tags: [rerank, cohere, openrouter, RETR-06, D-303]
requires: ["03-07"]
provides:
  - "Cohere rerank-5-fast (via OpenRouter) over a doc-level case-study pool, RRF fallback on any failure"
  - "Offline rerank re-gate: 44/52, still below the 47/52 gate"
affects: [03-09]
key-files:
  created: [src/lib/rerank.ts, eval/rerank.test.ts]
  modified: [src/lib/concierge-config.ts, src/lib/supabase.ts, eval/concierge-config.test.ts, eval/recall-offline.ts]
decisions:
  - "User chose Approve Cohere after the 03-07 FAIL; implemented as approve-production (rerank.enabled = true, RERANK_ENABLED env overrides)"
  - "Rerank re-gate is still FAIL (44/52); no weights tuned, no query rewriting added"
metrics:
  completed: 2026-11-22
---

# Phase 3 Plan 8: Conditional Cohere reranker Summary

Status: executed (03-07 said GATE: FAIL, so the plan ran). RETR-06 is NOT marked complete (the phase-end eval proves it). RETR-05 untouched.

GATE (rerank): FAIL (44/52)

## Task 1: decision (already resolved)

03-07 recorded `GATE: FAIL (43/52)`. The user explicitly chose "Approve Cohere" (cohere/rerank-5-fast via OpenRouter as a new data processor). The plan's three options were approve-production / approve-offline-only / reject; "Approve Cohere" was read as approve-production, so `retrieval.rerank.enabled = true` in config. If the user meant offline-only, flip `enabled` to `false` (the `RERANK_ENABLED` env var overrides either way). Nothing was sent to Cohere before this decision.

## Docs check (OpenRouter, 2026-11-22)

- Endpoint `POST https://openrouter.ai/api/v1/rerank`; body `{ model, query, documents, top_n }` (documents are strings or objects); response `{ id, model, results: [{ index, relevance_score, document? }], usage: { search_units?, total_tokens?, cost? } }`.
- Model id `cohere/rerank-5-fast` is listed by `/api/v1/models` (modality text->rerank, context 32,768, endpoint `/api/v1/rerank`), so the plan's id is current. The docs example uses `cohere/rerank-v3.5`; 5-fast is the low-latency tier of Rerank 5 (5-pro and 4-fast/4-pro also exist).
- Price: the models API reports pricing 0 for per-token fields (rerank is billed per search/usage). Reported `usage.cost` over 100 calls: $0.008171 (about $0.00008 per call), matching the plan's ~$0.0001 estimate.

## Implementation

- `src/lib/rerank.ts`: `buildRerankPool` (case studies only; doc-level semantic top-15, then keyword-only additions from keyword top-10 with score > 0), `rerankDocuments` (never throws; null on reject, non-2xx, malformed JSON, out-of-range indexes, or 4 s abort), `applyRerank` (scored docs by relevance, unscored keep pool order after), `rerankStats` for reporting.
- `src/lib/concierge-config.ts`: `retrieval.rerank` block, `rerankEnabled()` with `RERANK_ENABLED` override, rerank included in `retrievalConfigKey` so the cache does not mix modes.
- `src/lib/supabase.ts`: when enabled, a second parallel `hybridSearchV2({ docTypes: ['case_study'], matchCount: getCaseStudyChunkCount() })` supplies the pool; on rerank success the top 6 come from the reranked pool and carry `rerank_score`; on null the existing RRF selection is used. Articles unchanged. Disabled path is the single-RPC path from 03-04.
- Chunk count check: `getCaseStudyChunkCount()` = 59 and the pool call returned 59 rows (equal), so the pool covers every case-study chunk.

## Re-gate (offline, `RERANK_ENABLED=true npx tsx eval/recall-offline.ts`)

- Frozen recall 44/52 (85%), both passes identical, `hybrid_search_v2 (50/50)`. Corrected (D-301): 44/49 (90%).
- Control run with `RERANK_ENABLED=false` reproduced 03-07 exactly: 43/52, 43/49.
- Versus 03-07: gained 3, lost 2, net +1.
  - Gained: p1-q03 Google Workspace, p1-q07 CrowdStrike, p2-q05 J.P. Morgan.
  - Lost: p1-q06 Salt Security, p2-q10 ADP keynotes.
- Latency (rerank call only, 100 calls over 2 passes): p50 892 ms, max 3,390 ms (under the 4,000 ms timeout).
- Cost: $0.008171 total reported by OpenRouter for the 100 calls (control run was free). Embeddings were cache-seeded.
- Fallbacks (null returns): 0 of 100.

### Per-pair view of the 03-07 misses

| Pair | Class | Recovered by rerank? |
|---|---|---|
| p1-q02 Renew Home | disputed label | No |
| p1-q05 Chorus | disputed label | No |
| p1-q07 Chorus | disputed label | No |
| p2-q05 J.P. Morgan | weak semantic | Yes |
| p2-q05 ADP keynotes | weak semantic/keyword | No |
| p3-q10 Android virtual event | multi-part query | No |
| p1-q03 Google Workspace (regression vs baseline) | | Yes |
| p1-q07 CrowdStrike (regression vs baseline) | | Yes |
| p2-q03 AIG (regression vs baseline) | | No |

Remaining 8 misses (frozen): p1-q02 Renew Home, p1-q05 Chorus, p1-q06 Salt Security, p1-q07 Chorus, p2-q03 AIG, p2-q05 ADP keynotes, p2-q10 ADP keynotes, p3-q10 Android virtual event (3 of these are disputed labels).

Note: the two new losses (Salt for p1-q06, ADP keynotes for p2-q10) were previously hits; the reranker judged other case studies more relevant to those queries. Reranker also does not fix the disputed labels, which are about the labels, not retrieval. Still FAIL, so per the plan no weight tuning or query rewriting was done; Plan 03-09 Task 1 asks the user before any eval spend.

## Checks

- `npm run eval:test`: 78 tests, 78 pass (4 new in eval/rerank.test.ts, concierge-config test updated).
- `npx tsc --noEmit -p .`: exit 0.

## Spend

About $0.008 (rerank calls, as reported by OpenRouter). No eval run, no DB writes, nothing pushed. Credit was $25.62 at the 03-07 preflight; it was not re-measured here, so expect roughly $25.6.

## Deviations from Plan

- [Rule 3 - tooling] `eval/recall-offline.ts` now prints rerank call count, fallbacks, p50/max latency and cost (needed to report the gate figures). Committed separately.
- The decision option was inferred as approve-production from "Approve Cohere" (see Task 1).

## Commits

- ec0ef86 feat(03-08): Cohere rerank-5-fast via OpenRouter with RRF fallback (RETR-06)
- 666a072 feat(03-08): recall-offline reports rerank latency, cost and fallbacks

## Known Stubs

None.

## Self-Check: PASSED
