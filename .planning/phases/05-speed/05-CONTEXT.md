# Phase 5: Speed - Context

**Gathered:** 2026-11-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Prospects see real content right away instead of waiting about 20 s. Phase 5 delivers four things:

- **PERF-01:** retrieved case-study teasers on screen in about 1.5 s.
- **PERF-02:** the generated HeroBlock streams in and starts showing within about 3-4 s, using the streaming path.
- **PERF-03:** a health check that confirms the provider route (OpenRouter) and the remaining credit, and fails clearly when either is wrong.
- **Phase-end eval:** latency deltas against the frozen baseline, with evidence that quality did not regress.

Out of scope: new UI features beyond what streaming needs, prompt or content changes aimed at the Phase 4 gaps (goal_as_result 2, claims 6/50, voice 4.36, p4-q03 Strategy Lead), and turning the verifier on. Phase 6 returns to earlier phases if a ready-bar check fails.

</domain>

<decisions>
## Implementation Decisions

### Instant teasers (PERF-01)
- **D-501:** Show the top few retrieved case studies, in retrieval order, as teasers immediately after retrieval and before the model speaks. The count lives in `src/lib/concierge-config.ts` (default 3). When the model's layout arrives, reconcile:
  - keep the instant teasers the model also chose, in the model's order;
  - add teasers the model chose that weren't shown;
  - remove the ones it didn't choose.

  The D-307 padding guard and the relevant_only teaser rule (RETR-05) apply to the final layout, unchanged.
- **D-502:** An instant teaser uses DB data only: title, client, DB-linked capability/industry tags (same source as GEN-03), thumbnail if available, and the DB `deliverables` line verbatim as the summary. When the model's tailored summary arrives, it replaces the DB line. If a study has no deliverables line, show the card without a summary until the model's arrives. The model's teaser summaries stay (D-403 honesty rules still apply to them).
- **D-503:** Instant teasers render in their final layout slots. Space for the HeroBlock is reserved above them, so nothing jumps when the hero and the other components arrive. Keep layout shift minimal.
- **D-504:** No-match and fallback queries show only the loading state until the streamed hero arrives, never unexplained adjacent teasers. **Caveat for research and planning:** retrieval has no score cutoff (Phase 3), so it almost always returns studies. The trivial "zero chunks" signal won't catch fallback queries. Find a deterministic pre-model signal that suppresses instant teasers, for example:
  - a retrieval score floor;
  - the `isAboutAG` / intent result;
  - a top-RRF margin.

  Calibrate it on the eval's `fallback_expected` and invention_bait queries, and report both the suppression rate on those queries and the false-suppression rate on direct-match queries. Invention-bait queries must not show instant teasers that look like confirmation of the asserted work.

### Hero streaming and output (PERF-02)
- **D-505:** No prompt or output-format change. Keep the current output (JSON layout block first, then the narrative, then follow-ups), and parse the JSON incrementally as it streams. Emit each component to the client the moment it is complete, and stream the HeroBlock's text fields while they are being written. Wire up `orchestrateStream` (`src/lib/orchestrator.ts`), which is unused today. It must apply `postProcessOutput` (GEN-03 server-side tags, internal-key stripping), the same catalogue cache block and the same orchestrator cache as `orchestrate()`.
- **D-506:** Hero text and the narrative type in progressively as tokens arrive. Other components (StrategyCard, VideoPlayer, MetricGrid, teaser summary swaps) appear when complete.
- **D-507:** If the stream fails after content is on screen, keep what has rendered and add the existing classified, retryable error message below it. Do not clear the partial deck.
- **D-508:** The verifier stays off. Phase 5 only makes sure the streaming path still honours `verifierEnabled()`. If it is ever turned on, it runs as a post-pass after the stream completes and stays off the first-content path (D-419). No verifier eval spend in this phase.
- **D-509:** Keep the existing JSON `/api/chat` contract working, for rollback and for any non-streaming caller. The streaming path is added alongside it, not as a replacement in place. `EVAL_DEBUG` gating applies unchanged: the debug payload is only sent when the request asks for it AND `EVAL_DEBUG=true`, and it must never be set in production.

### Measuring speed (eval)
- **D-510:** The eval runner consumes the same streaming response that production uses. It records these per-query timestamps from request start:
  - `t_teasers_ms`: first instant teaser event;
  - `t_hero_first_ms`: first hero text;
  - `t_hero_done_ms`: hero complete;
  - `t_complete_ms`: full response, which keeps the existing `latency_ms` meaning.

  The debug payload arrives as a final stream event. Quality grading runs on the final reconciled layout, so it grades exactly what prospects end up with.
- **D-511:** PERF-01/02 pass if, over the 50 queries, median `t_teasers_ms` ≤ 1500 and median `t_hero_first_ms` ≤ 4000. p90 and max are reported but don't gate. Queries with no instant teasers by design (D-504) are excluded from the teaser median and counted separately.
- **D-512:** Add a diagnostic: the share of instant teasers later removed by the model (the "flash rate"), plus the D-504 suppression rates. It is reported, not gated.
- **D-513:** No-regression bar (success criterion 4), measured against the Phase 4 run `2026-11-22T22-48-20`. Any one of these counts as a regression:
  - goal_as_result > 2;
  - invention_bait_presupposed > 0;
  - capability_not_shown > 0;
  - unsupported-claim responses > 6/50;
  - frozen-label recall < 47/52;
  - a D-307 guard failure;
  - voice or grounded down more than 2 SD of the measured noise (re-graded-baseline noise: grounded SD 0.16, voice SD 0.04).

  The report also lists every metric's delta against frozen baseline `2026-11-20T15-12-31`, including latency.
- **D-514:** Budget. The user tops up OpenRouter credit before the phase-end eval (current credit $5.39; Phase 6 needs about $12 anyway). Iterate with free checks: unit tests, and a local stream-timing script over a handful of queries costing cents. Then run ONE full eval at phase end, with preflight first and Supabase restored if it has paused. No second grader.

### Health check (PERF-03)
- **D-515:** Write one shared check function. It reports:
  - provider route (must be `openrouter`);
  - generation and embedding model IDs;
  - whether the OpenRouter key is present and valid (`/api/v1/key`);
  - remaining credit and limit;
  - status `ok` / `warn` / `fail`, with a plain-language reason.

  It is used by:
  - the admin-protected `/api/health` route, added to its existing response;
  - a one-time check at server start (`src/instrumentation.ts`, nodejs runtime) that logs a loud warning on warn or fail;
  - the eval preflight (`eval/preflight.ts` already has the credit logic, so reuse it rather than duplicate it).

  Credit figures are never exposed on a public endpoint.
- **D-516:** Report only. A failing check never blocks chat by itself. If a model call then fails, the existing `classifyError` messages handle it.
- **D-517:** Thresholds, set in config: `warn` below $5 remaining (about one eval run); `fail` at or below $0, on an invalid or missing key, or on a route that isn't OpenRouter. The startup check must not delay serving: it runs without blocking, with a short timeout, and an OpenRouter timeout reports `warn`, not `fail`.

### Claude's Discretion
- Transport: SSE or NDJSON over `fetch`, the event names and the payload shapes. Choose them from current Next.js / Vercel streaming docs and OpenRouter streaming docs (research is on for this phase).
- Whether the streaming path is a new route (e.g. `/api/chat/stream`) or content negotiation on `/api/chat`, as long as D-509 holds.
- The incremental JSON parser: a small library or hand-rolled. It must tolerate the json code fence and malformed output, and fall back to the existing whole-response parse at the end.
- How orchestrator-cache hits are emitted on the stream (e.g. all events at once).
- The D-504 signal design and threshold, within the calibration requirement above.
- Thumbnail source for instant teasers, skeleton/loading visuals, and the reserved hero height.
- Ordering work that shortens time-to-teasers: run catalogue load, embedding and retrieval in parallel where possible, and emit teasers before the model call starts.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 5: goal, success criteria, research enabled, `EVAL_DEBUG` constraint
- `.planning/REQUIREMENTS.md`: PERF-01, PERF-02, PERF-03
- `.planning/PROJECT.md`: core value (never misrepresent AG's work), ready bar, constraints (models fixed, budget, squash per phase)
- `eval/PLAN.md` § Agreed adjustments item 5: origin of the 1.5 s teasers / 3-4 s hero bar

### Prior decisions that constrain this phase
- `.planning/phases/03-retrieval/03-CONTEXT.md`: D-302 relevant-only teasers, D-305/D-307 cap 8 and padding guard
- `.planning/phases/04-generation/04-CONTEXT.md`: D-403 honesty on teaser summaries, D-417..D-420 verifier and D-419 first-content rule, GEN-03 server-side tags
- `.planning/phases/04-generation/04-EVAL-DELTA.md`: Phase 4 run `2026-11-22T22-48-20` figures, which are the D-513 no-regression baseline
- `.planning/phases/04-generation/04-VERIFIER.md`: why the verifier ships disabled

### Code touchpoints
- `src/app/api/chat/route.ts`: current JSON route, debug gating, `classifyError`
- `src/lib/orchestrator.ts`: `orchestrate()`, the unused `orchestrateStream()`, `parseOrchestratorResponse`, `buildSystemBlocks`, the orchestrator cache
- `src/lib/layout-postprocess.ts`: `postProcessOutput` (must run on the stream path)
- `src/lib/catalogue.ts`: `CatalogueRow` (title, client, tags, `deliverables`) as the data for instant teasers
- `src/lib/supabase.ts`: `retrieveContext` (RRF order, caps), the source of instant teasers and of the D-504 signal
- `src/lib/concierge-config.ts`: home for the instant-teaser count, D-504 threshold and health thresholds
- `src/app/page.tsx`, `src/components/LayoutRenderer.tsx`, `src/components/CaseStudyTeaser.tsx`, `src/components/HeroBlock.tsx`: client rendering
- `src/app/api/health/route.ts`, `src/lib/admin-auth.ts`, `src/instrumentation.ts`, `src/lib/llm-config.ts` (`providerRoute`): health check (PERF-03)
- `eval/run.ts`, `eval/lib.ts` (`latency_ms`), `eval/metrics.ts`, `eval/report.ts`, `eval/preflight.ts` (OpenRouter credit check): eval changes

### External docs to check (research)
- OpenRouter streaming (SSE, usage in the final chunk, prompt caching with `cache_control` while streaming)
- Next.js App Router route-handler streaming on Vercel (Node runtime, `maxDuration`, buffering)
- Anthropic SDK version in use (0.30.1) and its `messages.stream` behaviour through OpenRouter

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `orchestrateStream()` already streams text deltas with the cached catalogue block. It lacks the orchestrator cache, `postProcessOutput`, usage capture and the verifier flag.
- `catalogue.ts` already loads title, client, tags and `deliverables` for every case study. That is enough data for instant teasers with no extra query.
- `eval/preflight.ts` already calls OpenRouter `/api/v1/key` and computes remaining credit. Lift it into a shared module for PERF-03.
- `classifyError` in the chat route already gives retryable, user-facing messages (D-507, D-516).

### Established Patterns
- Shared config in `src/lib/concierge-config.ts` drives both the prompt and the rubric. New knobs (instant teaser count, suppression threshold, health thresholds) go there.
- Additive changes alongside existing paths, never in-place replacement (DB rule, extended here to the JSON route, D-509).
- Debug payload only under `EVAL_DEBUG=true` plus `debug: true`.

### Integration Points
- The chat route currently runs `retrieveContext` and then `orchestrate`, sequentially. Instant teasers can be emitted between the two steps.
- `page.tsx` does a single `fetch('/api/chat')` and renders `LayoutRenderer` once the response arrives. It needs incremental state and reconciliation.
- `getCatalogue()` runs before the orchestrator cache lookup (a cold-start DB cost noted in code). It is a time-to-teasers consideration.

</code_context>

<specifics>
## Specific Ideas

- "Honest from the first frame": instant teasers carry only verbatim DB text, so nothing the prospect sees before the model speaks can be a claim the model hasn't vetted.
- Nothing on screen should look like confirmation of invention-bait or fallback queries before the model has framed them honestly (D-504).

</specifics>

<deferred>
## Deferred Ideas

- Re-evaluating the GEN-07 verifier as an async patch pass (declined for this phase, D-508).
- Blocking chat when the health check fails (declined, D-516).
- Making DB deliverables the permanent teaser summary, with the model no longer writing summaries. Considered as a way to cut unsupported claims, but not chosen. Phase 6 can revisit it if teaser-summary claims block the ready bar.

</deferred>

---

*Phase: 05-speed*
*Context gathered: 2026-11-23*
