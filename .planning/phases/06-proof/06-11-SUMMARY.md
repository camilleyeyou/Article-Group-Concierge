---
phase: 06-proof
plan: 11
subsystem: eval
tags: [demo, production-verification, proof]
requires: [06-09]
provides:
  - eval/demo-verify.ts production demo runner and check-sheet builder
  - five check sheets with three independent production rounds each
affects: [06-12]
key-files:
  created:
    - eval/demo-verify.ts
    - .planning/phases/06-proof/06-DEMO-SHORTLIST.md
    - .planning/phases/06-proof/06-DEMO/ (README.md, five CHECK.md, 15 round JSON files)
  modified:
    - package.json
    - .planning/phases/06-proof/06-SPEND.md
requirements: [PROOF-03]
status: complete
duration: ~2.5h wall clock (waiting between rounds)
completed: 2026-11-25
---

# Phase 6 Plan 11: Owner demo queries Summary

**Five demo queries verified claim by claim on production under the user's relaxed rule (demo_rule: claims): p2-q06, p1-q06, p3-q02, p2-q04, p3-q09. PROOF-03 met under that rule; under the strict identical-teaser rule four of five pass.**

## What was done

- Built `eval/demo-verify.ts` (`npm run eval:demo-verify`): sends `{query}` only (no debug), full answers, records perf flags, builds CHECK.md sheets with an appendix of indexed text (select-only DB read).
- Shortlisted 10 candidates from the five full original-50 runs (0 unsupported claims in all five, grounded and voice >= 4). No held-out query was used. The user picked p2-q04, p1-q03, p3-q10, p3-q09, p5-q06 (reserves p1-q06, p3-q02, p2-q06).
- Ran the five on production at 15:07, 16:14 and 17:20 UTC (66 minutes apart). Perf flags were present: every request had rag_cache_hit 0 and orch_cached false.
- Checked every claim, tag, metric and video against the indexed text; HEAD-checked both videos (200 video/mp4, equal to the study's hero_video_url).

## Results

| id | verdict | reason |
|----|---------|--------|
| p2-q04 | VERIFIED | 0 unsupported, identical teaser and Strategy Lead offer in all rounds |
| p1-q03 | REPLACE | round 3 adds a Salt teaser; round 1 says "standalone startup" vs source "within Alphabet's X" |
| p3-q10 | REPLACE | round 3 drops the Android event teaser; no unsupported claim |
| p3-q09 | REPLACE | round 2 adds an UpShow teaser; no unsupported claim |
| p5-q06 | REPLACE | round 1 "only paying for what moves you forward" and an undelivered "closest work" promise; round 3 leaks "Nothing we retrieved speaks to pricing" |

The plan's rule is "unstable or any unsupported claim is replaced, never shown as-is". Three of the four replacements are for teaser-set instability alone; their claims were all supported. No reserve was swapped in: per the coordinator, the swap waits for a report to the user.

## Update after the user's rule change (demo_rule: claims, 2026-11-25)

- Regrade of the first five with no new calls: p2-q04 and p3-q09 pass; p1-q03 and p5-q06 fail as expected. **p3-q10 fails, contrary to the expected pass**: its round 3 narrative says "in what we pulled up", retrieval language leaking to the user.
- Three reserves run on production (3 rounds, 65+ minutes apart, perf flags rag_cache_hit 0 and orch_cached false): p1-q06, p2-q06, p3-q02 all pass under both rules.
- Final demo order: p2-q06, p1-q06, p3-q02, p2-q04, p3-q09 (see 06-DEMO/README.md).
- Disclosure for 06-12: the stability rule was relaxed after seeing results, by user decision; p3-q09 passes only under the relaxed rule. The set has no multi-part query and no pricing answer (D-611 range gap).
- Spend: total $1.55 for 25 requests, $0.05 above the $1.50 stop line (estimate was ~$1.45; credit is only readable afterwards). Final credit $15.77.

## Spend (picked five only, first pass)

16 production requests (1 warm-up, 15 demo): $17.32 to $16.39 = $0.93 (about $0.058 each; plan estimate $0.70; stop line $1.50). Logged in 06-SPEND.md. Verifying three reserves would add about $0.52 and bring the demo total to about $1.45, so it needs user approval.

## Deviations from Plan

- **[Rule 3] preflight cannot be the per-round credit gate.** `npm run eval:preflight` exits on the missing local dev server after printing the credit line. Credit was read before round 1 and after round 3 only (the scope change already capped spend).
- The plan's "three proof runs" evidence base did not exist (06-10 not run), so the shortlist uses five full original-50 runs.
- Credit read $17.32 at the first preflight, $0.38 below the $17.70 recorded after 06-07; not attributable to a logged step and not counted.

## Decisions Made

- Strict reading of D-612: teaser-set differences across rounds count as unstable, even when every extra teaser is supported by source text.
- "Standalone startup" (Chorus) and an implied pricing commitment count as unsupported claims.

## Known Stubs

None. Check sheets have all Claims rows filled.

## Next

06-12 reports PROOF-03 as met under demo_rule: claims, with the disclosures above.

## Self-Check: PASSED
