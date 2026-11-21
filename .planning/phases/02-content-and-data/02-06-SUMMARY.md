---
phase: 02-content-and-data
plan: 06
subsystem: eval
tags: [eval, recall, pgvector, ivfflat, supabase]
requires: [02-01, 02-02, 02-03, 02-04, 02-05]
provides:
  - 02-EVAL-DELTA.md (final deltas vs frozen and re-graded baselines)
  - hybrid_search_exact RPC (migration 004, applied by the user) and the app fallback in src/lib/supabase.ts
affects: [Phase 3 hybrid_search_v2, production deploy]
tech-stack:
  added: []
  patterns: [additive DB function next to the old one, app falls back if the new one is missing]
key-files:
  created:
    - supabase/migrations/004_hybrid_search_exact.sql
    - .planning/phases/02-content-and-data/02-EVAL-DELTA.md
    - .planning/debug/phase2-recall-regression.md
  modified:
    - src/lib/supabase.ts
key-decisions:
  - "User: diagnose the recall drop before acting, then add a new function alongside (not replace hybrid_search)"
  - "set_config in the body instead of a function SET clause (Supabase 42501 on SET ivfflat.probes)"
  - "User: rerun the eval once after the fix ($4.24)"
requirements-completed: []
duration: ~6 h wall clock (including diagnosis)
completed: 2026-11-21
---

# Phase 2 Plan 06: Eval Rerun and Delta Summary

The final Phase 2 eval matches the baseline: recall 75% (39/52) and all quality metrics within noise of the re-graded baseline. The new content is used: all 7 new case studies are retrieved and an article appears in 48/50 responses.

## What happened

1. Run 1 (`2026-11-21T17-02-54`) showed recall at 21%.
2. Diagnosis (debug session `phase2-recall-regression.md`) traced the drop to lossy ivfflat search. With probes = 1, the cached generic plan scanned 1 of 100 lists once the table grew to 192 rows. Content changes were ruled out.
3. Fix: migration 004 adds `hybrid_search_exact`, and the app calls it with a fallback to `hybrid_search`. The first SQL attempt failed with 42501 on the `SET` clause, so it moved to `set_config` in the body. The user applied it.
4. Read-only check: 50/50 calls return the full 20 rows, and `retrieveContext` recall is 39/52.
5. Final run (`2026-11-21T21-15-13`, commit `bb8d0d8`): recall 75%, grounded 3.84 (re-graded 3.92), hallucinations 0.

## Deviations

- The plan expected only a rerun and a report. The regression added a debug session, a migration and a code change, all approved by the user step by step.
- The eval cost $2.98 + $4.24, leaving $26.03 of credit.

## Follow-ups

- Production is fixed only after the Phase 2 push and deploy.
- Add an eval preflight check that the search RPC returns full row counts over about 10 calls.
- Phase 3: decide whether articles belong in nearly every answer (48/50), and size or drop the ivfflat index in `hybrid_search_v2`.

## Self-Check: PASSED
