---
phase: 06-proof
plan: 05
subsystem: generation-fixes
tags: [prompt, voice, count-claim, video, eval-harness]
requires: ["06-01"]
provides:
  - "voiceRule() and countClaimRule() in concierge-config, rendered in SYSTEM_PROMPT; challengeSummary rule in heroPassInstruction()"
  - "Eval video checks that count only playable and (for missing-video) presented studies"
  - "06-FIX-NOTES.md with Voice, Count claim, Video, Disclosures sections"
affects: [06-06, 06-07, 06-12]
key-files:
  created: [.planning/phases/06-proof/06-FIX-NOTES.md, .planning/phases/06-proof/backup-video-2026-11-24.json]
  modified: [src/lib/concierge-config.ts, src/lib/orchestrator.ts, src/lib/sentences.ts, eval/lib.ts, eval/prompt.test.ts, eval/concierge-config.test.ts, eval/sentences.test.ts, eval/video.test.ts, eval/metrics.test.ts, eval/rubric.test.ts]
decisions:
  - "Video: option B + harness option D, confirmed by the user; user applied the one-row DB update and the poster themselves"
metrics:
  duration: n/a
  completed: 2026-11-25
requirements: [PROOF-01]
---

# Phase 6 Plan 05: Generation-side fix pass Summary

Voice and count-claim rules are in shared config and both prompts, the eval video check now measures what the app actually offers, and the Google for Education study has a playable video and poster.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | 7600919 | voiceRule/countClaimRule in SYSTEM_PROMPT, challengeSummary rule in hero pass, "J.P." added to sentence-counter abbreviations |
| 2 | 0f703b1 | `isPlayableVideoUrl` in both eval video checks; video facts and options in notes |
| 3 | a2c31dd, plus this docs commit | option D, fixture updates, backup, decision record, Disclosures |

## Video outcome

- Flagged query was p4-q05 (06-CONTEXT said p4-q09). The harness fix alone did not clear it because other retrieved studies had playable videos, so option D (missing-video counts only presented studies) was added.
- Option B was applied by the user, not the agent: one-row UPDATE of `documents.vimeo_url` in the Supabase SQL editor, poster uploaded with `scripts/upload-video-posters.ts` from the t=2s frame. Verified read-only: 1 row, trailer MP4 HEAD 200, `isPlayableVideoUrl` true, poster HEAD 200. Rollback from `backup-video-2026-11-24.json`.
- The agent's own write attempt was denied by the permission classifier and was not retried by another route.

## Deviations from Plan

**[Rule 1 - Bug] Plan premise on p4-q05:** the harness fix did not clear the flag; option D added with user approval. Existing fixtures in eval/metrics.test.ts and eval/rubric.test.ts assumed the old all-retrieved behaviour and were updated to present the study.

**[Rule 1] J.P. sentence split:** confirmed countSentences returned 3, fixed.

## Disclosures for 06-12

The `video_query_missing_video` check was corrected (unplayable URLs ignored) and narrowed (presented studies only) in Phase 6; earlier values are not strictly comparable.

## Verification

`npx tsx --test eval/*.test.ts`: 257 pass, 0 fail. `tsc --noEmit` clean. No paid calls. Prompt changes are untested against live output; paid verification is plan 06-07. No held-out query was consulted; eval/queries.json unchanged.

## Known Stubs

None.

## Self-Check: PASSED
