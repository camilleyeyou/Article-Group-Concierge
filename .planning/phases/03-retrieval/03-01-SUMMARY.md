---
phase: 03-retrieval
plan: 01
subsystem: database
tags: [supabase, pgvector, hybrid-search, rrf, postgres-fts]
requires:
  - phase: 02-content
    provides: embedded article chunks, hybrid_search_exact
provides:
  - hybrid_search_v2 SQL function (live in Supabase, alongside the old functions)
  - scripts/check-hybrid-v2.ts verification
  - scripts/insert-held-chunks.ts (dry-run default; not yet run with --insert)
affects: [03-02, 03-10]
tech-stack:
  added: []
  patterns: [whole-corpus scoring with window ranks per doc_type fused by RRF, OR tsquery via regexp_replace]
key-files:
  created:
    - supabase/migrations/005_hybrid_search_v2.sql
    - scripts/check-hybrid-v2.ts
    - scripts/insert-held-chunks.ts
  modified: []
key-decisions:
  - "hybrid_search_v2 added alongside hybrid_search and hybrid_search_exact; neither was modified"
  - "Held docs are not inserted in this plan; insert-held-chunks.ts defaults to dry run and runs in Plan 03-10"
requirements-completed: [RETR-01]
duration: ~30min
completed: 2026-11-22
---

# Phase 3 Plan 01: hybrid_search_v2 Summary

**Additive `hybrid_search_v2`: whole-corpus OR keyword search weighted title/client/taxonomy over body, fused with semantic ranks by RRF per doc_type, excluding `excluded` and (by default) `company_info` chunks. Live and passing 8/8 checks.**

## Accomplishments
- Migration 005 creates only the new function and a GRANT. Migrations 003 and 004 are unchanged.
- No `ORDER BY embedding <=> q LIMIT`, so the lossy ANN plan is avoided; `ivfflat.probes = 100` is kept as a guard.
- OR-query expression checked locally: `'messag' | 'hous' | 'marketectur' | 'go-to-market' | 'go' | 'market'` (only `|` operators).
- Applied by the user in the Supabase SQL Editor with no SQL changes needed.

## check-hybrid-v2 output
```
PASS a. hybrid_search_v2 exists
PASS b. hybrid_search_exact still works - 20 rows
PASS c1. 10 consecutive p1-q06 calls each return exactly 60 rows
PASS c2. all 50 queries return min(60, 192 eligible) = 60 rows
PASS d1. no excluded/company_info rows with include_company_info=false - 0 found
PASS d2. no excluded rows with include_company_info=true
  company_info chunks in DB: 0 - trivially true (no company_info chunks yet)
PASS e. CrowdStrike within first 6 case-study docs for p1-q06 - slug=crowdstrike-applying-the-power-of-a-great-marketecture position=3
PASS f. shape: RRF combined_score in (0, 0.05), integer ranks - 0 bad rows

check-hybrid-v2: 8/8 checks passed
```

## insert-held-chunks --dry-run output
```
6 held docs (5 company_info x 1 chunk, 1 excluded x 15 chunks); all documents exist, 0 chunks in DB
DRY RUN: 6 docs, 20 chunks, ~6242 tokens, est. embedding cost ~$0.0001
Nothing inserted.
```
`--insert` without `--yes` refuses and exits 1. No rows were inserted in this plan.

## Task Commits
1. Task 1, migration 005: `0944f02`
2. Task 2, scripts: `25ab608`
3. Task 3 (user applied migration), plus script fix: `681c06b`

## Deviations from Plan
**1. [Rule 1 - Bug] CrowdStrike slug lookup matched the wrong document**
- **Found during:** Task 3 verification
- **Issue:** `indexed_documents.find(slug includes 'crowdstrike')` matched the LinkedIn posts collection, so check e failed (7/8). The SQL was correct.
- **Fix:** Match `doc_type === 'case_study'` with slug containing `crowdstrike` and `marketecture`, falling back to the query's expected case studies.
- **Files modified:** scripts/check-hybrid-v2.ts
- **Commit:** 681c06b

## Notes
- OpenRouter preflight showed $25.67 of $50 left, not the ~$45 recorded in STATE.md and CLAUDE.md. Budget later paid eval runs (about $3.50 each) against this.
- The eval dev server was not running at preflight (not needed for this plan).

## Known Stubs
None.

## Self-Check: PASSED
