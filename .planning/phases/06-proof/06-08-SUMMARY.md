---
phase: 06-proof
plan: 08
subsystem: proof
tags: [static-checks, videos, site-work]
requires: ["06-05"]
provides:
  - "06-STATIC-CHECKS.json: site_work_missing 0, mismatched_videos 0 (input to eval/proof-report.ts --static)"
affects: [06-12]
key-files:
  created: [scripts/video-recheck.ts, .planning/phases/06-proof/06-STATIC-CHECKS.md, .planning/phases/06-proof/06-STATIC-CHECKS.json]
  modified: [data/site-work.json]
decisions:
  - "static_decision: skip (both counts 0); nothing ingested, no DB or storage write"
metrics:
  duration: n/a
  completed: 2026-11-25
requirements: [PROOF-01]
---

# Phase 6 Plan 08: Static checks Summary

Both ready-bar checks the eval does not measure re-confirmed against the live site and DB: site work missing from the index = 0, mismatched videos = 0.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | 268c603 | scripts/video-recheck.ts (select-only, HEAD/oEmbed); 19 video rows checked, 0 mismatched |
| 2 | 197de97 | site-work-diff re-run: same 18 URLs as Phase 2; 0 missing, 0 new |
| 3 | (none) | Decision checkpoint skipped by its own rule: both counts 0, recorded `static_decision: skip (both 0)` |

## Results

- Videos: 18 shown/linked videos plus 1 hidden (Android Gen Z Vimeo 1030871091, in unplayableUrls). All playable ones reachable (MP4 200 video/mp4; Simons Vimeo oEmbed 200). Every one is in the approved 02-VIDEO-AUDIT table for its study, with the 06-05 decision (Google for Education trailer MP4 as vimeo_url, poster present). Approved-but-absent in DB: none.
- Site work: 18 items. 14 indexed (including the 7 ingested in Phase 2, which now match their own slugs), 4 handled-skip with recorded Phase 2 reasons (ADP keynotes, Chrome Enterprise security, Simons brand portfolio, Google hub page), 0 missing, 0 new.

## Deviations from Plan

**1. [Rule 1 - Bug, data file] `use_vimeo` dropped by site-work-diff**
- Found during: Task 2. Re-running scripts/site-work-diff.ts removed the hand-edited `use_vimeo` field from data/site-work.json (the script preserves other hand-edited fields but not this one).
- Fix: restored `use_vimeo` per URL from the pre-run copy (data/.cache/site-work-before-06.json). The script itself was not changed (out of scope).

## Notes for 06-12

- 7 videos have no `.poster.jpg` (HTTP 400): 2 heroes (Task Mate driving-growth, Amazon re:MARS flagship) and 5 support videos. Informational only, not counted as mismatched; the card shows no poster preview for them. Not changed (storage writes are blocked and out of this plan's scope).

## Known Stubs

None.

## Self-Check: PASSED
