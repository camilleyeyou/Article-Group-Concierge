---
phase: 01-eval-improvements
plan: 06
subsystem: eval
tags: [eval, second-grader, agreement, openrouter, readme]
requires:
  - phase: 01-eval-improvements (plan 05)
    provides: runPreflight, eval:batch, report comparison
provides:
  - selectSample, computeAgreement, quadraticWeightedKappa (eval/agreement.ts, 9 tests)
  - gradeSecond and eval:grade2 (non-Anthropic grader via OpenRouter, writes grades-second.json and agreement.json)
  - "Second grader agreement" report section and header line
  - eval:batch --second-grader flag
  - README rewritten for the whole new harness
affects: [01-07]
tech-stack:
  added: []
  patterns: [shared RUBRIC/buildGraderPrompt/GRADER_SCHEMA across graders, seeded stratified sampling]
key-files:
  created: [eval/agreement.ts, eval/agreement.test.ts, eval/grade-second.ts]
  modified: [eval/batch.ts, eval/report.ts, eval/README.md, package.json]
key-decisions:
  - "Second grader defaults to openai/gpt-5.6-sol (re-checked live on OpenRouter today: listed, $4/$20 per M, supports structured_outputs, response_format, reasoning); anthropic/* refused"
  - "Agreement score = share of response x criterion score pairs within 1 point of Opus; sample 15, 3 per query type, seed eval-06"
  - "eval:batch --second-grader grades the sample on run 1 only"
requirements-completed: [EVAL-06, EVAL-05, EVAL-07]
duration: 25min
completed: 2026-11-20
---

# Phase 1 Plan 06: Second Grader and Agreement Score Summary

**An optional GPT-5.6 grader reached through OpenRouter grades a seeded 15-response sample with the identical rubric, prompt and schema as Opus, and the report prints the agreement score with per-criterion detail.**

## Accomplishments
- `eval/agreement.ts`: stratified round-robin sample ordered by sha256(seed + id); quadratic weighted kappa (null when no expected disagreement); per-criterion exact, within-1, MAD, kappa; hallucination and any-claim flag agreement; list of pairs differing by 2 or more.
- `eval/grade-second.ts`: refuses `anthropic/*`, runs the credit preflight, requires v2 Opus grades, one retry on empty or unparseable JSON, resumes per model, writes `grades-second.json` and `agreement.json`.
- `eval/report.ts`: header bullet and `## Second grader agreement` section only when `agreement.json` exists (checked on a synthetic file in the scratchpad).
- `eval/README.md`: pipeline diagram, all commands, grader inputs, claim kinds, number normalisation, shared config, baselines, spread, agreement definition, configuration table, costs, troubleshooting.

## Task Commits
1. Task 1: `1bc05a1` (agreement stats and tests)
2. Task 2: `8d80917` (grade-second, batch flag, npm script)
3. Task 3: `14c1ea6` (report section, README)

## Verification
- `tsc --noEmit` clean; `eval:test` 48 pass, 0 fail.
- Smoke on a 2-record copy (p3-q04, p5-q01): Opus grades then second grader both worked with `strict` json_schema and `reasoning: high` accepted, no parameter removed. Output: "agreement 90% within ±1; exact 70%; QWK grounded 0.00 voice 0.67". Verify one-liner printed `OK 2 number`. Two responses only, so the numbers mean nothing statistically.
- `EVAL_SECOND_GRADER_MODEL=anthropic/claude-sonnet-5.5` printed "The second grader must be from another provider" and exited 1.
- Smoke dir `eval/results/0000-smoke2` deleted; frozen baseline hashes unchanged.
- README grep checks all >= 1.

## Deviations from Plan
None. (The plan's model ID was re-verified against the live OpenRouter model list before use, per the evidence rule.)

## Money Spent
Smoke test only: 2 Opus grading calls plus 2 second-grader calls, estimated about $0.15. Key balance read $45.49 before and $45.49 after (rounded; OpenRouter usage lags, so the measured delta is not precise). No generation, batch, regrade or full second-grader run.

## Known Stubs
None.

## Self-Check: PASSED
