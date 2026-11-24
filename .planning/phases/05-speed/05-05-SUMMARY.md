---
phase: 05-speed
plan: 05
subsystem: api
tags: [streaming, sse, orchestrator, route, perf-01, perf-02]
requires:
  - phase: 05-speed
    provides: stream-events, chat helpers (05-01), generationModelId (05-02), decideInstantTeasers (05-03), StreamLayoutParser (05-04)
provides:
  - orchestrateStream typed-event generator (hero, hero_done, component, narrative, final)
  - POST /api/chat/stream SSE route
  - exported parseOrchestratorResponse, orchestratorCacheKey
affects: [05-06, 05-07, 05-08]
key-files:
  created: [src/app/api/chat/stream/route.ts, eval/stream-equivalence.test.ts]
  modified: [src/lib/orchestrator.ts, src/lib/layout-postprocess.ts]
key-decisions:
  - "Stream and JSON paths share orchestratorCacheKey, buildMessages, buildSystemBlocks and generationParams; the key gains generationConfigKey() (in-memory cache only)"
  - "Stream errors propagate to the route (classified into an error event), not swallowed into a fallback"
requirements-completed: []
completed: 2026-11-23
---

# Phase 5 Plan 05: Streaming Route Summary

**orchestrateStream now yields typed preview events and an authoritative final identical to orchestrate()'s output; POST /api/chat/stream sends instant teasers before the model call.**

## Accomplishments
- Task 1 (f63e4f1): `orchestrateStream(input, opts)` using raw `messages.create({stream:true})` events, StreamLayoutParser previews, DB tags forced on teaser components, usage merge from message_start/message_delta, verifier post-pass (D-508), cache read/write like orchestrate(). SYSTEM_PROMPT and catalogue block untouched; `generationParams()` is `{}` in default mode so the JSON request is unchanged.
- Task 2 (4217fce): route with rate limit, validation, debug gate only via `debugEnabled(body)`, concurrent retrieval + catalogue, teasers/suppressed event, 15 s keepalive, abort on disconnect, classified error event, analytics parity. JSON route not touched.

## Verification
- `npm run eval:test`: 187/187 pass (new stream-equivalence tests replay all 4 fixture samples with 3 chunking seeds, no network)
- `npx tsc --noEmit` clean; `npm run lint` clean; `npm run build` succeeds and lists `/api/chat/stream`
- `git log -- src/app/api/chat/route.ts | grep -c 05-05` = 0
- No paid model calls.

## Deviations from Plan
- **Local curl checks not run.** The plan's step 7 (start dev server, curl the two 400 cases and the GET health check) was blocked by the sandbox permission classifier, so the 400 / health responses were not observed. The 400 path is plain `validateChatBody` (shared with the JSON route, "hi" is under 3 chars) and the build compiles the route. Recommend running these three curls once during 05-08.
- Left an unused-variable-free cache-hit replay: the hero is skipped in the component loop by index, components keep their original layout index.

## Known Stubs
None.

## Self-Check: PASSED
Files and commits (f63e4f1, 4217fce) verified present.
