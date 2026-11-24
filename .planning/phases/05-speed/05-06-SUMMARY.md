---
phase: 05-speed
plan: 06
subsystem: ui
tags: [streaming, sse, react, skeleton, perf-01, perf-02]
requires:
  - phase: 05-speed
    provides: SseDecoder and StreamEvent protocol (05-01), /api/chat/stream route (05-05)
provides:
  - streamViewReducer, deriveLayout, reconcileTeasers (pure, tested)
  - HeroSkeleton reserved dark hero
  - LayoutRenderer pendingHero / exitingSlugs / exiting props with stable keys
  - page.tsx streaming submit with JSON rollback (NEXT_PUBLIC_CHAT_STREAM=false)
affects: [05-07, 05-08, 05-09]
key-files:
  created: [src/lib/stream-view.ts, eval/stream-view.test.ts, src/components/HeroSkeleton.tsx]
  modified: [src/components/LayoutRenderer.tsx, src/styles/design-system.css, src/app/page.tsx]
key-decisions:
  - "Live and stored assistant turns render through one AssistantMessage under the same message id, so final does not remount"
  - "Page keeps a local mirror of the reducer state in the stream loop to read exit slugs and partial decks synchronously"
  - "Partial deck kept after a mid-stream error is stored with partial:true and dropped again by handleRetry"
requirements-completed: []
completed: 2026-11-23
---

# Phase 5 Plan 06: Streaming UI Summary

**The chat page now renders the SSE stream progressively per 05-UI-SPEC: instant teasers under a reserved dark hero skeleton, hero text typing in, whole components fading in, reconcile to the model's layout, and partial-deck errors.**

## Accomplishments
- Task 1 (68df401): pure view state, 11 unit tests covering every behaviour bullet.
- Task 2 (bbe27e8): HeroSkeleton (min-h 220/260, h-5 summary bars per checker recommendation), LayoutRenderer stable keys (hero, teaser-group-n, teaser-slug, per-type counters), exiting teasers fade 150 ms, fade-in on non-hero components, reduced-motion extension in the existing block.
- Task 3 (7bf1e20): streaming submit, status copy per spec, aria-live/aria-busy, scroll counter, JSON path preserved.

## Verification
- `npm run eval:test` 198/198, `npx tsc --noEmit` clean, `npm run lint` clean, `npm run build` succeeds.
- No paid calls and no queries sent to a server; visual checks are deferred to the 05-09 checkpoint.

## Deviations from Plan
- None from 05-UI-SPEC copy or tokens. CaseStudyTeaser and HeroBlock untouched.
- Small additions: each teaser is wrapped in a plain div (carries the fade-out class; CaseStudyTeaser has no h-full so layout is unchanged); `history` sent to the server now omits empty-content messages (only possible for a kept partial deck).
- Hero skeleton min-height and bar heights were not measured against a rendered HeroBlock (no browser run here); verify at 05-09.
- Known accepted shift (from plan): components placed between hero and teasers push the teaser grid down when they arrive.
- If the final hero omits backgroundVariant, HeroBlock's light default appears at hero_done (stream shows dark until then); rare (1/50 in Phase 4).

## Known Stubs
None.

## Self-Check: PASSED
Files and commits (68df401, bbe27e8, 7bf1e20) verified present.
