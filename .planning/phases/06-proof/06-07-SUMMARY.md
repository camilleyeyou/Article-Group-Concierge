---
phase: 06-proof
plan: 07
subsystem: proof
tags: [spend, fix-verification, prompt-revert]
requires: ["06-02", "06-03", "06-05", "06-06", "06-08"]
provides:
  - "06-SPEND.md ledger; phase6-fix subset; reverted prompt confirmed on the full original 50"
affects: [06-09, 06-12]
key-files:
  created: [.planning/phases/06-proof/06-SPEND.md]
  modified: [eval/subsets.ts, eval/subsets.test.ts, src/lib/concierge-config.ts, src/lib/orchestrator.ts, eval/prompt.test.ts, eval/concierge-config.test.ts, .planning/phases/06-proof/06-FIX-NOTES.md]
decisions:
  - "Fix-pass prompt rules (voiceRule, countClaimRule, adjacentWorkRule, deliverables-not-aims tightening) regressed voice and claims; prompt restored to 7600919^ (restore applied by the user)"
  - "go_decision: revert-prompt + full-50; cap is all remaining credit, no further top-ups"
  - "p1-q07 count claim is an open, accepted item for 06-12"
metrics:
  duration: n/a
  completed: 2026-11-25
requirements: [PROOF-01]
---

# Phase 6 Plan 07: Funding, fix verification and prompt revert Summary

The fix pass was tried on the 21-id phase6-fix subset (two runs, both FAIL), regressed a full-50 run, and was reverted. The restored prompt matches the 10-42-25 reference on voice (4.48) with 7 vs 4 unsupported-claim responses.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | a0579d1 | Top-up landed (credit $32.51), cap approved, 06-SPEND.md created, phase6-fix subset (21 original ids) added with test |
| 2 | 66a6f5a | Subset run 1: voice 4.14 vs 4.33, goal_as_result 1: FAIL |
| 2 (iterate) | 9033a46, d598e3d | Voice rewrite plus adjacent-work rule: voice 4.00, goal_as_result 3: FAIL |
| 3 | 34ebea0, 72df145 | Voice revert plus tightened deliverables rule, full-50: voice 4.22, 10 unsupported responses: FAIL |
| 3 (final) | 844ae18 | Prompt restored to 7600919^ (user applied the restore); full-50 confirm: voice 4.48, 7 unsupported responses; decision proceed |

## Results

See 06-FIX-NOTES.md ("Subset verification", "Prompt revert and confirm run") for the tables. Confirm run 2026-11-25T14-30-56: voice 4.48, grounded 4.76, hallucinations 0, errors 0, unsupported-claim responses 7/50, goal_as_result 1, capability_not_shown 0, recall 48/52 (92%), median latency 17.5 s. The D-513-style gates pass except unsupported-claim responses (7 vs <= 6).

Spend: $13.89 logged (subset $1.90, subset re-run $2.09, full-50 $5.09, confirm full-50 $4.81). Credit after: $17.70 of $100, no further top-ups.

## Deviations from Plan

- The plan specified one subset run. Three further paid runs (subset re-run, two full-50s) were made on user decisions (iterate, revert-voice + full-50, revert-prompt + full-50). Caps were raised from $20 to $22, $25, $28, then all remaining credit.
- A PreToolUse hook blocked the executor's `git checkout 7600919^` of the two prompt files. The user ran it themselves, and the executor then updated tests and committed.

## Open items for later plans

- The p1-q07 count claim ("our two security examples") is open and accepted. Disclose it in 06-12.
- Unsupported-claim responses are 7/50, one over the Phase 5 style bar of 6. The counted proof runs measure this properly.
- The counted runs (about $15.75 for 3 x 75), the second grader (about $1) and timing (about $2-3) exceed the $17.70 left if run at the earlier estimates. Plan the spend before starting.

## Self-Check: PASSED
