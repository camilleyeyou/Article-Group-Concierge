---
phase: 02-content-and-data
plan: 02
subsystem: data
tags: [scrape, site-work, documents, content_chunks, supabase]
requires: []
provides:
  - 7 new case-study documents (16 chunks) from articlegroup.com/work
  - scripts/site-work-diff.ts (scrape + fuzzy match + approval table)
  - scripts/ingest-site-work.ts (dry-run / --yes / --verify, idempotent, insert-only)
  - data/site-work.json (18 items with user decisions)
affects: [02-03 taxonomy (new studies need tags), 02-05 video audit (3 new vimeo links), 02-06 eval]
tech-stack:
  added: []
  patterns: [approval table in JSON before any ingest; slug_override for placeholder site slugs]
key-files:
  created:
    - scripts/site-work-diff.ts
    - scripts/ingest-site-work.ts
    - data/site-work.json
    - .planning/phases/02-content-and-data/02-SITE-DIFF.md
  modified: []
key-decisions:
  - "User: ingest #7 Android Gen Z, #9 Google for Education, #13 Amazon re:MARS site page, #15 Salesforce, #16 Box, #17 Simons Education, #18 NAR HouseLogic; skip the other 11"
  - "Salesforce text stripped of third-party ecosystem forecasts so they can never be cited as AG results"
  - "Google hub page skipped (spans several engagements, attribution risk)"
  - "Vimeo attached for #7, #9, #17; no PDF text appended"
requirements-completed: [DATA-02]
duration: ~30 min
completed: 2026-11-21
---

# Phase 2 Plan 02: Site Work Diff + Ingest Summary

All 18 work pages on articlegroup.com/work are accounted for. 7 missing ones are now indexed as case studies (7 documents, 16 chunks), and each ranks first for its own probe. The other 11 were already indexed or near-matched, or skipped by user decision.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Scrape, match, approval table | bc13f94 | 18 items: 6 indexed, 5 near-match, 7 missing; www now 301s to the non-www URL |
| 2 User approval checkpoint | e1c7450 | Decisions recorded; Salesforce forecasts stripped |
| 3 Ingest script + apply | 1aaf325 + this commit | Dry run, then insert 7/16, VERIFY OK, rerun inserted 0 |

## Deviations

- Task 3 was split. A subagent wrote the script and ran the dry run, and the orchestrator ran the DB insert after the user's direct approval.
- The plan's optional PDF-text append was not applied because no PDF approval was recorded.

## Follow-ups

- The 7 new studies have no taxonomy links yet, so 02-03 must cover them.
- The 3 new Vimeo links (#7, #9, #17) should be included in the 02-05 video audit.
- The new studies have no PDF, so their detail pages show "Document Coming Soon".
- The Box site URL slug contains the phrase "increasing awareness". That phrase is not in the ingested text, but the claim should stay out of answers.

## Self-Check: PASSED
