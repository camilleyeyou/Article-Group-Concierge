---
phase: 02-content-and-data
plan: 05
subsystem: data
tags: [video, hero_video_url, support_videos, storage, audit]
requires: [02-02]
provides:
  - every case-study video checked against its study (25 rows); approved mismatches fixed
  - scripts/video-audit.ts (--extract keyframes/audio, --apply --dry-run / --yes with backup first, idempotent)
  - scripts/transcribe.py (local faster-whisper; not run, install blocked)
  - data/video-fixes.json (actions + user decisions), data/video-backup.json (pre-change state)
affects: [02-06 eval (video components), owner demo]
tech-stack:
  added: []
  patterns: [keyframe contact sheets for video verdicts; backup before write; HEAD-check before relink]
key-files:
  created:
    - scripts/video-audit.ts
    - scripts/transcribe.py
    - data/video-fixes.json
    - data/video-backup.json
    - .planning/phases/02-content-and-data/02-VIDEO-AUDIT.md
  modified: []
key-decisions:
  - "User approved all proposed actions incl. unsure #17, #18, #22, #24; frame-based verdicts accepted (no transcripts)"
  - "Google cross-product hero (a Google Careers recruiting spot) unlinked; no correct video exists"
requirements-completed: [DATA-05]
duration: ~60 min (incl. a usage-limit pause)
completed: 2026-11-21
---

# Phase 2 Plan 05: Video Audit Summary

All 25 video rows were audited from keyframes, on-screen text and study text, and every approved fix is live. That covers 4 wrong heroes unlinked, 1 hero moved, 3 support videos moved or removed, and 2 previously unlinked files attached. 10 heroes, 3 Vimeo links and 6 support videos remain, and every storage URL returns HTTP 200.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Extract frames/audio | 80f0386 | 22 storage videos framed; transcription blocked (pip install denied) |
| 2 Verdict table + fixes | 5f39d71 | 13 match, 6 mismatch, 6 unsure |
| 3 User approval | this commit | All approved |
| 4 Apply (code f537517) + verify | this commit | Applied; idempotency bug fixed; 16/16 URLs 200 |

## Deviations

- The executor stopped on a usage limit mid-Task 1 and was resumed.
- The orchestrator ran the apply after the user's direct approval.
- **Bug:** the first idempotency rerun created 4 bad support rows because the duplicate check never matched and link_new re-added the hero as support. The script was fixed, the 4 rows created in that run were deleted by ID, and the fixed rerun is a no-op.

## Follow-ups

- The verdicts have no transcripts. Thorn (#16), ROYBI (#18) and the Connect keynote (#17) rest on frames only.
- The Vimeo links #19 and #20 couldn't be fetched from this machine (403/404). They're kept on the strength of the articlegroup.com embed.

## Self-Check: PASSED
