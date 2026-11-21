---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 1 complete (pending push)
stopped_at: Completed 01-07-PLAN.md
last_updated: "2026-11-21T05:48:25.783Z"
progress:
  total_phases: 6
  completed_phases: 1
  total_plans: 7
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-20)

**Core value:** Never misrepresent AG's work. A wrong claim about a client engagement is worse than a weak answer.
**Current focus:** Phase 01 — eval-improvements

## Current Position

Phase: 01 (eval-improvements) — COMPLETE (pending push)
Plan: 7 of 7

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

### Key Constraints

- Do not change the generation model (Sonnet 5.5) or the eval judge (Opus 5.5).
- One phase at a time; after each phase rerun the eval and report deltas vs baseline.
- Squash each phase to one commit before pushing.
- Ask before any destructive DB change or full re-index; ask before taxonomy data changes and before ingesting missing work.
- Check current docs before choosing external products/APIs (research enabled for Phases 3 and 5).
- Budget: OpenRouter key capped at $50, about $45 left; each eval run ~$3.50.
- `EVAL_DEBUG=true` must never be set in production.
- Supabase free tier pauses on inactivity; restore it before eval runs.

### Pending Todos

None yet.

### Blockers/Concerns

- `EMAIL-TO-CLIENT.md` and `eval/PLAN.md` have uncommitted edits unrelated to the roadmap; leave `EMAIL-TO-CLIENT.md` alone.
- Phase 1 changes metric definitions, so baseline comparisons need a re-grade under the new harness.

## Session Continuity

Last session: 2026-11-21T05:48:25.776Z
Stopped at: Completed 01-07-PLAN.md (push pending approval)
Resume file: None
