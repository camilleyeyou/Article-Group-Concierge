---
phase: 04-generation
plan: 01
subsystem: generation
tags: [config, post-processing, teaser-tags, GEN-03]
requires: []
provides:
  - Phase 4 config contract in src/lib/concierge-config.ts (triggers, keywords, narrative limits, FICTIONAL_EXAMPLE, verifier flag, honesty flag)
  - Catalogue.tagsBySlug
  - src/lib/layout-postprocess.ts (applyServerTeaserTags, renderRawResponse, postProcessOutput)
affects: [04-03 prompt, 04-04 eval, 04-07 verifier]
key-files:
  created: [src/lib/layout-postprocess.ts, eval/layout-postprocess.test.ts]
  modified: [src/lib/concierge-config.ts, src/lib/catalogue.ts, src/lib/orchestrator.ts, src/app/api/chat/route.ts, src/types/index.ts, eval/concierge-config.test.ts, eval/catalogue.test.ts, eval/rubric.test.ts]
key-decisions:
  - "Teaser capabilities/industries are overwritten server-side from DB links; unknown slug or failed catalogue load yields no tag props"
  - "Verifier flag defaults OFF (VERIFIER_ENABLED env override)"
metrics:
  duration: 20min
  completed: 2026-11-22
---

# Phase 4 Plan 01: Config contract and server-side teaser tags Summary

Shared config now holds every Phase 4 rule value, and /api/chat overwrites teaser capabilities/industries from document_capabilities/document_industries so the model cannot invent tags.

## Commits
- 065bf7e: extend shared config with Phase 4 contract
- 2d93922: catalogue tag map and pure layout post-processing
- 90c4a4a: wire post-processing into orchestrate() and debug payload

## Verification
- `npm run eval:test`: 93 pass, 0 fail
- `npx tsc --noEmit -p .` and `npm run lint`: clean
- Free live smoke (catalogue from Supabase): teaser for salt-security-defending-market-territory with model tag "Invented" came back with Brand Strategy / Messaging & Positioning / Research & Insights and Cybersecurity, identical to its catalogue line. No paid calls made.

## Deviations from Plan

**1. [Rule 1 - Bug] Updated eval/rubric.test.ts**
- **Found during:** Task 1
- **Issue:** Test 'rubric renders only the enabled Strategy Lead triggers' asserted pricing is NOT an enabled trigger, contradicting D-411.
- **Fix:** Assert every enabled trigger's description appears in the rubric.
- **Commit:** 065bf7e

## Notes
- requirements mark-complete was run for GEN-03, GEN-06, GEN-07 as listed in plan frontmatter, but GEN-06 (prompt behaviour) and GEN-07 (verifier) only have their config contract here; later plans deliver the behaviour. Consider un-ticking them until 04-03/04-07.
- orchestrateStream (unused) does not apply post-processing; Phase 5 comment added.

## Known Stubs
None.

## Self-Check: PASSED
