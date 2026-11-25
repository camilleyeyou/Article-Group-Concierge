---
phase: 06-proof
plan: 02
subsystem: eval-harness
tags: [eval, held-out, labels, proof]
requires: ["06-01"]
provides:
  - "75-query eval/queries.json (original 50 + 25 held-out, h-ids)"
  - "06-CATALOGUE.md DB snapshot and scripts/catalogue-snapshot.ts"
  - "HELD_OUT_SHA256 freeze + heldOutDigest in eval/labels.ts"
affects: [06-07]
key-files:
  created: [scripts/catalogue-snapshot.ts, .planning/phases/06-proof/06-CATALOGUE.md, .planning/phases/06-proof/06-HELDOUT-LABELS.md]
  modified: [eval/queries.json, eval/labels.ts, eval/heldout.test.ts, eval/concierge-config.test.ts]
decisions:
  - "User approved all 25 draft labels without edits (2026-11-24, D-603); set frozen by sha256"
metrics:
  duration: n/a
  completed: 2026-11-24
requirements: [PROOF-01]
---

# Phase 6 Plan 02: Held-out queries and frozen labels Summary

25 fresh held-out queries (12 well_formed, 5 vague, 3 off_topic, 3 invention_bait, 2 multi_part; 5 per persona) with evidence-backed labels drawn from a DB catalogue snapshot, user-approved and frozen by hash.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 | 01bb22e | catalogue snapshot, 25 queries, approval sheet |
| 1 (fix) | 673aadb | keyword-trigger snapshot test limited to original 50 |
| 2 | (checkpoint) | user replied "Approved", recorded in 06-HELDOUT-LABELS.md |
| 3 | 1724af5 | HELD_OUT_SHA256, heldOutDigest, digest test |

## Verification

75 queries, 25 held_out; original 50, indexed_documents, generated_at and model identical to the prior HEAD. `npx tsx --test eval/*.test.ts`: 243 pass, 0 fail. `tsc --noEmit` clean. No model, retrieval or paid call touched held-out queries. 18 distinct expected slugs.

## Deviations from Plan

**[Rule 3 - Blocking]** `eval/concierge-config.test.ts` snapshots which queries trigger pricing/timeline keywords and failed once held-out queries (p2-h05, p4-h04, p4-h05) were added. It now filters out held-out entries (D-602). Commit 673aadb.

## Notes for later plans

- p4-h04 ("how much traffic") trips the pricing keyword, likely a false positive; it is held-out, so it is not to be tuned against.
- p4-h01/p4-h05 expect the Google for Education study whose video is currently unplayable; no label change if that is fixed.

## Known Stubs

None.

## Self-Check: PASSED
