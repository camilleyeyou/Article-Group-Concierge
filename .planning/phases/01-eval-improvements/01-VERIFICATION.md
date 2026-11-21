---
phase: 01-eval-improvements
verified: 2026-11-21T09:00:00Z
status: passed
score: 5/5 success criteria verified (7/7 requirements)
---

# Phase 1: Eval improvements Verification Report

**Phase Goal:** The eval gives trustworthy, comparable numbers so every later phase can be judged against the baseline.
**Status:** passed. **Re-verification:** No.

## Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | "8M+" not flagged vs "over 8 million"; grader sees only query + context | VERIFIED | `eval/numbers.ts` plus `numbers.test.ts`; `eval/rubric.ts` header states the grader does not see persona/expected block/query type (only mention of "persona" is that negation); rubric.test checks this. metrics_not_in_context = 0 on the baseline recompute and both fresh runs. |
| 2 | Unsupported claims per response and total, split by kind | VERIFIED | Report section "Unsupported claims by kind"; kinds goal_as_result / capability_not_shown / generated_tags / other present in `grades.json`, `report.md` and 01-EVAL-DELTA (e.g. 17/11/69/16 on re-graded baseline). |
| 3 | N runs print mean and spread; ~15-response second-grader agreement vs Opus | VERIFIED | `eval/results/batch-2026-11-21T07-38-07/aggregate.md` (mean, SD, min-max, n=2); `eval/grade-second.ts` and `agreement.ts` (tested); 15 responses graded by `openai/gpt-5.6-sol` via OpenRouter, 97% within +/-1, 79% exact. |
| 4 | Strategy Lead expectation and component-count rule from one shared config used by app prompt and rubric | VERIFIED | `src/lib/concierge-config.ts` imported by `src/lib/orchestrator.ts`, `eval/rubric.ts`, `eval/lib.ts`; `concierge-config.test.ts` (byte-identical prompt) and rubric tests pass. |
| 5 | Eval rerun states route and model IDs and lists each metric's delta vs frozen baseline; baseline re-graded | VERIFIED | Run `2026-11-21T08-04-22/report.md` header shows Route openrouter, generation/embedding/judge IDs. `01-EVAL-DELTA.md` has per-metric deltas vs frozen and vs re-graded baseline (`2026-11-21T07-32-49-regrade`), a harness-effect table and a noise reading. Both fresh runs 50/50. |

**Score:** 5/5

## Behavioral Spot-Checks

| Check | Result |
|---|---|
| `npm run eval:test` | PASS, 48/48 |
| `npx tsc --noEmit` | PASS, no errors |
| `git diff 8c158c7~1 8c158c7 -- eval/results/2026-11-20T15-12-31` | empty, frozen baseline untouched |
| Paid API calls | none made |

## Requirements Coverage

| ID | Plans | Status |
|---|---|---|
| EVAL-01 | 01-02, 01-03, 01-07 | SATISFIED |
| EVAL-02 | 01-03, 01-04, 01-07 | SATISFIED |
| EVAL-03 | 01-03, 01-07 | SATISFIED |
| EVAL-04 | 01-01, 01-03, 01-07 | SATISFIED |
| EVAL-05 | 01-05, 01-06, 01-07 | SATISFIED |
| EVAL-06 | 01-06, 01-07 | SATISFIED |
| EVAL-07 | 01-01, 01-04, 01-05, 01-06, 01-07 | SATISFIED |

All 7 IDs appear in plan frontmatter and are marked Complete in REQUIREMENTS.md. No orphaned requirements.

## Caveats Evaluated

- **Commit trailer says Claude Sonnet 5.5 where 01-07-PLAN expected Opus:** attribution metadata only. It does not affect the code, the models used (generation Sonnet 5.5, judge Opus 5.5 unchanged), or any metric. User approved the push. Info, not a gap.
- **aggregate.md rounds count rows to integers:** a display limitation (e.g. hallucinations shows 1 for a true mean of 0.5). Exact values are recorded in 01-EVAL-DELTA.md with bracketed means, so no information is lost. Warning-level; optional later fix is to print one decimal for count rows in `eval/aggregate.ts`.

## Anti-Patterns

None blocking. No stubs found in the new eval modules; they are wired (tests, batch, report, regrade) and produced real results.

## Notes for later phases

- The harness v2 is stricter than v1 (grounded -0.52, unsupported claims 38 to 113 on identical responses), so later phases should compare against the re-graded baseline, not the frozen v1 numbers.
- Run-to-run noise (n=2): grounded about +/-0.15; hallucinations (0-1) and goal_as_result (12-21) are noisy. Recall (75%) and latency are stable.
- Second-grader cta/voice kappa is near zero only because scores barely vary; use exact/MAD for those.

## Human Verification Required

None.

_Verifier: Claude (gsd-verifier)_
