---
phase: 02-content-and-data
plan: 04
subsystem: retrieval
tags: [intent-keywords, taxonomy, retrieval]
requires: [02-03]
provides:
  - src/lib/intent-keywords.ts (pure maps, detectQueryIntent, allIntentSlugs, INDUSTRY_GROUPS)
  - scripts/check-intent-slugs.ts (read-only DB proof)
  - eval/intent-keywords.test.ts
affects: [02-06 eval, 03 RETR-02]
key-files:
  created: [src/lib/intent-keywords.ts, scripts/check-intent-slugs.ts, eval/intent-keywords.test.ts]
  modified: [src/lib/supabase.ts]
key-decisions:
  - "technology query also filters on its 5 sub-sector slugs via INDUSTRY_GROUPS"
  - "No executive-storytelling key: that slug was not created in 02-03"
  - "Substring matching unchanged; new keywords all >= 4 chars or contain a space"
requirements-completed: [DATA-04]
completed: 2026-11-21
---

# Phase 2 Plan 04: Intent keyword remap Summary

The keyword maps now live in a pure module and reference only slugs that exist in the DB. `supabase.ts` imports `detectQueryIntent`; nothing else in retrieval changed. No DB writes.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Maps + tests | fc8a854 | 7 new tests; `npm run eval:test` 55/55 pass; `tsc --noEmit` clean |
| 2 DB check script | a7e5205 | `capabilities: 14/14 exist`, `industries: 16/16 exist`, exit 0 |

## Remaps

Capabilities: social-media to social-strategy, digital-marketing to growth-marketing, experiential to events-keynotes (plus keynote, conference, virtual event), web-development to experience-design, content-strategy kept (messaging/narrative moved to messaging-positioning). New keys: go-to-market, sales-enablement, thought-leadership, naming, research-insights.
Industries: consumer split into consumer-goods and retail, entertainment to media-entertainment, nonprofit to non-profit. New keys: enterprise-software, consumer-tech, artificial-intelligence, cloud-infrastructure, cybersecurity, energy. real-estate and education kept (slugs exist).

## Known false-filter risk until RETR-02

Broad keywords such as 'executive' (not used), 'research', 'insights', 'security', 'mobile', 'productivity', 'cloud', 'threat', 'generative' and legacy short ones ('ai', 'app', 'web', 'ui', 'ux', 'experience', 'media', 'health') can trigger filters on queries that are not about that capability/industry, until Phase 3 adds whole-word matching or removes the filter. Also, 'consumer tech' matches both consumer-tech and consumer-goods ('consumer'); 'tech' matches 'technology' inside many words.

## Deviations

None.

## Self-Check: PASSED
