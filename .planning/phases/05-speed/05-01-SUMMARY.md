---
phase: 05-speed
plan: 01
subsystem: api
tags: [sse, config, streaming, typescript]
requires:
  - phase: 04-generation
    provides: concierge-config contract, JSON /api/chat route
provides:
  - Phase 5 config knobs (instantTeasers, generation, health) and generationParams()
  - Shared SSE event protocol (StreamEvent, encodeSse, SseDecoder)
  - Shared chat helpers (classifyError, validateChatBody, debugEnabled, toPublicOutput, buildDebugPayload)
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07, 05-08, 05-09, 05-10]
tech-stack:
  added: []
  patterns: [single shared event union for route, page and eval; env-overridable config knobs]
key-files:
  created: [src/lib/stream-events.ts, src/lib/chat-errors.ts, src/lib/chat-request.ts, eval/stream-events.test.ts, eval/debug-gate.test.ts]
  modified: [src/lib/concierge-config.ts, src/app/api/chat/route.ts, eval/concierge-config.test.ts]
key-decisions:
  - "generation.mode defaults to 'default' so generationParams() returns {} (request body unchanged from Phase 4)"
  - "SseDecoder holds a trailing lone CR so CRLF split across chunks decodes correctly"
requirements-completed: [PERF-01, PERF-02, PERF-03]
duration: 20min
completed: 2026-11-23
---

# Phase 5 Plan 01: Shared Contracts Summary

**Config knobs, SSE event protocol and chat helpers extracted from the JSON route with behaviour unchanged.**

## Accomplishments
- concierge-config gained `instantTeasers` (count 3, floor 0.40, claim pattern), `generation` (mode 'default'), `health` ($5 warn, 3000/5000 ms), plus `generationConfig()`, `generationParams()`, `generationConfigKey()` with env overrides.
- `src/lib/stream-events.ts`: nine-variant `StreamEvent` union, `encodeSse`, `SSE_KEEPALIVE`, `SseDecoder` (split-safe, CRLF-safe, drops unknown/invalid frames).
- `chat-errors.ts` (classifyError verbatim) and `chat-request.ts` (validation, debug gate, public output, debug payload); `route.ts` now calls them.

## Task Commits
1. Task 1 config knobs: 27e2365
2. Task 2 SSE protocol: 60315b4
3. Task 3 helper extraction: 59ef4fc

## Verification
- `npm run eval:test`: 141/141 pass
- `tsc --noEmit` clean, `npm run lint` clean
- `git diff src/lib/orchestrator.ts src/lib/catalogue.ts` empty (prompt cache untouched)
- No paid model calls made.

## Deviations from Plan
None in behaviour. Minor: removed an `eslint-disable` comment for a rule not defined in this project's ESLint config (it errored); `route.ts` comment reworded so no `EVAL_DEBUG` string remains there, per acceptance criteria.

## Known Stubs
None.

## Self-Check: PASSED
