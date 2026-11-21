# Article Group Concierge: owner-ready quality milestone

## What This Is

The Article Group (AG) AI Concierge is a RAG chat app (Next.js on Vercel, Supabase pgvector,
Claude via OpenRouter) that answers prospective clients' questions about AG's work. It
retrieves AG case studies and returns a generated layout of components (hero, case-study
teasers, metrics, video, CTA). This milestone makes it ready to show AG's owner, who is
very detail-oriented.

## Core Value

**Never misrepresent AG's work.** A wrong claim about a client engagement is worse than a
weak answer. Every claim about a client, outcome, metric or capability must be supported
by indexed content.

## Requirements

### Validated

<!-- Existing, shipped capabilities (brownfield). -->

- ✓ Chat API (`/api/chat`) returns an orchestrated component layout from retrieved case studies — existing
- ✓ Hybrid search (`hybrid_search`: semantic + keyword) over 43 case studies, one chunk each — existing
- ✓ Case-study detail pages with PDF, thumbnails and video playback — existing
- ✓ Upstream errors classified and surfaced as retryable messages — existing
- ✓ Eval harness (`npm run eval`: generate → run → grade → report) with Opus 5.5 judge — Phase 0 (`a5b2722`)
- ✓ All model calls (Sonnet 5.5 generation, text-embedding-3-small) routed through OpenRouter in local, eval and production — Phase 0

### Active

- [ ] Eval measures what matters reliably: normalised numbers, unsupported claims by kind, no persona leakage to the grader, config-driven Strategy Lead rule, N runs with mean and spread, optional second grader with an agreement score
- [ ] Every piece of AG work on articlegroup.com is in the index, articles are embedded and retrievable, the taxonomy is accurate, and every video matches its case study
- [ ] Retrieval finds the expected case studies (≥ 90% recall) via `hybrid_search_v2`
- [ ] Generation is honest: no goals stated as results, no invented capabilities or tags, invention-bait handled, "we" voice, Strategy Lead offered where configured
- [ ] Fast first content: teasers on screen in about 1.5 s, streamed hero in about 3–4 s
- [ ] A documented before/after across three runs that clears the ready bar, plus five demo queries

### Out of Scope

- Changing the generation model (Sonnet 5.5) or the eval judge model (Opus 5.5): the user fixed these
- Replacing `hybrid_search` in place: production shares the Supabase project, so changes go in `hybrid_search_v2` alongside it
- A reranker or query rewriting, unless recall is still under 90% after the Phase 3 retrieval fixes
- A verifier/second-pass generation step, unless unsupported claims stay at 5 or more of 50 after the Phase 4 prompt fix (latency cost)
- New UI features beyond what quality and speed need

## Context

The full verified findings are in `eval/PLAN.md` (sections "Verified findings" and "Agreed
adjustments"). Summary:

- **Index:** 43 case studies, one ~850-char chunk each. 50 articles have zero chunks, so
  they are never retrieved. `document_metrics` and `visual_assets` are empty. The taxonomy is
  coarse (39/43 tagged "technology").
- **Retrieval:** the live function is in `supabase/migrations/003_pdf_first_ui_restructure.sql`.
  - `plainto_tsquery` ANDs all terms, and keyword scoring only runs inside the top
    `match_count*3` semantic hits.
  - The semantic and keyword score scales don't match (70/30 blend), and the 0.15 cutoff
    acts as a semantic floor.
  - `detectQueryIntent` matches substrings ("ai" inside "maintain"), and most of its slugs
    don't exist in the DB.
- **Generation:** the prompt forbids admitting gaps, and teaser tags are invented because
  `formatContext` has no per-study tags. The Strategy Lead is never named. Output is
  non-streaming (~5.8k chars); `orchestrateStream` exists but is unused.
- **Eval:** the grader sees the persona, which the app never receives. The rubric's
  component count and CTA rules differ from the prompt. Metrics aren't normalised.
- **Data:** the Google cross-product study likely has the wrong video. The Simons
  Foundation education work and the Salesforce partner-ecosystem work are missing from the index.

**Baseline (frozen):** run `eval/results/2026-11-20T15-12-31`, code `a5b2722`.
grounded 4.44 · components 4.94 · fallback 4.50 · cta 4.36 · voice 3.92 · hallucinations 0/50 ·
unsupported claims in 22/50 responses (38 claims) · expected case-study recall 39/52 (75%) ·
median latency 20.2 s (9.7–28.9 s).

**Ready bar (all must hold across three consecutive runs):** recall ≥ 90% · site work
missing from index 0 · goals stated as results 0 · invention-bait presupposed 0 ·
capabilities claimed but not shown 0 · responses with any unsupported claim < 5/50 ·
voice ≥ 4.5 · first content < 2 s (teasers < 1.5 s, hero 3–4 s) · mismatched videos 0.

## Constraints

- **Models:** the generation model stays Sonnet 5.5 and the eval judge stays Opus 5.5 — user decision
- **Process:** one phase at a time. After each phase, rerun the eval, report the deltas against
  the baseline, and squash the phase into one commit before pushing — user rule
- **Evidence:** verify hypotheses against code and data before acting. Check current docs
  before choosing external products, APIs or model names (rerankers, OpenRouter prompt
  caching, embedding models) — user rule. Per-phase research is off by default; enable it
  for the phases that pick external products (3–5).
- **Database safety:** ask before any destructive DB change or full re-index. Production shares
  the Supabase project, so add new functions alongside the old ones, never replace them in place.
- **Budget:** the OpenRouter key has a $50 cap (about $45 left after Phase 0). One eval run
  costs ~$3.50; three runs plus the second grader cost ~$12 per phase.
- **Eval debug mode:** `/api/chat` honours `debug: true` only when `EVAL_DEBUG=true`, which must never be set in production.
- **Supabase free tier:** the project pauses after inactivity and must be restored before eval runs.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Commit the eval harness + OpenRouter routing as the baseline (Phase 0) | Reproducible measurement before any change | ✓ Good (`a5b2722`, prod verified) |
| Route production through OpenRouter too | The eval must measure the same route as production | ✓ Good (verified by key usage) |
| Embed all 50 articles | They contain relevant info and are currently unretrievable; it only adds rows | — Pending |
| `hybrid_search_v2` alongside `hybrid_search` | Shared Supabase project; replacing in place changes the live site | — Pending |
| Fallback grading = honest reframing; keep `would_strict_pass_fallback` | Honesty over forced positivity | — Pending |
| The concierge may say AG hasn't done a kind of work, then show the closest work (config flag) | Core value: no misrepresentation | — Pending (assumed yes) |
| Offer a Strategy Lead conversation on fallback, pricing and timeline queries (config flag) | Clear next step for prospects | — Pending (assumed yes) |
| Remove the persona from the grader | The app never sees the persona, so the grader shouldn't either | — Pending |
| Run through GSD: research off, test-coverage checker off, plan check + verifier on, sequential, balanced models, no auto-advance | Findings are already verified; the user wants a report per phase | ✓ Adopted 2026-11-20 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-20 after initialization (seeded from eval/PLAN.md)*
