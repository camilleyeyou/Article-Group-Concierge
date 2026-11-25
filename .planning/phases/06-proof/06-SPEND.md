# Phase 6 spend ledger

Approved cap: $28 (user, 2026-11-25; raised from $25, earlier from $22; user will top up ~$5 for margin)

Credit after top-up (preflight, 2026-11-25): $32.51 of $100.00 limit. The >= $24 criterion is met.

| Step | Date | Credit before | Credit after | Cost | Running total | Cap left |
|------|------|---------------|--------------|------|---------------|----------|
| phase6-fix subset run (21 queries, eval/results/2026-11-25T13-31-49, batch-2026-11-25T13-31-48) | 2026-11-25 | $32.51 | $30.61 | $1.90 | $1.90 | $20.10 |
| phase6-fix subset re-run after voice/adjacent-work prompt change (21 queries, eval/results/2026-11-25T13-45-56) | 2026-11-25 | $30.12 | $28.03 | $2.09 | $3.99 | $21.01 |
| full original-50 run after voice revert + deliverables-not-aims tightening (eval/results/2026-11-25T13-58-24, code 34ebea0) | 2026-11-25 | $27.74 | $22.65 | $5.09 | $9.08 | $18.92 (cap $28) |
| full original-50 confirm run, prompt restored to 7600919^ (eval/results/2026-11-25T14-30-56, code 844ae18) | 2026-11-25 | $22.51 | $17.70 | $4.81 | $13.89 | all remaining credit ($17.70) |

Cap update (user, 2026-11-25): no further top-ups; the cap is all remaining credit. Credit after the last run: $17.70 of $100. Credit read $22.65 after the previous full-50 and $22.51 at preflight before this run; the $0.14 difference is not attributable to a logged step.

Plan 06-09 (2026-11-25): dry timing batch and counted timing batches skipped by user decision (budget). Cost $0.00. Only remaining planned spend: ~$0.70 demo verification in plan 06-11.

| Step | Date | Credit before | Credit after | Cost | Running total | Cap left |
|------|------|---------------|--------------|------|---------------|----------|
| plan 06-11: warm-up + demo round 1 (5 queries, production) | 2026-11-25 | $17.32 | $17.05 | $0.27 | $14.16 | $17.05 (cap is all remaining credit) |
| plan 06-11: demo rounds 2 and 3 (10 requests, production) | 2026-11-25 | $17.05 | $16.39 | $0.66 | $14.82 | $16.39 |

Notes (06-11): credit read $17.32 at the first preflight, $0.38 below the $17.70 after 06-07; that difference is not attributable to a logged step (it matches the earlier unlogged $0.14 drift pattern, probably production requests or credit lag). It is not counted in the running total above. The demo spend was $0.93 for 16 production requests (about $0.058 each), above the ~$0.70 plan estimate and below the $1.50 stop line. The preflight command exits on the missing local dev server after printing the credit line, so credit was read before round 1 and after round 3, not before each round. A reserve verification (3 queries x 3 rounds, ~$0.52) would take the demo total to about $1.45, so it needs the user's OK.

| plan 06-11 reserves: demo rounds 1-3 for p1-q06, p2-q06, p3-q02 (9 requests, production; the round 2 retry after a DNS failure sent no request) | 2026-11-25 | $16.39 | $15.77 | $0.62 | $15.44 | $15.77 |

Demo verification total (06-11): $0.93 + $0.62 = $1.55 for 25 requests (about $0.062 each). That is $0.05 above the user's $1.50 stop line. The reserve estimate (~$0.52, total ~$1.45) used the earlier per-request cost; the actual was $0.069 per request, and credit is only readable after the run. No further spend is planned. Final credit $15.77 of $100.

| plan 06-12: live stream smoke ("insurance experience?", production, SMOKE OK, 18.0 s to final) | 2026-11-25 | $15.77 | not read | ~$0.07 (estimate) | ~$15.51 | ~$15.70 |

Phase 6 total including the closing smoke: about $15.51 (logged $15.44 plus the estimated $0.07 smoke). Credit left is about $15.70 of $100 (not re-read after the smoke).
