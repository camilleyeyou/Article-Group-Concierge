# Concierge quality improvement plan: working notes

Handoff file for the six-phase plan. Read this before resuming work. The original brief
from the user is summarised here, followed by verified findings and decisions.

## Goal

Get the concierge ready to show AG's owner, who is very detail-oriented. Most important
quality: **never misrepresent AG's work**. A wrong claim about a client engagement is
worse than a weak answer.

## Ground rules (from the user)

- One phase at a time. After each phase, rerun the eval, report which numbers moved
  against the baseline, and keep one commit (or small set) per phase.
- Verify hypotheses against code and data before acting.
- Check current docs before choosing external products, APIs or model names (rerankers,
  prompt caching via OpenRouter, embedding models). Don't rely on memory.
- **Do not change the generation model (Sonnet 5.5) or the eval model (Opus 5.5).**
- Ask before any destructive database change or full re-index.

## Baseline (frozen)

Run `eval/results/2026-11-20T15-12-31` (report.md, grades.csv), code at `6f16e6a` plus the
uncommitted eval harness and OpenRouter routing (to be committed in Phase 0).

grounded 4.44 · components 4.94 · fallback 4.50 · cta 4.36 · voice 3.92 · hallucinations
0/50 · unsupported claims 22/50 responses (38 claims) · expected case-study recall 39/52
(75%) · median latency 20.2 s (9.7–28.9 s).

## Decisions so far

- **Phase 0 approved:** commit the eval harness + OpenRouter routing as the reproducible baseline.
- **Production route:** the user added `OPENROUTER_API_KEY` to Vercel, so production now
  routes through OpenRouter, matching local and the eval. (It takes effect after the next
  Vercel deploy; confirm the deployment picked it up.)
- **Articles: embed them.** Chunk and embed all 50 articles so retrieval can return them
  (adds rows, deletes nothing).
- **Database changes:** add `hybrid_search_v2` alongside the existing function rather than
  replacing `hybrid_search`. Production shares the Supabase project, so replacing it in
  place would change the live site immediately.
- Fallback grading standard: honest reframing (recorded earlier). `would_strict_pass_fallback` kept.
- Open decisions (build as config, both assumed yes for now):
  1. The concierge may say plainly that AG hasn't done a kind of work, then show the closest work.
  2. Offer a Strategy Lead conversation on fallback, pricing and timeline queries.

## Verified findings (2026-11-20)

**Index shape**
- 43 case studies, each exactly **one chunk** (~850 chars). The whole searchable corpus is 43 chunks.
- 50 articles have **zero chunks**, so `hybrid_search` never returns them (0 retrieved across 50 baseline queries).
- `document_metrics` and `visual_assets` tables are empty, so MetricGrid and VisualAsset can only use numbers from chunk text.
- Every case study has capability and industry links (89 and 49 rows), but the taxonomy is
  coarse: 39/43 are "technology". Capability slugs: brand-strategy, content-marketing,
  creative-direction, digital-transformation, experience-design, growth-marketing,
  social-strategy, video-production, sales-enablement. Industry slugs: technology,
  healthcare, finance, retail, media-entertainment, b2b-services, consumer-goods, non-profit.

**Retrieval (live function = `supabase/migrations/003_pdf_first_ui_restructure.sql`, not `update_hybrid_search_thumbnail.sql`)**
- Keyword side: `ts_rank(to_tsvector(content||title||client), plainto_tsquery(query))`.
  - `plainto_tsquery` ANDs all terms, so short queries score 0 (e.g. "messaging house +
    marketecture?" fails because "house" isn't in the CrowdStrike chunk).
  - It scores only within the top `match_count*3` semantic results, so keyword search can
    never surface a document semantic search missed.
  - No title or client weighting.
- Scales mismatch: semantic 0.14–0.67, keyword 0–0.93 (mostly 0). 70/30 blend.
- 0.15 cutoff on combined score is effectively a semantic floor of 0.21 when keyword = 0.
  That's why "insurance experience?" kept 1 case study and "small budget ok?" kept 2.
- `detectQueryIntent` ([src/lib/supabase.ts](../src/lib/supabase.ts)):
  - It matches substrings, so "ai" fires inside words like "maintain" (8/50 queries
    falsely tagged technology).
  - 5 of 8 capability slugs and 5 of 8 industry slugs in its keyword maps don't exist in the DB.
  - Filtered results get a 10% boost.
- ADP "Creating Keynotes That Connect" is indexed and says "keynote" 3 times. It loses on
  meaning: the chunk opens with HR/payroll, and AWS, Chrome and AIG outrank it within the
  top-4 cap. Not a filter issue.

**Generation ([src/lib/orchestrator.ts](../src/lib/orchestrator.ts))**
- The prompt forbids admitting gaps ("NEVER say: We don't currently have X case studies",
  ~line 127) and tells the model to "reframe positively". 16/21 not-relevant responses
  admitted gaps anyway.
- The teaser has `capabilities`/`industries` props, but `formatContext` gives no per-case-study
  tags, so the model invents them. Fix: fill them server-side from the DB links.
- The Strategy Lead is only mentioned for the no-context case. 0/50 responses name it.
- Non-streaming `messages.create`; ~5.8k chars output per response. `orchestrateStream`
  exists but is unused.

**Eval**
- The runner sends only `{query, debug}`; the grader also sees the persona profile
  ([eval/grade.ts](grade.ts) `buildPrompt`). Decision proposed: remove persona from the grader.
- The rubric says "4-10 components"; the prompt only says "typical 4-8". The "4-component
  minimum" comes from the rubric.
- The CTA rubric says "follow-up questions and/or Strategy Lead", hence inconsistent penalties.
- `metrics_not_in_context` doesn't normalise numbers ("8M+" vs "over 8 million").

**Data**
- 12 case studies have videos. "Google: Crafting a Cross-Product Narrative" uses
  `Google_Recruiting_-_Technical_Judgment.mp4`, likely the wrong video. The other 11
  filenames look plausible but need watching to confirm.
- p1-q05: the ADP *Customer Story Videos* study has a video; the keynote study has none.
- Missing from the index: Simons Foundation education division, Salesforce partner-ecosystem
  work. "A world of perspectives on the future of learning" is possibly an article
  (articles unretrievable until embedded).

## Agreed adjustments to the user's plan

0. **Phase 0:** commit the harness + routing as the baseline.
1. **Phase 1 (eval):**
   - Number normalisation.
   - Unsupported-claim rate by kind (goal stated as result / capability not shown / generated tags).
   - Remove persona from the grader.
   - Explicit, config-driven Strategy Lead rule.
   - N runs with mean and spread.
   - Optional second grader from another provider via OpenRouter on ~15 responses, with an agreement score.
   - Eval uses the same route as production (now OpenRouter on both).
2. **Phase 2 (content/data):**
   - Embed articles.
   - Ingest the missing site work; diff articlegroup.com/work against the index.
   - Refine the taxonomy (ask before data changes) and fix the code's slug maps.
   - Video audit.
3. **Phase 3 (retrieval), kept simple because the corpus is 43 items:**
   - `hybrid_search_v2` with whole-corpus keyword search, OR semantics, title/client weighting and RRF.
   - Fix or remove the intent filter.
   - Top-k with no 0.15 cutoff.
   - A cached catalogue of all 43 case studies in the system prompt (verify cache hits via usage fields).
   - Add a reranker or query rewriting only if recall is still under 90%.
   - Handle fewer than 4 case studies gracefully.
4. **Phase 4 (generation):**
   - Prompt rewrite: honesty rules, no goals stated as results, invention-bait handling,
     narrative of 2-4 sentences that adds something, "we" voice.
   - Server-side teaser tags.
   - Use videos when the query is about video.
   - Verifier pass only if unsupported claims remain at 5 or more after the prompt fix
     (latency trade-off with streaming).
5. **Phase 5 (speed):**
   - Proposed latency bar: retrieved teasers on screen in about 1.5 s, the streamed hero in about 3-4 s. The original "<2 s first content" for a generated hero isn't realistic.
   - Startup check for the provider route and credit.
6. **Phase 6 (proof):** expanded query set, three runs, a one-page before/after, and five demo queries.

## Ready bar (all must hold across three consecutive runs)

| Check | Bar |
| --- | --- |
| Expected case-study recall | >= 90% |
| Site work missing from the index | 0 |
| Goals stated as results | 0 |
| Invention-bait responses that presuppose the work | 0 |
| Capabilities claimed that the portfolio does not show | 0 |
| Responses with any unsupported claim | < 5 of 50 |
| Voice | >= 4.5 |
| First content on screen | < 2 s (proposed: teasers < 1.5 s, hero 3-4 s) |
| Mismatched videos | 0 after full audit |

## Costs

One full eval run is about $3.50 through OpenRouter (Sonnet answers + Opus grading). Three
runs + second grader is about $12 per phase. The project's OpenRouter key has a $50 cap.
Other keys on the same account spent ~$26 earlier.

## Next step

Phase 0 done (2026-11-20): harness + OpenRouter routing committed as the baseline.
Pushed as `a5b2722`; production deploy verified on article-group-concierge.vercel.app
(a query raised OpenRouter key usage, and `debug: true` is ignored in production).
`EMAIL-TO-CLIENT.md` has an unrelated uncommitted edit, left alone.

**From Phase 1 on, the plan runs through GSD.** Live state is in `.planning/` (PROJECT.md,
REQUIREMENTS.md, ROADMAP.md, STATE.md). This file stays as the record of verified findings.
Next: `/gsd:plan-phase 1`.
