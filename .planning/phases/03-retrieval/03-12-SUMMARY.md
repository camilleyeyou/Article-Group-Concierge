---
phase: 03-retrieval
plan: 12
subsystem: retrieval
tags: [recall, retrieval-cap, eval, gap-closure]
requires: [03-11]
provides:
  - "cap8 (maxCaseStudies 8, no reranker) as the production retrieval default"
  - "Gap eval delta with RETR-05 guard result"
affects: [src/lib/concierge-config.ts, eval/concierge-config.test.ts]
key-files:
  modified:
    - src/lib/concierge-config.ts
    - eval/concierge-config.test.ts
    - .planning/REQUIREMENTS.md
  created:
    - .planning/phases/03-retrieval/03-GAP-EVAL-DELTA.md
key-decisions:
  - "Shipped cap8 per D-305 bake-off (winner, no reranker, no new latency or data processor)"
metrics:
  completed: 2026-11-22
  tasks: 3
---

# Phase 3 Plan 12: Ship cap8 and confirm with the eval Summary

Raised the case-study retrieval cap from 6 to 8 (the D-305 bake-off winner), lifting eval frozen recall from 43/52 to 47/52 with the teaser-padding guard intact.

## Task 1: checkpoint
Verdict line in 03-BAKEOFF.md: `BAKEOFF WINNER: cap8`. Auto-skipped: "winner cap8, eval approved by D-305".

## Task 2: ship cap8 (commit a76726f)
`maxCaseStudies` 6 -> 8 and the config lock test updated. `npm run eval:test` 81/81 pass, `tsc` clean. Offline gate on the shipped default: `GATE (D-303, frozen >= 47/52): PASS`, `hybrid_search_v2 (50/50)`, pass 1 and pass 2 both 47/52 frozen (47/49 corrected), identical.

## Task 3: eval (commit c157e81)
- Smoke `2026-11-22T13-40-39` (p5, 3 queries): all ok, hybrid_search_v2, usage present, harness v3. $0.07.
- Full `2026-11-22T13-42-12` (batch-2026-11-22T13-42-12): 50/50 ok and graded. $4.29. Credit $20.87 -> $16.04 (about $4.83 total including rounding).
- Recall 47/52 frozen (90%), 47/49 corrected (96%). Gained Google Workspace, CrowdStrike, ADP keynotes, Android; lost none.
- Guard (D-307): teasers_zero_expected_mean 1.45 (limit 1.70), exactly-4-teaser responses 1/50 (limit 3). Pass.
- Deltas vs Phase 3 final: grounded 4.60 (+0.06), fallback 4.94, voice 4.18, unsupported-claim responses 14 (0), hallucinations 0, latency median 19.0 s (+1.0 s).

GAP VERDICT: MET. RETR-06 marked complete.

## Deviations
- The run was interrupted by a usage limit while the full eval was in progress; on resume the full run had finished and been graded, so no paid work was repeated (exactly one smoke and one full run).
- Credit-based spend ($4.83) exceeds batch.json cost ($4.36) by the offline gate run and credit-read lag.
- Zero headroom: cap8 sits exactly on the 47/52 gate.

## Self-Check: PASSED
Commits a76726f and c157e81 exist; 03-GAP-EVAL-DELTA.md present; dev server stopped; nothing pushed.
