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
- [x] **Phase 3: Retrieval** - Find the expected case studies at 90% recall via `hybrid_search_v2`
- [ ] **Phase 4: Generation** - Honest, on-voice answers with no invented claims
- [ ] **Phase 5: Speed** - Teasers in about 1.5 s, streamed hero in about 3-4 s (shipped; NOT MET: teasers 1.8-1.9 s in production, hero 11-14 s; PERF-02 deferred to Phase 6)
- [ ] **Phase 6: Proof** - CLOSED WITH GAPS, not fully met: before/after page and five demo queries delivered; ready bar not cleared and three counted runs not executed (budget)

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
**Plans:** 13 plans (03-08 conditional on the offline recall gate; 03-11..13 RETR-06 gap closure)

Plans:
- [x] 03-01-PLAN.md — Migration 005 `hybrid_search_v2` (additive), RPC check script, guarded held-chunk insert script; user applies 005 (checkpoint)
- [x] 03-02-PLAN.md — Contracts: retrieval/teaser config (cap 6, relevant-only), types, whole-word intent + isAboutAG, disputed labels (D-301)
- [x] 03-03-PLAN.md — Eval harness: recall_pct_corrected, shown recall, teaser padding, prompt-cache hits, debug field capture
- [x] 03-04-PLAN.md — retrieveContext on v2 (soft intent, no 0.15 cutoff, 6+2 caps, fallback) + free offline recall gate script
- [x] 03-05-PLAN.md — Deterministic case-study catalogue as cached system block; usage capture; cache-hit check
- [x] 03-06-PLAN.md — Teaser/video rules from one config in prompt + rubric + checks; RRF rank labels; grader sees catalogue (D-304), harness v3
- [x] 03-07-PLAN.md — Combined free checks + D-303 offline gate (>= 47/52 frozen)
- [x] 03-08-PLAN.md — CONDITIONAL: cohere/rerank-5-fast reranker via OpenRouter (Cohere processor checkpoint), RRF fallback, re-gate
- [x] 03-09-PLAN.md — Smoke + single full eval run; 03-EVAL-DELTA.md vs frozen and re-graded baselines
- [x] 03-10-PLAN.md — Squash + push on user go-ahead; confirm production on v2; insert held docs (approval) and verify filters
- [x] 03-11-PLAN.md — GAP (RETR-06): Haiku listwise rerank (disabled) + offline bake-off of cap 7/8, Cohere, Haiku; verdict in 03-BAKEOFF.md (D-305)
- [x] 03-12-PLAN.md — GAP: stop if no winner; ship winner, offline gate PASS, smoke + one full eval, 03-GAP-EVAL-DELTA.md with RETR-05 guard (D-307)
- [x] 03-13-PLAN.md — GAP: user go-ahead, squash + push, deploy + live smoke, STATE/ROADMAP update

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
**Plans:** 9 plans (04-07 and 04-08 run only if the GEN-07 gate in 04-06 triggers)

Plans:
- [x] 04-01-PLAN.md — Shared config contract (triggers, keywords, sentence limits, example names, verifier flag) and server-side teaser tags from DB links (GEN-03)
- [x] 04-02-PLAN.md — Eval subset runs (--subset phase4-smoke) and eval:compare against the gap run
- [x] 04-03-PLAN.md — System prompt rewrite: honesty rules, invention bait, 2-4 sentence "we" narrative, Strategy Lead, video, Larkspur example
- [x] 04-04-PLAN.md — Eval checks and rubric v4: sentence count, per-trigger Strategy Lead, tag source, video, presupposition flag
- [x] 04-05-PLAN.md — Smoke runs on the 21-query subset (user-approved spend, <= $4) with like-for-like deltas
- [x] 04-06-PLAN.md — Full eval, 04-EVAL-DELTA.md vs frozen/re-graded/gap runs, GEN-07 gate verdict
- [x] 04-07-PLAN.md — (conditional) Haiku 5.5 claim-check verifier behind a default-off flag, saved-response script
- [x] 04-08-PLAN.md — (conditional) Verifier evaluation on saved responses, latency vs 2 s budget, user ship decision
- [x] 04-09-PLAN.md — Phase close: state updates, squash, push after approval, deploy check, live smoke

Phase 4 NOT MET criteria (per 04-EVAL-DELTA.md): (1) goal_as_result 2 vs 0; (2) unsupported-claim responses 6/50 vs < 5; (3) voice 4.36 vs >= 4.5; (4) Strategy Lead on fallback 20/21 (p4-q03). Verifier ships disabled.

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
**Plans**: 10 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md — Shared contracts: config knobs (instant teasers, D-504 floor/pattern, thinking mode, health thresholds), SSE event protocol, chat helpers extracted from the JSON route
- [x] 05-02-PLAN.md — PERF-03 provider health check: shared checkProviderHealth(), /api/health (admin), startup log, eval preflight reuse
- [x] 05-03-PLAN.md — Instant teasers (DB-only, digit-filtered deliverables) and calibrated D-504 suppression with committed fixture
- [x] 05-04-PLAN.md — TDD incremental layout parser (streamed hero text, complete components, narrative without follow-ups)
- [x] 05-05-PLAN.md — orchestrateStream typed events + POST /api/chat/stream (SSE) alongside the unchanged JSON route
- [x] 05-06-PLAN.md — Streaming UI per 05-UI-SPEC: hero skeleton, instant teasers, typing hero, reconcile, partial-deck errors, JSON rollback by env
- [x] 05-07-PLAN.md — Eval on the stream route: t_* timings, speed/flash/suppression metrics, phase5Gates, timing and smoke scripts
- [x] 05-08-PLAN.md — Cents-priced thinking-mode timing run + route smoke; set the generation mode knob
- [x] 05-09-PLAN.md — UI check + go/no-go, the single full eval, 05-EVAL-DELTA.md (revert mode on D-513 regression)
- [x] 05-10-PLAN.md — Record outcome, squash, push on approval, deploy and live stream/JSON/health smokes

### Phase 6: Proof
**Goal**: The owner can be shown, with evidence, that every ready-bar check holds.
**Depends on**: Phase 5
**Requirements**: PROOF-01, PROOF-02, PROOF-03
**Success Criteria** (what must be TRUE):
  1. An expanded query set is run three consecutive times and every ready-bar check holds on all three: recall >= 90%, site work missing 0, goals as results 0, invention-bait presupposed 0, capabilities claimed but not shown 0, unsupported claims < 5/50, voice >= 4.5, teasers ~1.5 s / hero 3-4 s, mismatched videos 0.
  2. A one-page before/after compares the baseline run 2026-11-20T15-12-31 with the final runs, metric by metric, with every delta listed.
  3. Five demo queries are chosen and each is verified to produce an accurate, strong response.
Phase 6 outcome (closed with gaps, 2026-11-25): (1) NOT MET: only one run of the original 50 (2026-11-25T14-30-56, 844ae18) exists; it misses three bars (voice 4.48 vs 4.5, unsupported-claim responses 7/50 = 14% vs < 10%, goal_as_result 1 vs 0); the other checks hold on that one run (recall 92%, site work missing 0, invention-bait 0, capabilities not shown 0, mismatched videos 0); speed not measured from a US machine and the 25 held-out queries never run. (2) MET: before/after page published (https://claude.ai/artifact/DbPCsryF6zFurYCXzUJQWE, copy in 06-BEFORE-AFTER.md). (3) PARTIAL: five demo queries verified on production under the claims rule the user approved after seeing results; 4 of 5 pass the original stability rule; no multi-part or pricing query in the set.
**Constraints / gates**: Three runs plus the second grader cost ~$12, so confirm remaining credit first. If any bar fails, return to the responsible earlier phase rather than relaxing the bar.
**Plans:** 12 plans

Plans:
- [x] 06-01-PLAN.md — Held-out guard in the eval harness (selectQueries, --proof opt-in, tuning tools exclude held-out)
- [x] 06-02-PLAN.md — 25 held-out queries, evidence-backed labels, user approval, hash freeze (D-601..D-603)
- [x] 06-03-PLAN.md — Proof measurement: D-604/D-605 gates, held-out split, eval:batch --proof, eval:proof-report
- [x] 06-04-PLAN.md — US-vantage speed: PERF_TIMING SSE cache flags, prod-timing client, fixed batches, GitHub Actions workflow
- [x] 06-05-PLAN.md — Fix pass (generation): voice and count-claim rules, video check correction, video data decision
- [x] 06-06-PLAN.md — Fix pass (retrieval): offline recall margin on the original 50 within Phase 3 rules
- [x] 06-07-PLAN.md — Top-up and spend approval, ledger, paid phase6-fix subset verification, go/no-go
- [x] 06-08-PLAN.md — Static re-checks: site work diff and video re-check (D-609)
- [x] 06-09-PLAN.md — Proof code to production (user's route), timing batches fixed, dry US timing batch
- [x] 06-10-PLAN.md — Three counted 75-query runs with per-run timing batches and gate checks (D-608 stop rule): NOT EXECUTED (budget)
- [x] 06-11-PLAN.md — Demo shortlist, user pick, production claim-by-claim verification (D-611/D-612)
- [x] 06-12-PLAN.md — Owner before/after page (D-613/D-614), publish, record, squash, push, live smoke

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Eval improvements | 7/7 | Complete (push pending) | 2026-11-21 |
| 2. Content and data | 6/6 | Complete | 2026-11-21 |
| 3. Retrieval | 13/13 | Complete | 2026-11-22 |
| 4. Generation | 9/9 | Complete (criteria 1-4 not met) | 2026-11-23 |
| 5. Speed | 10/10 | Complete (criteria 1-2 not met) | 2026-11-23 |
| 6. Proof | 12/12 | Closed with gaps (criterion 1 not met, 3 partial; 06-10 not executed) | 2026-11-25 |
| 06.1 Output guard and claim tracing | 6/6 | Closed with gaps (3 of 7 ready bars missed; push pending) | 2026-11-25 |

### Phase 06.1: Output guard and claim tracing (INSERTED)

**Goal:** Close the Phase 6 claim and voice gaps without prompt-rule stacking:
- A deterministic post-generation check that catches retrieval-wording leaks ("in what we pulled up", "Nothing we retrieved…") and count claims ("our two security examples").
- Trace the remaining unsupported claims in the saved runs to their source: hero pass, teaser summaries or narrative.
- Test everything free against all saved answers before any paid run. One ~$5 full-50 confirm run happens only after the user approves.
- Budget: ~$15.70 credit, no top-ups.
**Requirements**: GUARD-01, GUARD-02, TRACE-01, TRACE-02, CONFIRM-01
**Depends on:** Phase 6
**Plans:** 6 plans

Plans:
- [x] 06.1-01-PLAN.md — Requirement IDs + deterministic output guard module, test-first (leak drop, count-claim and first-person rewrites)
- [x] 06.1-02-PLAN.md — Free claim trace over all harness-v4 saved runs; hero grader-view gap measured
- [x] 06.1-03-PLAN.md — Free replay of the guard over every saved answer, false-positive review, trace-driven deterministic rules
- [x] 06.1-04-PLAN.md — Guard wired into both chat routes; fast hero re-rendered into rawResponse so the grader reads what the user saw (wave 3, after 06.1-03)
- [x] 06.1-05-PLAN.md — Readiness check, user approval, the one ~$5 full-50 confirm run, deltas vs 2026-11-25T14-30-56 (ran; 3 of 7 ready bars missed)
- [x] 06.1-06-PLAN.md — Record outcome, squash, push on approval, deploy check and live smoke (squashed locally; push awaiting user approval)

**Outcome (closed with gaps, 2026-11-25):** Run 2026-11-26T05-24-15 ($4.77, credit $10.67) missed 3 of 7 ready bars: voice 4.06 (bar 4.5), unsupported-claim responses 7/50 (bar <= 4), goal_as_result 2 (bar 0); passed hallucinations 0, capability_not_shown 0, invention-bait 0, recall 92%. The guard replays with 0 false positives over 970 answers but changed only 3 of 50 answers in the run. The voice drop is a measurement change: the grader now reads the hero users saw, whose challengeSummary restates the query in 49/50 answers (12/50 were graded before). Main follow-up: fast-hero-pass prompt. Residual risk: streamed narrative deltas and fast-hero deltas are shown unguarded for a few seconds until `final` replaces them with guarded text (not fixed: buffering would delay the hero, PERF-02).
