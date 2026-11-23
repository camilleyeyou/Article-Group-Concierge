---
phase: 04-generation
plan: 07
subsystem: generation
tags: [verifier, haiku, GEN-07, eval]
requires: [04-01, 04-04, 04-06]
provides:
  - src/lib/verifier.ts (collectSpans, buildVerifierPrompt, parseVerifierResponse, applyRewrites, verifyOutput)
  - Verifier wired into orchestrate() behind CONCIERGE_CONFIG.verifier.enabled (default false)
  - npm run eval:verify-saved (offline verification of a saved run)
affects: [04-08 evaluation, Phase 5 first-content path]
key-files:
  created: [src/lib/verifier.ts, eval/verifier.test.ts, eval/verify-saved.ts]
  modified: [src/lib/rerank.ts, src/types/index.ts, src/lib/orchestrator.ts, src/app/api/chat/route.ts, eval/lib.ts, package.json]
key-decisions:
  - "Verifier fails open: any throw, timeout or unparseable output keeps the unverified response and logs it"
  - "Rewrites replace spans, never delete them; narrative sentences not found verbatim in the explanation are left unchanged"
  - "Verifier report is debug-only in /api/chat; public output unchanged"
metrics:
  duration: 25min
  completed: 2026-11-22
---

# Phase 4 Plan 07: Haiku claim-check verifier Summary

Gate line was `GEN-07 GATE: EVALUATE VERIFIER (unsupported-claim responses 6/50 >= 5)`, so the verifier was built. It is off by default; production behaviour is unchanged. No paid calls were made.

## Commits
- 299abf0: verifier module, types, exported Haiku prices, 7 unit tests
- 8000a18: orchestrator wiring behind `verifierEnabled()`, debug-only route field, `eval:verify-saved`

## Verification
- `npm run eval:test`: 128 pass, 0 fail (stubbed clients only)
- `npx tsc --noEmit -p .` and `npm run lint`: clean
- `enabled: false, model: 'claude-haiku-5-5'` still in src/lib/concierge-config.ts

## Command for 04-08
`npm run eval:verify-saved -- --of eval/results/2026-11-22T22-48-20`
(then `npm run eval:compare -- --dir eval/results/<ts>-verified --against eval/results/2026-11-22T22-48-20`). Needs user approval: Haiku calls plus Opus re-grades of rewritten responses, about $3, preflight minimum credit $4 (EVAL_MIN_CREDIT_USD).

## Deviations from Plan
None - plan executed as written. Small additions: merged `verifierEnabled` into the existing concierge-config import in orchestrator.ts; `parseVerifierResponse` also drops duplicate ids.

## Notes
- GEN-07 left open in REQUIREMENTS.md; 04-08 closes it.
- orchestrateStream still has no post-processing or verifier (Phase 5 comment).

## Known Stubs
None.

## Self-Check: PASSED
