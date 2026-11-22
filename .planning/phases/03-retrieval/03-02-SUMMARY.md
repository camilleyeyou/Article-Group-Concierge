---
phase: 03-retrieval
plan: 02
subsystem: retrieval
tags: [config, intent-keywords, types, eval-labels]
requires:
  - phase: 03-retrieval
    provides: hybrid_search_v2 (03-01)
provides:
  - CONCIERGE_CONFIG.retrieval and teasers.policy, teaser prompt/rubric text derived from one setting
  - Whole-word detectQueryIntent, isAboutAG
  - Type additions for RRF ranks, usage, catalogue version
  - eval/labels.ts disputed labels (D-301)
affects: [03-03, 03-04, 03-05, 03-06]
key-files:
  created: [eval/labels.ts]
  modified: [src/lib/concierge-config.ts, src/types/index.ts, src/lib/intent-keywords.ts, eval/concierge-config.test.ts, eval/intent-keywords.test.ts]
key-decisions:
  - "Teaser policy defaults to relevant_only; the prompt and rubric wording both come from teaserPromptRule/teaserRubricText"
  - "eval/queries.json untouched; disputed labels live in eval/labels.ts"
requirements-completed: [RETR-02, RETR-05]
duration: ~15min
completed: 2026-11-22
---

# Phase 3 Plan 02: Retrieval contracts Summary

**One config for retrieval caps and the teaser policy, whole-word intent matching ("ai" no longer fires on "maintain"), RRF/usage type additions, and the 3 disputed eval labels defined once.**

## Exports (downstream plans depend on these)

`src/lib/concierge-config.ts`
- `type TeaserPolicy = 'all_retrieved' | 'relevant_only'`
- `interface RetrievalConfig { maxCaseStudies; maxArticles; matchCount; rrfK; intentBoost: number }`
- `CONCIERGE_CONFIG.retrieval = { maxCaseStudies: 6, maxArticles: 2, matchCount: 60, rrfK: 60, intentBoost: 0.003 }`
- `CONCIERGE_CONFIG.teasers = { policy: 'relevant_only' }`
- `teaserPromptRule(policy?: TeaserPolicy): string`
- `teaserRubricText(policy?: TeaserPolicy): string`
- `retrievalConfigKey(r?: RetrievalConfig): string`

`src/types/index.ts`
- `HybridSearchResult` gains optional `semantic_rank, keyword_rank, intent_match, rerank_score, pdf_url, hero_video_url`
- `RetrievedContext.searchFunction?: 'hybrid_search_v2' | 'hybrid_search_exact' | 'hybrid_search'`
- `interface GenerationUsage { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, cost }` (all `number | null`)
- `OrchestratorOutput.usage?: GenerationUsage | null`, `catalogueVersion?: string | null`

`src/lib/intent-keywords.ts`
- `keywordHit(lowerQuery: string, keyword: string): boolean`
- `detectQueryIntent(query: string): { capabilities: string[]; industries: string[] }` (now whole-word)
- `allIntentSlugs()` (unchanged)
- `AG_SELF_KEYWORDS: string[]`, `isAboutAG(query: string): boolean`
- Added keyword 'branded' under brand-strategy.

`eval/labels.ts`
- `DISPUTED_LABELS: ReadonlyArray<{ query_id; slug; reason }>` (3 entries), `isDisputed(queryId, slug): boolean`

## Existing tests changed
None. No existing intent test relied on substring matching; all passed unchanged.

## Verification
- `npm run eval:test`: 62 tests, 62 pass, 0 fail
- `npx tsx --test eval/intent-keywords.test.ts`: 10 pass, 0 fail
- `npx tsc --noEmit -p .`: clean
- `npx tsx scripts/check-intent-slugs.ts`: exit 0 (14/14 capabilities, 16/16 industries)
- `eval/queries.json` unchanged

## Task Commits
1. Task 1, config/types/labels: `bcb4fad`
2. Task 2, whole-word intent and isAboutAG: `420f25f`

## Deviations from Plan
**1. Plan inconsistency in the rubric test (no code deviation)**
- The behaviour spec says `teaserRubricText('relevant_only')` must not contain "for each", but the plan's own specified text is "a CaseStudyTeaser for each retrieved case study...". I kept the specified text verbatim and asserted instead that it does not contain the all_retrieved wording ("for retrieved case studies"). Flag for Plan 03-06 if it greps the rubric for "for each".

## Known Stubs
None.

## Self-Check: PASSED
