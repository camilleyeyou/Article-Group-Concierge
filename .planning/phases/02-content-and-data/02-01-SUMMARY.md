---
phase: 02-content-and-data
plan: 01
subsystem: data
tags: [embeddings, content_chunks, articles, supabase]
requires: []
provides:
  - 133 article chunks (44 docs) live in content_chunks, linked to the existing documents rows
  - scripts/embed-articles.ts (prepare / simulate / insert / verify, idempotent)
  - data/article-classes.json (50 articles classified)
  - data/held-article-chunks.json (6 held docs, no embeddings, for Phase 3)
affects: [02-06 eval rerun, Phase 3 hybrid_search_v2]
tech-stack:
  added: []
  patterns: [simulate before writing to the DB; idempotent insert that skips docs that already have chunks]
key-files:
  created:
    - scripts/embed-articles.ts
    - data/article-classes.json
    - data/held-article-chunks.json
    - .planning/phases/02-content-and-data/02-ARTICLES-IMPACT.md
  modified:
    - .gitignore
key-decisions:
  - "User chose insert-all (2026-11-21): simulated recall was unchanged (36/52) and 0 expected case studies were displaced"
  - "company_info (5) and LinkedIn (1) docs held for Phase 3 per D-18"
patterns-established:
  - "data/.cache/ (gitignored) holds prepared embeddings between prepare and insert"
requirements-completed: [DATA-01]
duration: ~20 min
completed: 2026-11-21
---

# Phase 2 Plan 01: Article Chunk Embedding Summary

AG's 44 thought-leadership and newsletter articles are now chunked, embedded and retrievable: 133 chunks were added to `content_chunks` (43 → 176 rows) with no new or changed `documents` rows. Company-info and LinkedIn text is held for Phase 3.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Classify articles + write script | f34a7a0 | 50 classified: 35 thought_leadership, 9 newsletter, 5 company_info, 1 excluded |
| 2 Prepare, simulate, report | b6dec9b | 153 chunks prepared (max 1,939 chars), spend about $0.001 |
| 3 Decision checkpoint | (this commit) | User: insert-all |
| 4 Apply + verify | (this commit) | 133 inserted, VERIFY OK, rerun inserted 0 |

## Results

- Simulated recall 36/52 before and after, with 0 expected case studies displaced. Mean case studies per query fell from 3.86 to 3.64, and an article was selected for 49/50 queries.
- Probes return the right article first for creative briefs, Barbie marketing and empathy maps.

## Deviations

- The executor subagent stopped at the checkpoint and would not act on a relayed approval. The orchestrator ran Tasks 3–4 inline after the user answered insert-all directly.

## Issues / Follow-ups

- Articles take some of the top-20 slots: 9/50 queries now have fewer than 4 distinct case studies in the window. The 02-06 eval will show whether this matters, and Phase 3's hybrid_search_v2 should address it.

## Self-Check: PASSED
