---
phase: 07-fast-hero-stops-restating-the-query
plan: 02
subsystem: generation
tags: [hero-pass, prompt, cache-key, HERO-02]
requires:
  - phase: 07-01
    provides: detectHeroRestatement (used to check the v2 example)
provides:
  - HERO_PASS_INSTRUCTION_V1 (byte-identical to be92924) and HERO_PASS_INSTRUCTION_V2
  - heroPassPromptVersion() (HERO_PASS_PROMPT_VERSION env, default 2)
  - heroPassInstruction(version = heroPassPromptVersion())
  - orchestratorCacheKey field heroPrompt
affects: [07-03, 07-04, 07-05]
tech-stack:
  added: []
  patterns: [versioned prompt constant + env switch, cache key carries prompt version]
key-files:
  created: []
  modified:
    - src/lib/concierge-config.ts
    - src/lib/orchestrator.ts
    - eval/concierge-config.test.ts
    - eval/hero-pass.test.ts
key-decisions:
  - "Fast hero pass defaults to instruction v2 (frame the problem, no restatement, <= 25 words, no 'you'); HERO_PASS_PROMPT_VERSION=1 restores v1 byte-for-byte"
  - "v2 keeps every v1 honesty clause and adds no new honesty rule; the user-attributed-work clause now covers the whole HeroBlock (v1 allowed it in challengeSummary as 'You're asking about...')"
requirements-completed: [HERO-02]
metrics:
  duration: ~10min
  completed: 2026-11-26
---

# Phase 07 Plan 02: Fast hero instruction v2 Summary

The fast hero pass now sends a v2 instruction that asks for the problem behind the question (one sentence, at most 25 words, no "you" opener, no restating) instead of v1's "states the user's challenge in their own terms" / "You're asking about...". v1 is kept byte-for-byte behind `HERO_PASS_PROMPT_VERSION=1`, and the orchestrator cache key carries the version so cached answers never mix the two.

## Tasks

| Task | Name | Commits | Files |
|---|---|---|---|
| 1 | v1/v2 instructions + HERO_PASS_PROMPT_VERSION switch (TDD) | 82097b7 (RED), edeec3e (GREEN) | src/lib/concierge-config.ts, eval/concierge-config.test.ts |
| 2 | Cache key follows version; hero-pass version tests | 4fe78b1 | src/lib/orchestrator.ts, eval/hero-pass.test.ts |

## v2 key lines

- "The user has just written their question, so the HeroBlock must not repeat it back. It names the problem behind the question the way a senior strategist would frame it, as a headline about THEM."
- "challengeSummary: one sentence of at most 25 words that names the tension, stakes or decision underneath the question. Do not restate or paraphrase the question, and do not address the user as "you" ..."
- Example (the system prompt's fictional fintech hero): "Looking credible enough to hold people's money while still feeling new."
- Title/subtitle clause and "Do not add facts" clause unchanged from v1; the user-attributed clause now reads "Keep it out of the HeroBlock entirely: no client, brand or project name the user attributes to us, in any field."

## Verification

- `npx tsx --test eval/concierge-config.test.ts`: 25/25 (v1 byte-identity vs a literal extracted from `git show be92924`, v2 content, env switch incl. "3"/"abc" ignored, no-arg follows env)
- `detectHeroRestatement("We're a fintech startup looking to rebrand", <v2 example>)`: `restates: false` (test asserts it)
- `npm run -s eval:test`: 328/328 pass; `npm run -s type-check`: clean
- `git diff --quiet be92924 -- eval/rubric.ts`: unchanged; orchestrator diff touches no SYSTEM_PROMPT line; existing SYSTEM_PROMPT snapshot tests pass unedited
- No network, DB or model calls; $0 spent

## Deviations from Plan

- [Rule 2 - Coverage] Added a direct test that `orchestratorCacheKey` differs by `HERO_PASS_PROMPT_VERSION` (heroPrompt 1 vs 2), since "cache key changes with the version" is a must-have truth and was otherwise untested. Commit 4fe78b1.
- The detector-on-example test passed already in RED (it tests the 07-01 detector, not new code); the other 4 new tests failed as expected.

## Known Stubs

None. The behavioural effect of v2 is unmeasured until the paid runs in 07-04/07-05 (HERO-04).

## Self-Check: PASSED
