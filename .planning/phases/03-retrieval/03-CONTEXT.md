# Phase 3: Retrieval - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning
**Source:** User answers after 03-RESEARCH.md (no discuss-phase run)

<domain>
## Phase Boundary

Retrieval returns the case studies a prospect would expect (recall >= 90%), via `hybrid_search_v2` alongside the existing functions. The case-study catalogue becomes a cached system-prompt prefix. Responses stop padding to 4 teasers. Scope is RETR-01..06.

</domain>

<decisions>
## Implementation Decisions

### Eval labels (D-301)
- Do NOT edit the frozen eval labels. `recall_pct` stays on the frozen labels, so it still compares with baseline 2026-11-20T15-12-31.
- Add a second figure, `recall_pct_corrected`, computed with the 3 disputed labels removed: Chorus (Alphabet X) on the 2 security queries, and Renew Home as the cloud-security example. List the disputed labels in the phase eval report.
- The >= 90% gate is judged on the frozen-label `recall_pct`. Report the corrected figure alongside it.

### Case-study cap (D-302)
- Retrieval passes up to 6 case studies into context (up from 4); the articles cap stays as it is.
- The prompt no longer requires a CaseStudyTeaser for every retrieved study (RETR-05). The model shows only the studies relevant to the query, and fewer than 4 is fine.
- The teaser rule comes from one setting in `src/lib/concierge-config.ts`, which drives both the system prompt and `eval/rubric.ts` (line ~55 hard-codes it today).
- Add a "shown recall" diagnostic to the eval report: expected studies that appear as teasers. It does not replace `recall_pct`.

### Reranker (D-303)
- Gate: after wave 1 (v2 + whole-word intent + no 0.15 cutoff + cap 6 + catalogue + teaser setting), run the free offline recall check. If frozen-label recall is below 47/52, add a reranker wave.
- Reranker choice: `cohere/rerank-5-fast` through OpenRouter `/api/v1/rerank`, scoring a candidate pool of about 20 docs (semantic top-15 + keyword top-10). If the rerank call fails, keep the RRF order.
- Before the reranker goes to production, tell the user that case-study text will go to Cohere as a new data processor, and get their confirmation (checkpoint).

### Grader sees catalogue (D-304)
- The eval harness passes the cached catalogue to the grader as part of the context the app saw, so catalogue facts (title, client, tags) are not marked as unsupported claims.

### Carried constraints
- New SQL goes in `hybrid_search_v2` (migration 005), alongside `hybrid_search` and `hybrid_search_exact`; never replace in place. There is no DATABASE_URL, so the user runs the migration in the Supabase SQL Editor (human checkpoint).
- Insert the 6 held docs (20 chunks) only after production is calling v2. Ask before any destructive DB change.
- Generation model stays Sonnet 5.5; judge stays Opus 5.5.
- Budget is about $26 of OpenRouter credit. Use the offline recall check for iteration, and run the full eval (about $4.25) once at the end, unless the user asks for more runs.
- Restore Supabase before the eval if it has paused.

### Claude's Discretion
- Exact RRF parameters, tsvector weights, catalogue fields (within research guidance: title, client, slug, tags, video flag, optional "Solution included…" sentence; no goals or metrics), and how `formatContext` labels relevance under RRF scores.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/03-retrieval/03-RESEARCH.md`: findings, SQL sketch, caching facts, Validation Architecture
- `eval/PLAN.md`: verified retrieval findings and the ready bar
- `.planning/phases/02-content-and-data/02-EVAL-DELTA.md`: latest run, recall misses, exact-search fix
- `supabase/migrations/003_pdf_first_ui_restructure.sql`, `004_hybrid_search_exact.sql`: existing functions (do not modify)

</canonical_refs>

<deferred>
## Deferred Ideas

- Query rewriting: only if the reranker still leaves recall below the gate.
- Latency work: Phase 5.

</deferred>

---
*Phase: 03-retrieval*
