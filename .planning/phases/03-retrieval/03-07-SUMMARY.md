---
phase: 03-retrieval
plan: 07
subsystem: retrieval
tags: [recall-gate, hybrid_search_v2, verification, D-303]
requires: ["03-01", "03-04", "03-06"]
provides:
  - "D-303 offline recall gate verdict: FAIL, so Plan 03-08 (reranker) runs"
affects: [03-08]
key-files:
  created: [.planning/phases/03-retrieval/03-07-SUMMARY.md]
  modified: []
decisions:
  - "Gate FAIL at 43/52 frozen; the reranker plan (03-08) runs. No weights, caps or intentBoost were tuned."
metrics:
  duration: ~10 min
  completed: 2026-11-22
---

# Phase 3 Plan 7: Integration gate and D-303 offline recall gate Summary

Every free check passes on the combined build, but offline recall through the real retrieveContext is 43/52 frozen, below the 47/52 gate.

GATE: FAIL (43/52)

Decision: Plan 03-08 (reranker) runs. RETR-05 and RETR-06 are not marked complete.

## Recall

- Frozen recall: 43/52 (83%), run twice, identical (`identical to pass 1: yes`), on `hybrid_search_v2 (50/50)`.
- Corrected recall (D-301): 43/49 (88%).
- Baseline was 39/52 (75%). Net +4 pairs. Unchanged from the 03-04 run: 03-06 touched formatContext and the prompt, not retrieval.

### Versus baseline (run 2026-11-21T21-15-13)

Gained (7 pairs): p1-q04 (Salesforce Slack), p1-q06 (Salt), p1-q07 (Salt), p1-q10 (CrowdStrike), p2-q02 (ADP keynotes), p2-q07 (ADP keynotes), p3-q05 (Salesforce Slack).

Lost (3 pairs, hit before and now missed): p1-q03 (Google Workspace positioning), p1-q07 (CrowdStrike), p2-q03 (AIG). These match the trade-off research predicted for v2 (hits the old intent filter / AND keyword got by chance or by filter).

### Remaining misses (9 pairs, 7 queries)

| Query | Missing | Class |
|---|---|---|
| p1-q02 | Renew Home | Disputed label (energy company, no security); unchanged from baseline |
| p1-q03 | Google Workspace: Positioning a New Brand | Regression vs baseline; lost intent-filter hit, not yet classified in research |
| p1-q05 | Chorus (Alphabet X) | Disputed label (text has no security); unchanged |
| p1-q07 | CrowdStrike | Regression vs baseline; Chrome family and Salt take slots, 6-slot cap |
| p1-q07 | Chorus | Disputed label; unchanged |
| p2-q03 | AIG | Regression vs baseline; was a hit via the finance filter, now 6-slot cap |
| p2-q05 | J.P. Morgan | Weak semantic match (rank ~14); reranker class |
| p2-q05 | ADP keynotes | Weak semantic and keyword; reranker class, label arguable |
| p3-q10 | Android virtual event | Multi-part query, semantic diluted (rank ~20); reranker class |

Three of the nine are disputed labels (Renew Home, Chorus x2), so 6 are real misses. The three regressions are classed by inference from the research trade-off table, not by per-query rank traces. Case-study count distribution: {6: 50} (min(available, 6) holds for all 50 queries, so RETR-03 no-cutoff is verified). Zero-expected queries: n=20, mean case studies 6.00.

## Free checks

- `npm run eval:preflight`: Supabase ok; OpenRouter ok, $25.62 of $50.00 left (before the cache check).
- `npm run eval:test`: 74 tests, 74 pass.
- `npx tsc --noEmit -p .`: exit 0.
- `check-intent-slugs`: capabilities 14/14, industries 16/16 exist.
- `check-hybrid-v2` (run twice): 8/8 checks passed both times; CrowdStrike position 3 for p1-q06 (<= 6).
- `check-prompt-cache`: PASS. Call 1 write 10573, read 0; call 2 write 0, read 10573 (>= 512).

## Spend

check-prompt-cache cost $0.044654 + $0.005679 = $0.0503. That is above the plan's ~$0.03 estimate because the catalogue block is 10.5k tokens at the cache-write rate. Everything else was free. No eval run, no DB writes.

## Deviations from Plan

None. No code changes. Preflight printed a localhost:3000 unreachable message; the plan says not to start the dev server, so it was ignored (Supabase and OpenRouter checks passed).

## Known Stubs

None.

## Self-Check: PASSED
