---
phase: 05-speed
plan: 04
subsystem: api
tags: [streaming, parser, tdd, typescript]
requires:
  - phase: 05-speed
    provides: stream-events protocol (05-01)
provides:
  - StreamLayoutParser incremental parser (hero partials, complete components, narrative deltas)
  - eval/fixtures/model-raw-samples.json (4 real model outputs)
affects: [05-05]
tech-stack:
  added: []
  patterns: [hand-rolled incremental JSON state machine, fail-safe abandon with authoritative end-of-stream parse]
key-files:
  created: [src/lib/stream-layout-parser.ts, eval/stream-layout-parser.test.ts, eval/fixtures/model-raw-samples.json]
  modified: []
key-decisions:
  - "Leading prose before the fence is tolerated but not previewed as narrative; the final whole-response parse stays authoritative"
  - "Partial hero strings never end on a lone high surrogate, so every preview is a true prefix of the final value"
requirements-completed: []
duration: 25min
completed: 2026-11-23
---

# Phase 5 Plan 04: Incremental Layout Parser Summary

**Pure state-machine parser that streams hero title/subtitle/challengeSummary as growing partials and emits other components only when complete, over the unchanged output format.**

## Accomplishments
- `StreamLayoutParser` (`push`, `end`, `fullText`) with events `hero`, `hero_done`, `component`, `narrative`, `abandoned`; never throws, after `abandoned` it only accumulates text.
- Narrative deltas hold back any suffix that is a prefix of `**Want to explore`, so the marker never leaks even when split across chunks.
- Malformed items, unexpected tokens, or no fence within 400 non-whitespace chars produce one `abandoned` event.
- Fixture built from saved raw outputs of run 2026-11-22T22-48-20 (no model calls): p1-q03 (VideoPlayer), p1-q04 (direct), p1-q08 (well_formed, fallback), p1-q09 (invention_bait). No sample in that run contains a MetricGrid, so the second direct query was used as the plan allows.

## Task Commits
1. Task 1 fixture and failing tests (RED): 0727a81
2. Task 2 parser (GREEN): 3f1112f

## Verification
- `npx tsx --test eval/stream-layout-parser.test.ts`: 14/14 pass (seeds 1..25 plus single-char splits on every sample)
- `npm run eval:test`: 179/179 pass
- `npx tsc --noEmit` clean, `npm run lint` clean
- No partial-json or best-effort-json dependency added; no paid model calls.

## Deviations from Plan
None in behaviour. The fixture sample choice (above) follows the plan's fallback wording. The plan's verification mentions `npm run type-check`, which is `tsc --noEmit` and was run as such.

## Known Stubs
None.

## Self-Check: PASSED
