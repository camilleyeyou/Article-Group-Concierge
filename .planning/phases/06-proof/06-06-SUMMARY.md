---
phase: 06-proof
plan: 06
subsystem: retrieval
tags: [recall, intent-keywords, offline-gate]
requires: ["06-02", "06-05"]
provides:
  - "bank and insurer mapped to finance intent; offline recall 48/52 frozen on both passes"
affects: [06-07, 06-12]
key-files:
  modified: [src/lib/intent-keywords.ts, eval/intent-keywords.test.ts, .planning/phases/06-proof/06-FIX-NOTES.md]
decisions:
  - "recall_decision option-a: proceed at 48/52 (92%); 49/52 criterion missed, accepted by the user"
metrics:
  duration: n/a
  completed: 2026-11-25
requirements: [PROOF-01]
---

# Phase 6 Plan 06: Retrieval-side recall fix Summary

Added `bank` and `insurer` to the finance intent keywords, taking offline frozen recall from 47/52 to 48/52 on both passes with no SQL, no reranker and the cap still at 8.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | 06bf4aa | Diagnosis, keyword change, test, Recall section in 06-FIX-NOTES.md |
| 2 | (this docs commit) | Decision checkpoint: user chose option-a; recorded in notes |

## Results

- Before 47/52 (90%), after 48/52 (92%); corrected 48/49. Passes identical, all queries on hybrid_search_v2. Zero-expected mean case studies 8.00 before and after (no extra padding).
- p2-q05 gains J.P. Morgan (rank 11 against cap 8). p2-q03 AIG has no general lever: no intent fires and the only hook would be mapping process words to finance, rejected as label-fitting.
- Remaining misses: 3 disputed labels (Renew Home, Chorus x2) and p2-q03.
- `recall_gate: FAIL` against the plan's 49/52; user accepted 48/52 (option-a).

## Deviations from Plan

None in execution. The plan's 49/52 criterion was not met and was accepted by the user at the checkpoint.

## Disclosures for 06-12

The `bank`/`insurer` keywords were chosen without consulting held-out queries, but may affect held-out queries that mention banks or insurers.

## Verification

intent-keywords tests 11/11, `tsc --noEmit` clean, check-intent-slugs 14/14 and 16/16, no change under `supabase/` or `eval/queries.json`. No paid calls.

## Known Stubs

None.

## Self-Check: PASSED
