---
phase: 05-speed
plan: 03
subsystem: instant-teasers
tags: [perf-01, d-501, d-502, d-504, suppression]
requires: [05-01]
provides: [decideInstantTeasers, suppressionReason, buildInstantTeasers, deliverablesBySlug, phase4-retrieval-scores fixture]
affects: [05-04 route streaming (consumes decideInstantTeasers)]
key-files:
  created:
    - src/lib/instant-teasers.ts
    - eval/instant-teasers.test.ts
    - eval/make-suppression-fixture.ts
    - eval/fixtures/phase4-retrieval-scores.json
    - eval/suppression.test.ts
  modified:
    - src/lib/catalogue.ts
    - eval/catalogue.test.ts
decisions:
  - "Suppression calibration counts floor + claim pattern only; isAboutAG is tested separately because it also fires on p4-q03"
metrics:
  tasks: 2
  completed: 2026-11-23
---

# Phase 5 Plan 03: Instant teaser logic Summary

Pure module deciding which retrieved case studies show before the model speaks (DB text only, digit-free deliverables line verbatim) and when to show none (no case studies, about-AG, prior-work claim pattern, semantic floor 0.40).

## Tasks
1. `a72d63b` feat: `Catalogue.deliverablesBySlug` + `src/lib/instant-teasers.ts` + tests. `formatCatalogue`, `CATALOGUE_RULE`, `catalogueVersion` untouched; a new byte-exact catalogue test guards the prompt cache.
2. `3c92b5a` test: fixture generator (reads saved run `2026-11-22T22-48-20`, no network, no cost), committed 50-record fixture, suppression regression test.

## D-504 suppression stats (fixture, 50 records)
| Floor | Fallback suppressed | Bait | Direct false-suppressed |
|---|---|---|---|
| 0.40 | 19/21 (misses p4-q03 0.639, p4-q07 0.417) | 5/5 (claim_pattern) | 4/29: p2-q03, p2-q05, p2-q06, p4-q06 |
| 0.45 | 20/21 | 5/5 | 8/29 |

Claim pattern matches exactly p1-q09, p2-q09, p3-q09, p4-q09, p5-q09.

## Deviations from Plan
**Finding (not a code fix):** the full `suppressionReason` suppresses 20/21 fallback at 0.40, not 19/21, because `isAboutAG` matches p4-q03 ("early-career" hits the `career` keyword). That is an accidental catch (word-boundary match across the hyphen), not a score-based one. The planner's numbers are reproduced by counting floor + claim pattern only (about_ag ignored); the test asserts both views and does not hide the difference. Direct false-suppression is unchanged (4/29) under both. The p4-q03 miss remains a real weakness of the score floor.

No paid calls, no DB access.

## Known Stubs
None.

## Self-Check: PASSED
Files and commits (a72d63b, 3c92b5a) verified; `npm run eval:test` 165 pass, `tsc --noEmit` and `npm run lint` clean.
