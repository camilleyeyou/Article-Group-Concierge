---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Milestone complete
stopped_at: Completed 06.1-06-PLAN.md up to push checkpoint
last_updated: "2026-11-26T07:58:49.756Z"
last_activity: 2026-11-26
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 63
  completed_plans: 63
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-20)

**Core value:** Never misrepresent AG's work. A wrong claim about a client engagement is worse than a weak answer.
**Current focus:** Phase 06.1 — output-guard-and-claim-tracing

## Current Position

Phase: 06.1
Plan: Not started

## Phase 06.1 outcome (closed with gaps, 2026-11-25)

- Confirm run `2026-11-26T05-24-15` (code 18e09fa, original 50, N=1, held-out not run, second grader off): $4.77, credit $15.43 -> $10.67, 50/50 ok. Reference `2026-11-25T14-30-56`.
- Deltas vs reference: voice 4.48 -> 4.06 (-0.42); grounded 4.76 -> 4.82; unsupported-claim responses 7 -> 7 (bar <= 4); goal_as_result 1 -> 2 (bar 0); recall 92% -> 92%; hallucinations 0; capability_not_shown 0; invention-bait 0.
- Ready bars: 3 of 7 missed (voice < 4.5, unsupported responses 7/50, goal_as_result 2); passed: hallucinations, capability_not_shown, invention-bait, recall.
- Guard: replay over 970 saved answers changed 181, 0 false positives. In the confirm run it changed 3 of 50 answers (count_claim, order_of_work, first_person). It did not move the unsupported-claim count; the 8 remaining claims are narrative 5, teaser summary 3, hero 0, none in guard-target classes.
- Trace shares (pooled full-50): narrative 70%, teaser summaries 27%, hero 6%.
- Hero grader-view fix: rawResponse now rendered after fast-hero substitution; the grader reads the hero the user saw (gap 0/50, was 50/50). Hero-related scores are not comparable with earlier runs.
- Voice drop is a measurement change, not a regression (checked free): hero challengeSummary restating the query ("you're asking / you want / you need / you're looking") appeared in 46/50 user-seen fast heroes but only 12/50 graded raw_response heroes in 2026-11-25T14-30-56; in the new run 49/50 user-seen and 49/50 graded. The grader now scores what users always saw. Main follow-up: the fast-hero-pass prompt restates the user's query (predates 06.1).
- Residual risk: streamed narrative deltas and fast-hero deltas are shown unguarded for a few seconds until `final` replaces them with guarded text (not fixed: buffering would delay the hero, PERF-02).
- Spend: $4.77 of ~$15.70 budget; credit left $10.67. Push: not pushed, awaiting user approval.

## Scope change (2026-11-25)

User decision: $17.70 OpenRouter credit left, no top-ups, no more paid eval or timing runs. Only remaining paid spend is the ~$0.70 demo verification in 06-11.

- 06-10 (three counted runs) not run (budget). PROOF-01 not met.
- Timing batches skipped (06-09 dry batch and counted batches). The speed bar is reported from existing production PERF measurements (quick 261124-80m).
- Latest full original-50 run 2026-11-25T14-30-56 at code 844ae18: voice 4.48, unsupported 14%, goal_as_result 1, recall 92%, 0 hallucinations. Ready-bar misses: voice < 4.5, unsupported >= 10%, goal_as_result > 0.

## Baseline Metrics (frozen)

Run `eval/results/2026-11-20T15-12-31`, code `a5b2722`:

- grounded 4.44, components 4.94, fallback 4.50, cta 4.36, voice 3.92
- hallucinations 0/50
- unsupported claims: 22/50 responses (38 claims)
- expected case-study recall: 39/52 (75%)
- median latency 20.2 s (9.7-28.9 s)

## Re-graded baseline (harness v2, eval/results/2026-11-21T07-32-49-regrade)

Same responses as the frozen run, graded under harness v2. Like-for-like reference for Phases 2-6:

- grounded 3.92, components 4.66, fallback 4.66, cta 4.94, voice 4.08
- hallucinations 0/50
- unsupported claims: 42/50 responses (113 claims): goal_as_result 17, capability_not_shown 11, generated_tags 69, other 16
- expected case-study recall 75%, metrics_not_in_context 0, median latency 20.1 s
- Noise (2 fresh runs, app unchanged): grounded SD 0.16, voice SD 0.04, responses with unsupported claims 39-42, recall 75% both

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 01 P01 | 10min | 2 tasks | 5 files |
| Phase 01 P02 | 10min | 2 tasks | 4 files |
| Phase 01 P03 | 15min | 3 tasks | 4 files |
| Phase 01 P04 | 15min | 2 tasks | 3 files |
| Phase 01 P05 | 20min | 3 tasks | 8 files |
| Phase 01 P06 | 25min | 3 tasks | 7 files |
| Phase 02 P04 | 10min | 2 tasks | 4 files |
| Phase 03 P01 | 30min | 3 tasks | 3 files |
| Phase 03 P02 | 15min | 2 tasks | 7 files |
| Phase 03 P03 | 15min | 2 tasks | 5 files |
| Phase 03 P04 | 25min | 2 tasks | 3 files |
| Phase 03 P05 | 30min | 2 tasks | 5 files |
| Phase 03 P06 | 25min | 2 tasks | 8 files |
| Phase 03 P07 | 10min | 2 tasks | 1 files |
| Phase 03 P08 | 25min | 3 tasks | 6 files |
| Phase 03 P09 | 35min | 3 tasks | 1 files |
| Phase 03 P11 | 90min | 2 tasks | 9 files |
| Phase 03 P12 | ~1h | 3 tasks | 4 files |
| Phase 04 P01 | 20min | 3 tasks | 11 files |
| Phase 04 P02 | 15min | 2 tasks | 8 files |
| Phase 04 P03 | 15min | 2 tasks | 2 files |
| Phase 04 P04 | 25min | 3 tasks | 10 files |
| Phase 04 P05 | 25min | 3 tasks | 3 files |
| Phase 04 P06 | 40min | 3 tasks | 2 files |
| Phase 04 P07 | 25min | 2 tasks | 9 files |
| Phase 04 P08 | n/a | 4 tasks | 1 files |
| Phase 05 P01 | 20min | 3 tasks | 8 files |
| Phase 05-speed P02 | 25min | 2 tasks | 7 files |
| Phase 05 P03 | 15min | 2 tasks | 7 files |
| Phase 05 P04 | 25min | 2 tasks | 3 files |
| Phase 05-speed P05 | 35min | 2 tasks | 4 files |
| Phase 05 P06 | 25min | 3 tasks | 6 files |
| Phase 05-speed P07 | 35min | 3 tasks | 11 files |
| Phase 05 P08 | 20min | 2 tasks | 2 files |
| Phase 05 P09 | 20min | 3 tasks | 2 files |
| Phase 06 P01 | 1min | 2 tasks | 11 files |
| Phase 06 P02 | n/a | 3 tasks | 7 files |
| Phase 06 P03 | n/a | 2 tasks | 8 files |
| Phase 06 P05 | n/a | 3 tasks | 10 files |
| Phase 06 P04 | n/a | 3 tasks | 8 files |
| Phase 06 P06 | n/a | 2 tasks | 3 files |
| Phase 06 P08 | n/a | 3 tasks | 5 files |
| Phase 06 P07 | n/a | 3 tasks | 10 files |
| Phase 06 P09 | n/a | 3 tasks | 3 files |
| Phase 06 P11 | 2.5h | 3 tasks | 9 files |
| Phase 06 P12 | n/a | 3 tasks | 5 files |
| Phase 06.1 P01 | 25min | 3 tasks | 5 files |
| Phase 06.1 P02 | 30min | 2 tasks | 5 files |
| Phase 06.1 P03 | 50min | 3 tasks | 8 files |
| Phase 06.1 P04 | 35min | 3 tasks | 9 files |
| Phase 06.1 P05 | 60min | 3 tasks | 2 files |

### Roadmap Evolution

- Phase 06.1 inserted after Phase 6 (2026-11-25): Output guard and claim tracing.
  - Scope: a deterministic leak/count-claim check, and tracing the remaining unsupported claims.
  - Testing: free on saved answers first; a ~$5 confirm run only with the user's approval.
  - Budget: ~$15.70, no top-ups.

### Decisions

- Phase 0: harness + OpenRouter routing committed as baseline; production routes through OpenRouter.
- Embed all 50 articles (additive only).
- `hybrid_search_v2` goes alongside `hybrid_search`, never replaces it in place.
- Fallback grading = honest reframing; keep `would_strict_pass_fallback`.
- Admitting AG hasn't done a kind of work, and offering a Strategy Lead, are config flags (assumed yes).
- Remove persona from the grader.
- [Phase 01]: Keep current Strategy Lead rule (offerOn no_context) in shared concierge-config; Phase 4 extends it
- [Phase 01]: Metric check compares quantities (unit + value, 0.5% tolerance); number-free values use normalised substring
- [Phase 01]: Grader sees only query, retrieved context, automated checks and response; claims classified by kind; v1 grades re-graded
- [Phase 01]: Median latency uses standard median (20.1 s baseline; frozen notes' 20.2 s was upper-middle)
- [Phase 01]: Report compares this run to frozen baseline and re-graded baseline (found via regrade_of)
- [Phase 01]: Batch N defaults to 1 (max 5); credit preflight: batch runs*3.5+1 USD, regrade 3, single run 4
- [Phase 01]: Second grader defaults to openai/gpt-5.6-sol via OpenRouter (verified live); anthropic/* refused; agreement = share of score pairs within 1 of Opus on a seeded 15-response sample
- [Phase 01]: Second grader = openai/gpt-5.6-sol (97% within 1 of Opus on 15 responses)
- [Phase 01]: Default N = 1; phase ends use N = 2-3
- [Phase 01]: Median latency uses the standard median (20.1 s for the frozen run, previously quoted as 20.2 s)
- [Phase 02]: Intent keyword maps use only DB slugs; technology expands to sub-sector slugs
- [Phase 03]: hybrid_search_v2 live alongside old functions; held docs stay uninserted until Plan 03-10
- [Phase 03]: OpenRouter credit is $25.67 (not ~$45); budget eval runs accordingly
- [Phase 03]: retrieveContext on hybrid_search_v2: offline recall 43/52 (83%), D-303 gate (47/52) not yet met; decision deferred to 03-07/03-08
- [Phase 03]: Catalogue cached as system block (explicit cache_control, ttl 1h); OpenRouter usage showed cache_read 10,542 tokens on repeat call; check cost $0.043
- [Phase 03]: D-303 gate FAIL at 43/52 frozen (43/49 corrected); reranker plan 03-08 runs
- [Phase 03]: User approved Cohere rerank-5-fast (data processor); rerank re-gate FAIL 44/52 (44/49 corrected), +1 vs 03-07, p50 892 ms, 0 fallbacks, ~$0.008
- [Phase 03]: Phase 3 shipped as 2 commits (853bbe4 + build fix 120ab9d); prod on v2; 20 held chunks inserted, filters verified 8/8, recall unchanged 43/52
- [Phase 03]: 03-11 bake-off: winner cap8 (no rerank), 47/52 frozen on both passes; Cohere cap7 47, cap8 48; Haiku cap8 47; Haiku needs thinking disabled; production still cap 6
- [Phase 03]: Shipped cap8 (maxCaseStudies 8, no reranker) as retrieval default; eval recall 47/52 frozen, RETR-05 guard pass
- [Phase 03 gap] D-305 bake-off: winner cap8; eval 2026-11-22T13-42-12 recall 47/52 frozen, 47/49 corrected; D-307 guard PASS (zero-expected teasers 1.45, exactly-4 1/50); spend $4.83; production: pushed lever (user option "Squash and push"); deploy: Vercel 7wqDymHReWw5ZM1ZKLgq1YJ6C2hH Ready (commit 2faba11); live smoke: layoutPlan returned, 20.1 s
- [Phase 04]: 04-01: server-side teaser tags from DB links via postProcessOutput; Phase 4 config contract (triggers, keywords, narrative limits, verifier flag default OFF) centralised in concierge-config
- [Phase 04]: 04-06: full eval 2026-11-22T22-48-20 claims 6/50, voice 4.36; GEN-07 GATE EVALUATE VERIFIER; user option run (Opus grader only); GEN-02, GEN-05 marked complete
- [Phase 04]: 04-07: verifier built (fail-open, default off, debug-only report); eval:verify-saved ready for 04-08; GEN-07 stays open
- [Phase 04]: GEN-07 verifier ships disabled (user: ship-disabled); revisit in Phase 5 off the first-content path
- [Phase 04]: Prompt rewrite (honesty, 2-4 sentence "we" narrative, Strategy Lead on 5 triggers, Larkspur example); server-side teaser tags from DB links; eval 2026-11-22T22-48-20: unsupported-claim responses 6/50, goal_as_result 2, capability_not_shown 0, invention_bait_presupposed 0, voice 4.36, narrative_in_range 49/50; harness v4. 1 of 5 success criteria met, Phase 4 left unticked
- [Phase 04]: GEN-07 gate EVALUATED; verifier SHIP DISABLED (6 -> 5 claims, +2.6 s median, 47/50 rewritten, voice -0.18, new claims introduced)
- [Phase 04]: spend ~$10.6; credit $5.39; production: pushed (user option "push", Squash and push); deploy: Ready (4db5d2d, Vercel production 2026-11-23T01:52Z); live smoke: OK 26.3 s, layoutPlan 5 components (Hero, Video, StrategyCard, 2 teasers), no internal keys, teaser tags match DB catalogue
- [Phase 05]: 05-01: generation.mode default 'default' => generationParams() {} (Phase 4 request body unchanged); SSE contracts and chat helpers shared via stream-events/chat-errors/chat-request
- [Phase 05-speed]: Provider health: spendable credit = min(limit_remaining, effective_budget); outages only warn, never block chat
- [Phase 05]: 05-04: parser ignores leading prose as narrative; final whole-response parse stays authoritative
- [Phase 05]: 05-08: generation mode adaptive_effort:low (median hero-first 1438 ms vs 12299 default); D-513 eval in 05-09 decides if it ships
- [Phase 05]: Retrieval fixes 1–3 applied; PERF-01/02 judged by production smoke after deploy (05-10), local eval speed is distance-inflated (Douala→Supabase)
- [Phase 05]: 05-09: D-513 regressed (4 gates) under adaptive_effort:low; generation mode reverted to default (unmeasured). PERF-01/02 local FAIL provisional until 05-10 production smoke.
- [Phase 05]: Streaming route /api/chat/stream (SSE) alongside JSON /api/chat; instant teasers (top 3, DB-only, digit-filtered deliverables); D-504 suppression floor 0.40 + claim pattern + isAboutAG + zero case studies; eval 2026-11-23T19-49-22: median t_teasers 2260 ms, t_hero_first 12.6 s, t_complete 17.8 s; production (uncached, measured from Douala): teasers 1.81-1.90 s, hero 11.1-13.9 s, complete 18.0-19.0 s; PERF-01 FAIL (1.8-1.9 s vs 1.5 s), PERF-02 MISSED (deferred to Phase 6), D-513 PASS (unsupported 6/50, grounded 4.80, voice 4.44)
- [Phase 05]: generation mode default (timing run 05-08 chose adaptive_effort:low; reverted: yes, D-513 regression 16 unsupported / voice 4.02)
- [Phase 05]: provider health check (PERF-03) in /api/health (admin), startup log, eval preflight; credit fetch uses cache: 'no-store'. Production /api/health returns 503 "Admin endpoint not configured" because ADMIN_API_TOKEN is not set in Vercel (by design, not changed)
- [Phase 05]: spend ~$58 incl. top-up evals (credit ~$17 of $75 limit); production: pushed (user option "push", Squash and push); deploy: live (d9d5ccf, stream route serving 2026-11-23); live smoke: stream OK on 4 uncached queries (incremental, not buffered), Wiz bait query suppressed teasers and declined to confirm, JSON route 200 in 15.1 s, debug flag ignored
- [Phase 06]: 06-01: held-out queries excluded in code via selectQueries; only eval:run --proof includes them; generate --force refuses once held-out exist
- [Phase 06]: Held-out labels (25) approved without edits and frozen by sha256 (D-603)
- [Phase 06]: 06-03: proof-report verdict precedence INCOMPLETE > FAIL; D-608 compares code via git diff, not HEAD
- [Phase 06]: 06-05: video option B + harness D confirmed by user (user applied DB update and poster); voice/count-claim rules in shared config; video_query_missing_video narrowed, disclose in 06-12
- [Phase 06]: 06-04: timing batches draw from all 75 queries, 3 x 20 (10/4/2/2/2) plus 2 dry ids, per plan; PERF_TIMING SSE comments guarded and tested; workflow runs only once on main (06-09)
- [Phase 06]: 06-06: recall 47/52 -> 48/52 via bank/insurer finance keywords; 49/52 criterion missed, user chose option-a (proceed)
- [Phase 06]: 06-08: static checks site_work_missing 0, mismatched_videos 0; checkpoint skipped, nothing ingested
- [Phase 06]: 06-07: fix-pass prompt rules (voiceRule, countClaimRule, adjacentWorkRule, deliverables tightening) regressed voice and claims; prompt restored to 7600919^ by the user; confirm full-50 voice 4.48, 7/50 unsupported responses, recall 48/52; p1-q07 count claim open and accepted; spend 13.89, credit 17.70, no top-ups
- [Phase 06]: 06-09: user chose squash+push (option-a); Phase 6 pushed as b50bb0c, deploy dpl_8ngJFmZTiiz6aYrcAfARAjFJWXKM Ready, smoke ok; timing skipped (budget); PERF_TIMING being switched off by user
- [Phase 06]: 06-11: demo verification on production: 1 of 5 picks VERIFIED (p2-q04); p1-q03, p3-q10, p3-q09 unstable teaser sets, p5-q06 unsupported pricing wording; reserves not swapped, awaiting user; demo spend 0.93, credit 16.39
- [Phase 06]: 06-11: demo_rule claims (user): final demo set p2-q06, p1-q06, p3-q02, p2-q04, p3-q09 verified on production (PROOF-03 met under relaxed rule, 4 of 5 under strict); p3-q10 failed on a retrieval leak; demo spend 1.55 (0.05 over the 1.50 line), credit 15.77
- [Phase 06]: 06-12: Phase 6 closed with gaps, user approved page and push (2026-11-25). Verdict: much improved, not proven ready; PROOF-01 NOT met (three counted runs never executed, budget). After run 2026-11-25T14-30-56 at 844ae18 (same prompt deployed as b50bb0c), original 50 only: recall 48/52 (92%), voice 4.48 (bar 4.5), unsupported-claim responses 7/50 = 14% (bar < 10%), goal_as_result 1 (bar 0): three bar misses; site work missing 0, invention-bait 0, capabilities not shown 0, mismatched videos 0. Held-out 25 never run; timing batches skipped (speed only indicative, from Cameroon). Spend $15.44 logged (+~$0.07 closing smoke), credit left $15.77 before the smoke. Demo ids p2-q06, p1-q06, p3-q02, p2-q04, p3-q09 (PROOF-03 partial: verified under the claims rule; 4 of 5 pass the original stability rule; no multi-part or pricing query). Page: https://claude.ai/artifact/DbPCsryF6zFurYCXzUJQWE. PERF_TIMING: user turning it off in Vercel themselves (still present in production at close); EVAL_DEBUG absent. Production Ready; live smoke SMOKE OK ("insurance experience?", 18.0 s to final)
- [Phase 06.1]: 06.1-01: output guard is pure; leak sentences dropped, count claims and first-person rewritten; sole-sentence leaks kept as kept_unresolved
- [Phase 06.1]: 06.1-02: claim trace over 80 claims: narrative 70%, teaser summaries 27%, hero 6% (pooled full-50); hero gap 50/50 in latest three full runs, fix is plan 04 Task 2
- [Phase 06.1]: 06.1-03: guard replay over 970 saved answers changes 181, 0 false positives, 8/8 must-catch; order_of_work rule added for teaser summaries; first_person ignores quoted I; designed-and-produced, goal_as_result, channel inference not fixed
- [Phase 06.1]: 06.1-04: guard runs inside postProcessOutput on both routes (OUTPUT_GUARD_ENABLED switch, version in cache key); fast hero guarded and rendered into rawResponse; guard report internal, saved as record.guard from EVAL_DEBUG; streamed deltas stay unguarded until final (residual risk)

- [Phase 06.1]: deterministic output guard (OUTPUT_GUARD_ENABLED switch), no prompt rules added
- [Phase 06.1]: rawResponse re-rendered after fast-hero substitution; grader now reads the hero the user saw
- [Phase 06.1]: 06.1-05/06: closed with gaps; confirm run 2026-11-26T05-24-15 missed 3 of 7 bars (voice 4.06, unsupported 7/50, goal_as_result 2); voice drop is the grader now seeing the query-restating hero; follow-up is the fast-hero-pass prompt; spend $4.77, credit $10.67

### Key Constraints

- Do not change the generation model (Sonnet 5.5) or the eval judge (Opus 5.5).
- One phase at a time; after each phase rerun the eval and report deltas vs baseline.
- Squash each phase to one commit before pushing.
- Ask before any destructive DB change or full re-index; ask before taxonomy data changes and before ingesting missing work.
- Check current docs before choosing external products/APIs (research enabled for Phases 3 and 5).
- Budget: OpenRouter key limit raised to $75; ~$17 credit left after Phase 5; Phase 6 ~$12.
- Rollback: NEXT_PUBLIC_CHAT_STREAM=false returns the client to JSON /api/chat; GENERATION_MODE=default reverts thinking.
- `EVAL_DEBUG=true` must never be set in production.
- Supabase free tier pauses on inactivity; restore it before eval runs.

### Pending Todos

None yet.

### Blockers/Concerns

- `EMAIL-TO-CLIENT.md` and `eval/PLAN.md` have uncommitted edits unrelated to the roadmap; leave `EMAIL-TO-CLIENT.md` alone.
- Phase 1 changes metric definitions, so baseline comparisons need a re-grade under the new harness.
- ROLLBACK PRECONDITION: before rolling production back past the Phase 3 commit, or if hybrid_search_v2 is ever dropped or bypassed, first remove or relabel the 20 held chunks (5 company_info + 15 excluded LinkedIn; needs user approval, it is a destructive DB change). hybrid_search_exact and hybrid_search cannot filter metadata.article_class, so the old code path would surface LinkedIn and company-info text. Details and document_ids in 03-10-SUMMARY.md.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261123-f81 | Fix PERF-03 stale OpenRouter credit (cache: 'no-store') | 2026-11-23 | 0b7e2a0 | [261123-f81-fix-perf-03-stale-provider-credit-next-f](./quick/261123-f81-fix-perf-03-stale-provider-credit-next-f/) |
| 261124-0q7 | Video poster previews (8 MP4 posters in Storage) and hide 2 dead Vimeo videos | 2026-11-24 | 1ac69f8 | [261124-0q7-video-poster-previews-and-hide-unplayabl](./quick/261124-0q7-video-poster-previews-and-hide-unplayabl/) |
| 261124-80m | PERF-01 teaser latency: hybrid_search_v2_top (migration 006), teasers 2118 -> 1633 ms local warm | 2026-11-24 | a952ddd | [261124-80m-perf-01-teaser-latency-to-1-5s](./quick/261124-80m-perf-01-teaser-latency-to-1-5s/) |
| fast | PERF_TIMING log reaches production logs (perf_teaser JSON line, cold start, cache hit, rpc fn, catalogue breakdown) | 2026-11-24 | ef94cc2 | - |

## Session Continuity

Last session: 2026-11-26T05:47:25.565Z
Last activity: 2026-11-26
Stopped at: Completed 06.1-06-PLAN.md up to push checkpoint
Resume file: None

- 2026-11-22 (03-08 follow-up): User chose to keep the Cohere reranker OFF (rerank.enabled=false). Net +1 recall (44/52) did not justify ~0.9 s p50 latency and a new data processor. Code and RRF fallback stay; re-enable via config or RERANK_ENABLED=true. Phase-end eval (03-09) approved by user despite gate FAIL; expected recall ≈ 43/52.
