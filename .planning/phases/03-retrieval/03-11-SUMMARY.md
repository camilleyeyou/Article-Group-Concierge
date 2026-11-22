---
phase: 03-retrieval
plan: 11
subsystem: retrieval
tags: [rerank, haiku, bake-off, recall, RETR-06]
requires: [03-08]
provides:
  - Haiku listwise reranker behind config (disabled)
  - eval/recall-bakeoff.ts offline lever bake-off
  - 03-BAKEOFF.md with verdict BAKEOFF WINNER: cap8
affects: [03-12]
tech-stack:
  added: []
  patterns: [in-process CONCIERGE_CONFIG mutation for offline measurement]
key-files:
  created: [eval/recall-bakeoff.ts, .planning/phases/03-retrieval/03-BAKEOFF.md]
  modified: [src/lib/concierge-config.ts, src/lib/rerank.ts, src/lib/supabase.ts, eval/rerank.test.ts, eval/concierge-config.test.ts, eval/recall-offline.ts, package.json]
key-decisions:
  - "Bake-off winner is cap8 (no rerank): 47/52 frozen on both passes, exactly at the gate, 0 ms added latency, ~$0.00088/query added generation input"
  - "Haiku 5.5 must be called with thinking disabled, otherwise thinking tokens consume max_tokens and no text is returned"
duration: 90min
completed: 2026-11-22
---

# Phase 3 Plan 11: Recall-lever bake-off Summary

Built a disabled Haiku listwise reranker and measured every lever (cap 6/7/8 x none/Cohere/Haiku) offline; verdict `BAKEOFF WINNER: cap8`.

## Bake-off table (frozen recall, two passes)

| Candidate | Frozen p1 / p2 | Corrected p1 / p2 | Added latency p50 / max | Fallbacks | Qualifies |
|---|---|---|---|---|---|
| cap6 | 43 / 43 | 43 / 43 | 0 | 0 | no |
| cap7 | 45 / 45 | 45 / 45 | 0 | 0 | no |
| cap8 | 47 / 47 | 47 / 47 | 0 | 0 | yes |
| cohere-cap6 | 44 / 44 | 44 / 44 | 863 / 2226 ms | 0 | no |
| cohere-cap7 | 47 / 47 | 47 / 47 | 863 / 2226 ms | 0 | yes |
| cohere-cap8 | 48 / 48 | 48 / 48 | 863 / 2226 ms | 0 | yes |
| haiku-cap6 | 46 / 45 | 45 / 44 | 935 / 1793 ms | 11 | no |
| haiku-cap7 | 46 / 46 | 45 / 45 | 935 / 1793 ms | 11 | no |
| haiku-cap8 | 47 / 47 | 46 / 46 | 935 / 1793 ms | 11 | yes |

Controls OK (cap6 43/52, cohere-cap6 44/52). Per-call cost: Cohere ~$0.00008, Haiku ~$0.0005. Extra Sonnet input for 7th/8th chunk: ~$0.00043 (cap7), ~$0.00088 (cap8) per query. Full detail in 03-BAKEOFF.md.

`BAKEOFF WINNER: cap8`

## Tasks

1. Haiku listwise reranker with config, parser, tests (commit 019b8d8).
2. Bake-off script, recall-offline tweak, 03-BAKEOFF.md (commit 3917ecb).

## Spend

OpenRouter credit $21.02 before, $20.89 after (about $0.13 total across three runs; final run reranker spend $0.0613). Under the $0.50 cap.

## Deviations from Plan

**1. [Rule 1 - Bug] Haiku returned no text**
- Found during: Task 2 first bake-off run (99/104 fallbacks)
- Issue: Haiku 5.5 thinks by default; thinking tokens consumed `max_tokens: 200`.
- Fix: pass `thinking: { type: 'disabled' }` (untyped spread, since the installed SDK types lack the field). Bake-off rerun; the table is from the rerun.
- Files: src/lib/rerank.ts. Commit 3917ecb.

**2. [Rule 3 - Blocking] First rerun silently did not start** because `tsc` failed on the new field; fixed with the untyped spread.

**3. [Rule 2] Retry/guard in bake-off script**: retries a query up to 3 times if it did not run on hybrid_search_v2 and throws otherwise, after a transient ECONNRESET killed the first run.

## Known issues

- 11 of 104 Haiku calls (~11%) still returned unparseable output and fell back to the RRF order; cause not investigated. Haiku rows slightly underestimate a clean reranker. Haiku does not change the winner.
- cap8 qualifies exactly at the gate (47/52) with no headroom; remaining misses: Renew Home, Chorus (x2, disputed), AIG, J.P. Morgan.
- Teaser padding (RETR-05) with 8 case studies is not measurable offline; relies on the D-307 guard.
- Production unchanged: rerank.enabled false, maxCaseStudies 6. Adopting cap8 is a separate change.

## Self-Check: PASSED
