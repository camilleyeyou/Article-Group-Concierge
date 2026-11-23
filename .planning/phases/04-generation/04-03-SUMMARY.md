---
phase: 04-generation
plan: 03
subsystem: generation
tags: [prompt, honesty, narrative, strategy-lead, video, GEN-01, GEN-02, GEN-04, GEN-05, GEN-06]
requires: [04-01]
provides:
  - Rewritten SYSTEM_PROMPT with HONESTY RULES, config-rendered narrative/Strategy Lead/pricing rules
  - Fictional Larkspur Bank worked example (replaces NeoBank +340%)
  - userTurn() shared closing user message with config-driven sentence range
  - eval/prompt.test.ts prompt locks
affects: [04-04 rubric, 04-05 smoke run]
key-files:
  created: [eval/prompt.test.ts]
  modified: [src/lib/orchestrator.ts]
key-decisions:
  - "Teaser props in the prompt no longer include capabilities/industries; server fills them (GEN-03)"
  - "Removed 'we can help you because we've done this before' framing, which invited overclaiming"
metrics:
  duration: 15min
  completed: 2026-11-22
---

# Phase 4 Plan 03: Honesty and voice prompt rewrite Summary

The system prompt now teaches deliverables-not-aims, no inferred facts, no flat "yes we can", no confirmation of invention bait, a 2-4 sentence "why it fits" narrative and a config-driven Strategy Lead offer, with a fictional Larkspur Bank example that models all of it.

## Commits
- 2311f1f: rewrite system prompt (registry, output protocol, HONESTY RULES, tone, STRATEGY LEAD, example, context guidance, userTurn)
- 2c10243: prompt lock tests

## Verification
- `npm run eval:test`: 99 pass, 0 fail (4 new prompt tests)
- `npx tsc --noEmit -p .` and `npm run lint`: clean
- No paid calls made.

## Deviations from Plan
None in substance. The context-guidance and userTurn() edits (Task 2) were made in the same file pass as Task 1, so they landed in the Task 1 commit; Task 2's commit holds the tests.

## Requirements
GEN-01, GEN-02, GEN-04, GEN-05, GEN-06 are prompt behaviour measured by the eval, so they are left open in REQUIREMENTS.md until the Phase 4 smoke/full runs (04-05 onward) confirm them. GEN-03 was already complete; GEN-07 is untouched.

## Known Stubs
None.

## Self-Check: PASSED
