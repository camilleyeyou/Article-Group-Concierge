---
phase: 07-fast-hero-stops-restating-the-query
plan: 03
subsystem: generation
tags: [hero, output-guard, restatement, HERO-03, replay]
requires:
  - phase: 07-01
    provides: detectHeroRestatement, heroRestatementGuardEnabled
  - phase: 07-02
    provides: v2 hero instruction (the guard is its fallback)
provides:
  - "guardHeroRestatement (rule 'hero_restatement', action 'drop_field'), OUTPUT_GUARD_VERSION 2"
  - "applyHeroRestatementGuard on orchestrate() and orchestrateStream() behind HERO_RESTATEMENT_GUARD_ENABLED and OUTPUT_GUARD_ENABLED"
  - "eval/hero-guard-replay.ts + reviewed replay (07-HERO-GUARD-REPLAY.md/.json/.verdicts.json)"
  - "Detector v2 (HERO_RESTATEMENT_VERSION 2): three regex narrowings from the review"
affects: [07-04, 07-05, every later eval report (hero_restates uses the detector)]
tech-stack:
  added: []
  patterns: [removal-only guard rule applied by the orchestrator because it needs the query]
key-files:
  created:
    - eval/hero-restatement-guard.test.ts
    - eval/hero-guard-replay.ts
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-GUARD-REPLAY.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-GUARD-REPLAY.json
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-GUARD-REPLAY.verdicts.json
  modified:
    - src/lib/output-guard.ts
    - src/lib/orchestrator.ts
    - src/lib/hero-restatement.ts
    - eval/output-guard.test.ts
    - eval/hero-restatement.test.ts
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-REPLAY.md
    - .planning/phases/07-fast-hero-stops-restating-the-query/07-HERO-REPLAY.json
key-decisions:
  - "Hero restatement fallback only removes text: it drops restating challengeSummary sentences and deletes the field when nothing is left; title and subtitle are never touched"
  - "Detector v2: 'You can' is not a you-opener; embedded 'what you want/need' and 'behind/under your question' are not asking frames (7 replay false positives); verbatimRun stays 6"
requirements-completed: [HERO-03]
metrics:
  duration: ~40min (split across a usage-limit pause)
  completed: 2026-11-27
---

# Phase 07 Plan 03: Hero restatement guard fallback Summary

A guard that only removes text: if the hero challengeSummary still restates the query, the restating sentences are dropped (or the whole field is removed). It runs on both routes, after fast-hero substitution on the stream route, with rawResponse re-rendered so the grader sees what the user sees. It can be turned off with `HERO_RESTATEMENT_GUARD_ENABLED=false` or `OUTPUT_GUARD_ENABLED=false`. A free replay over all saved answers was reviewed, and 0 false positives remain.

## Tasks

| Task | Name | Commits | Files |
|---|---|---|---|
| 1 | guardHeroRestatement rule (TDD) | fb80828 (RED), d81386e (GREEN) | src/lib/output-guard.ts, eval/output-guard.test.ts |
| 2 | Wire into both routes behind both switches (TDD) | 0f6baaa (RED), f222c5b (GREEN) | src/lib/orchestrator.ts, eval/hero-restatement-guard.test.ts |
| 3 | Free replay, review, 0 FP | c365d7c (detector fix), cf21002 (replay) | eval/hero-guard-replay.ts, src/lib/hero-restatement.ts, eval/hero-restatement.test.ts, 07-HERO-GUARD-REPLAY.*, 07-HERO-REPLAY.* |

## Replay (final, detector v2)

- 946 heroes across all saved runs; 448 answers changed; 450 changes: 341 drop_field (summary removed, hero shows title + subtitle), 109 drop_sentence (summary shortened)
- Reference runs: 2026-11-20T15-12-31 16/50 changed (2 removed, 14 shortened); 2026-11-25T14-30-56 50/50 (45 removed, 5 shortened); 2026-11-26T05-24-15 50/50 (48 removed, 2 shortened)
- Reviewed 176 changes (all 109 drop_sentence, all 66 in the two reference runs, first 20 of 2026-11-26T05-24-15): 176 restates, 0 false positives
- First pass (v1 detector) had 7 distinct false-positive sentences (10 change_ids), all reframes: "You can't match their scale / out-spend a chain...", "...not what you want to say", "...depends on what you need built" (x2), "The capability behind your question is...". Fixed by narrowing three regexes, with regression tests added

## Verification

- `npx tsx --test eval/output-guard.test.ts`: 26/26; `eval/hero-restatement-guard.test.ts`: 5/5; `eval/hero-restatement.test.ts`: 15/15
- `npm run -s eval:test`: 343/343; `npm run -s type-check`: clean
- `grep -c "applyHeroRestatementGuard(result, userQuery)" src/lib/orchestrator.ts` = 2; `process.env` count in output-guard.ts = 1
- 07-01 replay re-run with v2: 2026-11-26T05-24-15 still 50/50 seen restates (signals 40/49/18 unchanged), baseline still 16/50, 2026-11-25T14-30-56 still 50/50. Five older runs dropped by 1–2 each (the removed false positives)
- eval/results untouched: eval/results is git-ignored; the only file with a recent mtime is 2026-11-26T05-24-15/compare.md at 15:10, before this plan's first commit (15:15), from 07-01's documented restore. The scratchpad marker went missing across the pause, so I checked this by mtime instead
- No network, DB or model calls; $0 spent; not pushed

## Deviations from Plan

**1. [Rule 1 - Bug] Detector false positives found in review (planned fix path)**
- **Found during:** Task 3
- **Issue:** 7 distinct dropped sentences were reframes, not restatements
- **Fix:** HERO_RESTATEMENT_VERSION 2: removed "can" from the you-opener verbs; `(?<!what )you want/need`; `(?<!behind|beneath|underneath|under )your question`. 3 regression tests. 07-HERO-REPLAY.md/.json regenerated (header says v2; reference-run numbers unchanged)
- **Commit:** c365d7c

**2. Scope note:** the orchestrate() (JSON route) wiring is covered by grep and type-check, not by a behavioural test. The module-level Anthropic client cannot be injected, and the existing tests only inject into the stream route.

**3. Replay script:** besides writing the .json, it regenerates the totals table inside `<!-- TOTALS -->` markers in the .md, so the table cannot drift from the data.

## Known quality notes (not false positives)

- Some dropped "You need / You're looking" sentences carry a light reframe. In 2026-11-23T19-49-22/p2-q08 the summary that remains is only "Those are two different jobs."
- Recall gap: some kept sentences still restate the query with no signal ("Your researchers are a tough audience.", "You own four restaurants...", "You asked about..."). The guard limits the restatement rate; it does not bring it to zero.
- UX: on the stream route a restating summary is visible for a few seconds until `final` removes it

## Known Stubs

None.

## Self-Check: PASSED
