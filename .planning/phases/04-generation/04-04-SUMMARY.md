---
phase: 04-generation
plan: 04
subsystem: eval-harness
tags: [eval, rubric-v4, metrics, strategy-lead, narrative, D-407, D-415, D-421]
requires: [04-01, 04-02]
provides:
  - src/lib/sentences.ts (splitSentences, countSentences)
  - harness v4 rubric (trigger-based Strategy Lead text, Larkspur example, presupposes_asserted_work)
  - new AutomatedChecks and RunMetrics fields, METRIC_DEFS rows, report section "Strategy Lead by trigger"
affects: [04-05 smoke runs, 04-07 verifier]
key-files:
  created: [src/lib/sentences.ts, eval/sentences.test.ts]
  modified: [eval/lib.ts, eval/rubric.ts, eval/grade.ts, eval/grade-second.ts, eval/rubric.test.ts, eval/metrics.ts, eval/report.ts, eval/metrics.test.ts]
key-decisions:
  - "Strategy Lead 'offered' is read from the narrative (response.explanation), not the raw response, so follow-up questions do not count"
  - "The trigger label invention_bait is shown to the grader via strategy_lead_triggers (D-415); the persona/expected/'type:' leak test still bans the rest"
metrics:
  duration: 25min
  completed: 2026-11-22
---

# Phase 4 Plan 04: Eval metrics and rubric v4 Summary

The eval now reports narrative sentence count (2-4 range), per-trigger Strategy Lead expected/offered, teaser tags not in the catalogue, video-query misses, pricing/timeline figures and a grader presupposition flag for invention bait; the rubric is harness v4 and no longer uses NeoBank as the invention marker.

## Commits
- c9c3071: shared sentence splitter and tests
- a844539: automated checks, rubric v4, grader flag
- 00344ab: metrics, report section, metrics tests

## Verification
- `npm run eval:test`: 120 pass, 0 fail
- `npx tsc --noEmit -p .` and `npm run lint`: clean
- No paid calls. `eval/results/2026-11-20T15-12-31` untouched (git status clean for eval/results).

## Pre-Phase-4 reference (free recompute from saved runs, current code)

| Metric | Gap run 2026-11-22T13-42-12 | Frozen 2026-11-20T15-12-31 |
|---|---|---|
| narrative in 2-4 sentences | 10/50 (median 5) | 17/50 (median 5) |
| Strategy Lead expected (any trigger) | 25 (offered 0) | 25 (offered 0) |
| by trigger expected/offered | no_context 0/0, fallback 21/0, pricing 3/0, timeline 6/0, invention_bait 5/0 | same |
| unprompted offers | 0 | 0 |
| teaser_tags_not_from_db | 0 | 0 (no catalogue stored) |
| video queries | 6 (video available 6, missing VideoPlayer 0) | same |
| pricing/timeline figures | 4 | 2 |
| invention_bait_presupposed | n/a (not graded under v4) | n/a |

timeline expected 6 and pricing expected 3, as the plan anticipated. Strategy Lead offered is 0 everywhere, so the 04-03 prompt change has the whole range to move.

## Deviations from Plan

**1. [Rule 1 - Bug] Test banned the label `invention_bait` in the grader prompt**
- **Found during:** Task 2
- **Issue:** the existing leak test failed once strategy_lead_triggers (which the plan requires the grader to see) printed `invention_bait`.
- **Fix:** removed `invention_bait` from that test's banned list with a comment; `## PERSONA`, `## EXPECTED`, expected notes and `type:` are still banned. Note this does tell the grader which queries are bait, as D-415 intends.
- **Commit:** a844539

**2. [Rule 1 - Bug] Duplicate figure matches**
- **Issue:** `$5k` matched both the money and the bare-`k` regex.
- **Fix:** negative lookbehind on the bare-`k` pattern.
- **Commit:** 00344ab

**3. Metrics loop skips non-ok records** (previously every row). Baseline runs had no failed records, so reference numbers are unchanged. The per-response table is the CSV (the markdown report has none), so `narrative_sentences` was added there.

## Notes
- eval/lib.ts keeps the `model_raw_response` line from 04-02.
- Requirements GEN-02..06 are listed in the plan frontmatter, but this plan delivers measurement only; none were marked complete (they stay open until the Phase 4 eval).
- Existing grades.json files have no `presupposes_asserted_work`, so `invention_bait_presupposed` is n/a until a v4 grading run.

## Known Stubs
None.

## Self-Check: PASSED
