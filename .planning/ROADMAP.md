# Roadmap: Article Group Concierge (owner-ready quality)

## Overview

Make the AG Concierge ready to show AG's owner, who is very detail-oriented. Core value: never misrepresent AG's work. Six sequential phases, agreed with the user in `eval/PLAN.md`: fix the measurement first, then the content, then retrieval, generation and speed, and finally prove it across three consecutive runs.

**Completed prior work (Phase 0):** the eval harness and OpenRouter routing were committed as the reproducible baseline in `a5b2722` and the production deploy was verified. It is not a phase here.

**Baseline (frozen):** run `2026-11-20T15-12-31`, code `a5b2722`: grounded 4.44, components 4.94, fallback 4.50, cta 4.36, voice 3.92, hallucinations 0/50, unsupported claims in 22/50 responses (38 claims), expected case-study recall 39/52 (75%), median latency 20.2 s (9.7-28.9 s).

**Cost note:** each eval run is about $3.50 through OpenRouter. About $45 is left on a $50 cap, so three runs plus the second grader (~$12) per phase is the working limit. Do not run more evals than a phase needs.

**Process rules:** one phase at a time, rerun the eval after each phase and report deltas, squash each phase into one commit before pushing. Do not change Sonnet 5.5 (generation) or Opus 5.5 (judge).

## Phases

- [x] **Phase 1: Eval improvements** - Make the eval measure what matters reliably
- [ ] **Phase 2: Content and data** - Complete, accurate index: articles embedded, missing work ingested, taxonomy and videos correct
- [ ] **Phase 3: Retrieval** - Find the expected case studies at 90% recall via `hybrid_search_v2`
- [ ] **Phase 4: Generation** - Honest, on-voice answers with no invented claims
- [ ] **Phase 5: Speed** - Teasers in about 1.5 s, streamed hero in about 3-4 s
- [ ] **Phase 6: Proof** - Ready bar cleared on three consecutive runs, with before/after and demo queries

## Phase Details

### Phase 1: Eval improvements
**Goal**: The eval gives trustworthy, comparable numbers so every later phase can be judged against the baseline.
**Depends on**: Nothing (Phase 0 harness already committed at `a5b2722`)
**Requirements**: EVAL-01, EVAL-02, EVAL-03, EVAL-04, EVAL-05, EVAL-06, EVAL-07
**Success Criteria** (what must be TRUE):
  1. A number like "8M+" is not flagged against "over 8 million" in the report, and the grader prompt contains only the query and retrieved context, with no persona.
  2. The report lists unsupported claims per response and in total, split by kind (goal as result, capability not shown, generated tags, other).
  3. Running the eval with N runs prints each metric's mean and spread, and a ~15-response second-grader sample prints an agreement score against Opus.
  4. The Strategy Lead expectation and component-count rule come from one shared config used by both the app prompt and the rubric.
  5. Eval rerun after the phase; the report states the route and model IDs and lists every metric's delta vs baseline run 2026-11-20T15-12-31. Metric definitions change in this phase, so the baseline responses are re-graded under the new harness and compared on both old-comparable and new metrics where possible.
**Constraints / gates**: Do not change the generation or judge models. Second grader goes through OpenRouter and must be another provider (check current model IDs in the docs first). Budget: ~$3.50 per run.
**Plans**: 7 plans

Plans:
- [x] 01-01-PLAN.md — Shared concierge config (Strategy Lead + component-count rules) with byte-identical prompt; route/model IDs in the debug payload
- [x] 01-02-PLAN.md — Number normalisation for the metric check (TDD)
- [x] 01-03-PLAN.md — Grader rewrite: no persona, claims by kind, config-driven rubric, frozen-baseline write guard
- [x] 01-04-PLAN.md — Metrics module and report: claims by kind, route/model header, baseline comparison table
- [x] 01-05-PLAN.md — Preflight (Supabase/credit), N-run batch with mean/SD/min–max, baseline re-grade command
- [x] 01-06-PLAN.md — Second grader (openai/gpt-5.6-sol via OpenRouter) with agreement score; README rewrite
- [x] 01-07-PLAN.md — Phase-end eval (regrade + 2 runs + second grader, ~$10), delta report, squash, push after approval

### Phase 2: Content and data
**Goal**: The index contains all of AG's work with accurate tags and correct videos, so nothing real is missing or mislabelled.
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. All 50 articles have chunks and embeddings, and `hybrid_search` can return at least one of them for a relevant query.
  2. A diff of articlegroup.com/work against the index shows site work missing from the index = 0, including the Simons Foundation education division and the Salesforce partner-ecosystem work.
  3. Taxonomy is no longer 39/43 "technology"; each case study's capability and industry links match its content, and `detectQueryIntent` slug maps use only slugs that exist in the DB.
  4. Mismatched videos = 0: all 12 case-study videos are audited, the Google cross-product mismatch is fixed or removed, and the audit result is recorded.
  5. Eval rerun after the phase; report lists every metric's delta vs baseline run 2026-11-20T15-12-31.
**Constraints / gates**: Ask the user before taxonomy data changes, before ingesting each piece of missing work, and before any destructive DB change or full re-index. Embedding articles is additive only (no deletes). Production shares the Supabase project, so keep changes non-breaking. Restore the paused Supabase project before eval runs.
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Embed articles idempotently; simulate live-retrieval impact; user decides before insert; company-info + LinkedIn held for Phase 3 (DATA-01)
- [x] 02-02-PLAN.md — Scrape articlegroup.com/work, diff against the index, one approval table, ingest approved work in full text (DATA-02)
- [x] 02-03-PLAN.md — Evidence-backed taxonomy proposal (new service-line + tech sub-sector slugs), one approval table, backup + apply (DATA-03)
- [x] 02-04-PLAN.md — detectQueryIntent maps moved to src/lib/intent-keywords.ts, remapped to DB slugs, DB check script + tests (DATA-04)
- [x] 02-05-PLAN.md — Video audit (keyframes + local transcripts), verdict table, user approval, relink/unlink with backup (DATA-05)
- [x] 02-06-PLAN.md — Phase-end eval (1 run, ~$3.50), delta report vs both baselines, squash, push after approval

### Phase 3: Retrieval
**Goal**: The concierge finds the case studies a prospect would expect to see, at 90% recall or better.
**Depends on**: Phase 2
**Requirements**: RETR-01, RETR-02, RETR-03, RETR-04, RETR-05, RETR-06
**Success Criteria** (what must be TRUE):
  1. `hybrid_search_v2` exists alongside the untouched `hybrid_search`, with whole-corpus OR keyword search, title/client weighting and reciprocal rank fusion, and queries like "messaging house + marketecture?" return the CrowdStrike study.
  2. Expected case-study recall is >= 90% (baseline 39/52, 75%), with no 0.15 cutoff and no false intent matches ("ai" inside "maintain").
  3. The case-study catalogue is a cached system-prompt prefix, and OpenRouter usage fields show cache hits on repeat calls.
  4. A query with fewer than 4 relevant case studies shows only what exists, with no padding or misrepresentation.
  5. Eval rerun after the phase; report lists every metric's delta vs baseline run 2026-11-20T15-12-31.
**Constraints / gates**: New SQL goes in `hybrid_search_v2` alongside `hybrid_search`, never a replacement in place. Research: enable for this phase. Check current docs before choosing the prompt-caching approach and before adding any reranker or query rewriting (only if recall is still < 90% after RETR-01..05). Ask before any destructive DB change.
**Plans**: TBD

### Phase 4: Generation
**Goal**: Every answer is honest, in AG's voice, and supported by indexed content.
**Depends on**: Phase 3
**Requirements**: GEN-01, GEN-02, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07
**Success Criteria** (what must be TRUE):
  1. Goals stated as results = 0, invention-bait responses that presuppose the work = 0, and capabilities claimed but not shown = 0.
  2. Responses with any unsupported claim < 5 of 50 (baseline 22/50), and teaser capabilities/industries come from DB links, never from the model.
  3. Voice >= 4.5 (baseline 3.92): narratives are 2-4 sentences, add something beyond the teasers, and use "we".
  4. Video components appear for video queries when a verified video exists, and the Strategy Lead is offered on fallback, pricing and timeline queries per the shared config.
  5. Eval rerun after the phase; report lists every metric's delta vs baseline run 2026-11-20T15-12-31.
**Constraints / gates**: Add a verifier pass only if unsupported claims are still >= 5/50 after GEN-01..06, and evaluate its latency cost first (user approval). Do not change Sonnet 5.5.
**Plans**: TBD

### Phase 5: Speed
**Goal**: Prospects see real content almost immediately instead of waiting about 20 s.
**Depends on**: Phase 4
**Requirements**: PERF-01, PERF-02, PERF-03
**Success Criteria** (what must be TRUE):
  1. Retrieved teasers are on screen in about 1.5 s (baseline median total latency 20.2 s).
  2. The generated hero streams in and starts showing within about 3-4 s using the streaming path.
  3. A startup/health check confirms the provider route is OpenRouter and reports remaining credit, and fails with a clear message when either is wrong.
  4. Eval rerun after the phase; report lists every metric's delta vs baseline run 2026-11-20T15-12-31, including latency, and shows quality metrics did not regress.
**Constraints / gates**: Research: enable for this phase. Check current OpenRouter streaming and caching docs before implementing. `EVAL_DEBUG` must stay unset in production.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Proof
**Goal**: The owner can be shown, with evidence, that every ready-bar check holds.
**Depends on**: Phase 5
**Requirements**: PROOF-01, PROOF-02, PROOF-03
**Success Criteria** (what must be TRUE):
  1. An expanded query set is run three consecutive times and every ready-bar check holds on all three: recall >= 90%, site work missing 0, goals as results 0, invention-bait presupposed 0, capabilities claimed but not shown 0, unsupported claims < 5/50, voice >= 4.5, teasers ~1.5 s / hero 3-4 s, mismatched videos 0.
  2. A one-page before/after compares the baseline run 2026-11-20T15-12-31 with the final runs, metric by metric, with every delta listed.
  3. Five demo queries are chosen and each is verified to produce an accurate, strong response.
**Constraints / gates**: Three runs plus the second grader cost ~$12, so confirm remaining credit first. If any bar fails, return to the responsible earlier phase rather than relaxing the bar.
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Eval improvements | 7/7 | Complete (push pending) | 2026-11-21 |
| 2. Content and data | 0/6 | Planned | - |
| 3. Retrieval | 0/TBD | Not started | - |
| 4. Generation | 0/TBD | Not started | - |
| 5. Speed | 0/TBD | Not started | - |
| 6. Proof | 0/TBD | Not started | - |
