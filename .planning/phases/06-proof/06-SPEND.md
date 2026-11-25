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
