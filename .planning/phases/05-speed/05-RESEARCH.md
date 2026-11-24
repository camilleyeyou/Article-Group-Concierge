# Phase 5: Speed - Research

**Researched:** 2026-11-23
**Domain:** LLM response streaming (OpenRouter, Anthropic Messages API), Next.js 14 route-handler streaming on Vercel, progressive client rendering, latency measurement in the eval harness, provider/credit health check
**Confidence:** MEDIUM overall (HIGH on repo facts and Sonnet 5.5 thinking behaviour; MEDIUM on OpenRouter's Anthropic-endpoint stream shape, which could not be exercised without spending credit)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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
- **D-505:** No prompt or output-format change. Keep the current output (JSON layout block first, then the narrative, then follow-ups), and parse the JSON incrementally as it streams. Emit each component to the client the moment it is complete, and stream the HeroBlock's text fields while they are being written. Wire up `orchestrateStream` (`src/lib/orchestrator.ts`), which is unused today. It must apply `postProcessOutput` (GEN-03 server-side tags, internal-key stripping), the same catalogue cache block and the same orchestrator cache as `orchestrate()`.
- **D-506:** Hero text and the narrative type in progressively as tokens arrive. Other components (StrategyCard, VideoPlayer, MetricGrid, teaser summary swaps) appear when complete.
- **D-507:** If the stream fails after content is on screen, keep what has rendered and add the existing classified, retryable error message below it. Do not clear the partial deck.
- **D-508:** The verifier stays off. Phase 5 only makes sure the streaming path still honours `verifierEnabled()`. If it is ever turned on, it runs as a post-pass after the stream completes and stays off the first-content path (D-419). No verifier eval spend in this phase.
- **D-509:** Keep the existing JSON `/api/chat` contract working, for rollback and for any non-streaming caller. The streaming path is added alongside it, not as a replacement in place. `EVAL_DEBUG` gating applies unchanged: the debug payload is only sent when the request asks for it AND `EVAL_DEBUG=true`, and it must never be set in production.
- **D-510:** The eval runner consumes the same streaming response that production uses. It records these per-query timestamps from request start:
  - `t_teasers_ms`: first instant teaser event;
  - `t_hero_first_ms`: first hero text;
  - `t_hero_done_ms`: hero complete;
  - `t_complete_ms`: full response, which keeps the existing `latency_ms` meaning.

  The debug payload arrives as a final stream event. Quality grading runs on the final reconciled layout, so it grades exactly what prospects end up with.
- **D-511:** PERF-01/02 pass if, over the 50 queries, median `t_teasers_ms` <= 1500 and median `t_hero_first_ms` <= 4000. p90 and max are reported but don't gate. Queries with no instant teasers by design (D-504) are excluded from the teaser median and counted separately.
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

### Deferred Ideas (OUT OF SCOPE)

- Re-evaluating the GEN-07 verifier as an async patch pass (declined for this phase, D-508).
- Blocking chat when the health check fails (declined, D-516).
- Making DB deliverables the permanent teaser summary, with the model no longer writing summaries. Considered as a way to cut unsupported claims, but not chosen. Phase 6 can revisit it if teaser-summary claims block the ready bar.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Retrieved teasers are on screen in about 1.5 s | Instant-teaser event emitted between retrieval and model call; catalogue already holds tags and deliverables (no extra query); catalogue load and retrieval run concurrently; D-504 suppression signal calibrated offline on Phase 4 run (below); eval runs with `debug` so it measures cold, cache-bypassed retrieval (conservative) |
| PERF-02 | Hero streams in and starts showing within about 3-4 s via the streaming path | Anthropic-format SSE through OpenRouter; incremental layout parser; **thinking is the blocker** (about 2/3 of output tokens in the Phase 4 run were thinking): default adaptive thinking at effort `high` cannot reach the 4 s bar; `thinking: {type: 'between_tools'}` is the documented lever, gated by the D-513 no-regression eval |
| PERF-03 | Startup/health check confirms OpenRouter route and remaining credit, fails clearly | `GET /api/v1/key` works with a normal key (`/api/v1/credits` needs a management key and returns 403); shared `checkProviderHealth()` reused by `/api/health`, `instrumentation.ts` and `eval/preflight.ts`; `limit_remaining` is a key budget, not the account balance |
</phase_requirements>

## Summary

The streaming plumbing is routine: the repo already calls OpenRouter through the Anthropic SDK (0.30.1) against `https://openrouter.ai/api` with `authToken`, and `anthropic.messages.create({ stream: true })` returns the raw Anthropic-format SSE events. A Next.js 14 Node-runtime route handler returning `new Response(ReadableStream)` streams on Vercel with no special setup (Node streaming is on by default there). The real work is the incremental layout parser, the event protocol, client reconciliation, eval timing fields and the shared health check.

**The finding that changes the plan: PERF-02 is not reachable by streaming alone.** Sonnet 5.5 "thinks adaptively on every request" at default effort `high`, thinking cannot be disabled through OpenRouter (400 on `reasoning.enabled:false`, `effort:"none"` and Messages `thinking:{type:"disabled"}`), and the thinking tokens come before the first visible token. The saved Phase 4 run (`2026-11-22T22-48-20`, 50 records) shows median 2,022 output tokens against a visible response of about 690 tokens (median 2,743 characters of model text divided by 4), so roughly two thirds of generated tokens are thinking. At the observed ~119 tokens/s that is about 10 s of silent thinking before `"HeroBlock"` can appear. With retrieval on top, the first hero text lands near 11-12 s, not 3-4 s. The documented lever is `thinking: {"type": "between_tools"}` (no up-front thinking, accepted at effort `high` or below), or a lower `output_config.effort`. This is a generation-parameter change, not a model change (Sonnet 5.5 stays), and it is not a prompt or output-format change (D-505), but it can move quality, so it must be an explicit config knob, measured with the cheap timing script first, and gated by the D-513 eval. This needs the user's awareness: see Open Questions 1.

For PERF-01, instant teasers need only data already in memory (retrieved chunks plus the catalogue's tags and deliverables). The D-504 suppression problem is real: an offline calibration on the saved Phase 4 retrieval snapshots (free) shows no single score separates fallback and invention-bait queries from direct matches without suppressing a large share of direct queries. A two-part signal is recommended: a semantic-score floor plus a deterministic "claim of prior work" query pattern for invention bait.

**Primary recommendation:** Add a new `POST /api/chat/stream` route (SSE framing, Node runtime, `dynamic = 'force-dynamic'`) that emits `teasers` then `hero`/`component`/`narrative` events then an authoritative `final` event; consume the raw Anthropic SSE through `messages.create({stream:true})`; make Sonnet 5.5's thinking mode a config knob and measure `between_tools` against adaptive in a cents-priced timing script before the one full eval.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.30.1 (installed; keep) | Call OpenRouter's Anthropic-compatible endpoint; `messages.create({stream:true})` yields raw SSE events | Already used by `orchestrate()`; no upgrade needed. Raw events keep unknown fields (OpenRouter `usage.cost`) that the SDK's `MessageStream` accumulator would drop |
| Next.js | 14.2.10 (installed) | Route handler returning a `ReadableStream` `Response` | Node-runtime streaming is supported on Vercel; no framework change |
| Web `fetch` + `ReadableStream` reader | platform | Client and eval consume the stream (POST body means `EventSource` is not usable) | No dependency |
| `node:test` via `tsx --test` | existing (`npm run eval:test`) | Unit tests for parser, signal, health | Existing test infrastructure |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none new | | Incremental JSON parser is hand-rolled (about 100-150 lines, pure, unit-tested) | See Don't Hand-Roll rationale |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled layout scanner | `partial-json` 0.1.7 (21 KB, last published 2024-05-14) | Works, but unmaintained; still needs custom logic for "component complete" and fence handling. Acceptable fallback if the scanner proves buggy |
| Hand-rolled layout scanner | `best-effort-json-parser` 1.5.1 (published 2026-06-26) | Maintained, but best-effort repair semantics are the opposite of what an honesty-first product wants for completed components |
| `messages.create({stream:true})` | `messages.stream()` (SDK MessageStream) | Accumulator ignores `thinking` deltas and drops OpenRouter-specific usage fields; no benefit here |
| Vercel AI SDK (`ai`) | | Would change the provider client and event model; Vercel recommends it but it is a replacement, not an addition (D-509 spirit) |
| NDJSON framing | SSE framing | Both work over `fetch`. SSE with `Content-Type: text/event-stream` is the content type Vercel's own docs use and proxies/CDNs most reliably leave unbuffered. Recommend SSE |

**Installation:** no new packages.

**Version verification:** `npm view partial-json version` gives 0.1.7 (modified 2024-05-14); installed `@anthropic-ai/sdk` is 0.30.1 (read from `node_modules`); Next 14.2.10 and `@sentry/nextjs` 10.45.0 from `package.json`/`node_modules`.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/api/chat/route.ts            # UNCHANGED JSON contract (D-509); extract shared helpers instead of editing behaviour
├── app/api/chat/stream/route.ts     # NEW: SSE route (Node runtime, force-dynamic, maxDuration 60)
├── app/api/health/route.ts          # add checkProviderHealth() result to existing JSON
├── instrumentation.ts               # add non-blocking startup check (nodejs runtime only)
├── lib/orchestrator.ts              # orchestrateStream() becomes a typed-event async generator; share cacheKey + request builder with orchestrate()
├── lib/stream-layout-parser.ts      # NEW pure incremental parser (unit-tested)
├── lib/stream-events.ts             # NEW event types + SSE encode/decode (shared by route, page.tsx, eval)
├── lib/instant-teasers.ts           # NEW: build teaser props from chunks + catalogue; D-504 suppression signal
├── lib/provider-health.ts           # NEW shared checkProviderHealth(); eval/preflight.ts imports it
├── lib/concierge-config.ts          # new knobs: instantTeasers {count, semanticFloor, claimPattern}, generation {thinking, effort}, health thresholds
├── lib/catalogue.ts                 # expose deliverablesBySlug on Catalogue WITHOUT changing formatCatalogue() output
├── app/page.tsx                     # streaming reducer + incremental rendering
eval/
├── run.ts / lib.ts                  # stream consumer, t_* timestamps on RunRecord
├── metrics.ts / report.ts           # speed block, flash rate, suppression rates, METRIC_ROWS entries
├── stream-timing.ts                 # NEW cents-priced local timing script (D-514)
└── *.test.ts                        # new unit tests
```

### Pattern 1: New route, raw Anthropic SSE, typed event stream out

**What:** `/api/chat/stream` does rate-limit check, validation (reuse), then in one `ReadableStream`:
1. start `getCatalogue()` and `retrieveContext()` concurrently (`Promise.all`; `getCatalogue` never throws, it returns the memo or null);
2. compute the D-504 decision and emit `teasers` (or `suppressed`) immediately;
3. orchestrator cache lookup (same `cacheKey`); on a hit emit the whole result as events back-to-back and finish;
4. otherwise call `anthropic.messages.create({..., stream: true}, { signal })` and feed text deltas to the parser, emitting `hero`, `component`, `narrative` events;
5. on completion run `parseOrchestratorResponse` + `postProcessOutput` (the existing whole-response path) and emit an authoritative `final` event; then cache the result exactly like `orchestrate()`;
6. on error emit `error` with `classifyError` fields (`explanation`, `errorCode`, `retryable`, `contactCTA`).

**When to use:** always for production chat once the client is switched; the JSON route stays for rollback and non-streaming callers.

**Why a new route rather than content negotiation:** the JSON route has typed error status codes (429, 400, 503) that eval and `page.tsx` rely on; a separate route keeps D-509 trivially true and lets rollback be a one-line client change. Share `classifyError` by moving it to `src/lib/chat-errors.ts` (pure move, no behaviour change).

**Example:**
```typescript
// Source: Vercel streaming docs (https://vercel.com/docs/functions/streaming-functions) + repo patterns
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const limited = rateLimiter.check(request, RATE_LIMITS.CHAT);   // returns a normal JSON 429 before streaming
  if (limited) return limited;
  // ...validate body exactly as the JSON route does; return plain JSON 400s here too

  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort());   // client gone: stop upstream (stops billing on supported providers)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encodeSse(e));
      try { /* teasers, orchestrateStream(...) events, final */ }
      catch (err) { send({ type: 'error', ...classifyError(err) }); }
      finally { controller.close(); }
    },
    cancel() { abort.abort(); },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### Pattern 2: Raw SSE from OpenRouter via the Anthropic SDK (keep SDK 0.30.1)

**What:** iterate raw events, handle only `message_start` (input/cache usage), `content_block_delta` with `delta.type === 'text_delta'` (feed parser), `message_delta` (output tokens, `stop_reason`, and OpenRouter's `usage.cost` if present), `error`. Ignore `thinking_delta`, `signature_delta`, `ping`.

```typescript
// Source: Anthropic Messages streaming format; OpenRouter /api/v1/messages create-a-message docs
const events = await anthropic.messages.create(
  { model: MODEL, max_tokens: MAX_TOKENS, system: buildSystemBlocks(catalogue?.text ?? null) as any,
    messages, stream: true, ...generationParams() /* thinking / output_config, cast as any: SDK 0.30.1 types lack them */ },
  { signal: abort.signal },
);
for await (const ev of events) {
  if (ev.type === 'message_start') usage = { ...usage, ...(ev.message.usage as object) };
  else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') parser.push(ev.delta.text);
  else if (ev.type === 'message_delta') usage = { ...usage, ...(ev.usage as object) /* may carry cost */ };
}
```
Treat "stream ended with HTTP 200 but no text" and `stop_reason: 'max_tokens'` with no text as failures (OpenRouter documents that a 200 can carry only an error, and thinking shares `max_tokens`).

### Pattern 3: Incremental layout parser (pure module)

**What:** state machine over the accumulated text:
1. wait for the opening fence (` ```json `) or a bare `{`; tolerate leading prose;
2. find `"layout"` then the array; track brace/bracket depth and string/escape state to find the end of each top-level item object;
3. when an item closes, `JSON.parse` that slice; emit `component` (complete, never partial) in layout order;
4. for item 0 when `component === "HeroBlock"`, scan its `props` for `"title"`, `"subtitle"`, `"challengeSummary"` and emit the partial (unterminated) string value so far, correctly decoding escapes and holding back an incomplete trailing escape (`\`, `\u12`); emit `hero_done` when the item closes;
5. after the closing fence, everything is narrative: emit deltas but hold back any suffix that could be the start of the follow-up marker (`**Want to explore`, `Follow-up questions:`) so follow-up text never appears in the narrative;
6. on any structural surprise, stop emitting and let the end-of-stream whole-response parse (`parseOrchestratorResponse`) be authoritative.

**Contract:** streamed events are a progressive preview; the `final` event is the truth and the client replaces its state wholesale with it. The parser must never be the only source of the final layout.

### Pattern 4: Event protocol (recommended)

SSE frames `event: <type>\ndata: <json>\n\n`. Events:

| Event | Payload | Notes |
|-------|---------|-------|
| `teasers` | `{ items: CaseStudyTeaserProps[] }` | Instant teasers (D-501/502): title, clientName, DB tags, thumbnailUrl, slug, `summary` = DB deliverables or omitted |
| `suppressed` | `{ reason: 'score_floor' \| 'claim_pattern' \| 'no_context' }` | D-504; lets eval count suppression without inference |
| `hero` | `{ title?, subtitle?, challengeSummary?, backgroundVariant? }` | Cumulative partial values; first occurrence = `t_hero_first_ms` |
| `hero_done` | `{ props }` | `t_hero_done_ms` |
| `component` | `{ index, component, props }` | Complete component (StrategyCard, VideoPlayer, MetricGrid, teaser with tailored summary). Teaser props already server-tagged (apply `applyServerTeaserTags` per item) |
| `narrative` | `{ text }` | Delta |
| `final` | `OrchestratorOutput` public fields | Authoritative; client reconciles to it; eval grades it |
| `debug` | debug payload | Only when `body.debug === true && EVAL_DEBUG === 'true'`; sent before `final` or as the last event |
| `error` | `{ explanation, errorCode, retryable, contactCTA }` | Sent mid-stream or before content; UI-SPEC requires `retryable` and `contactCTA` |
| `: ping` comment | | Optional keepalive; SSE clients ignore lines starting with `:` |

Teaser props emitted on `component` events must have capabilities/industries overwritten from the catalogue (`applyServerTeaserTags`), identical to the final layout, so a streamed teaser never shows model-invented tags.

### Pattern 5: Client reducer and reconcile

`page.tsx` gets one `streaming` message state updated by a reducer: `{ instantTeasers, hero, heroDone, components[], narrative, final, error }`. Rendering reuses `HeroBlock`, `CaseStudyTeaser` and `LayoutRenderer` grid classes per `05-UI-SPEC.md`. Reconcile on `final`: order teasers by the model's layout, key by slug (stable keys keep focus), remove unchosen with the 150 ms opacity fade. Persist only the `final` layout to `messages`/localStorage (so history never stores partial state). On `error` after content: keep partial state, set the existing `error` banner (`retryable` gates "Try again").

### Pattern 6: Eval consumes the stream and records timestamps

`eval/lib.ts` gets `consumeChatStream(res, t0)` that parses SSE frames and records `performance.now()` offsets on first `teasers`/`suppressed`, first `hero`, `hero_done`, `final`. `RunRecord` gains `t_teasers_ms`, `t_hero_first_ms`, `t_hero_done_ms`, `t_complete_ms`, `instant_teaser_slugs`, `suppressed`. `latency_ms` is set equal to `t_complete_ms` so existing metrics, `report.ts` and the baselines keep meaning. Pre-stream HTTP errors (429, 400) come back as plain JSON and are handled by the existing status branch (keep the 60 s 429 retry).

### Anti-Patterns to Avoid

- **Editing `formatCatalogue()` or `SYSTEM_PROMPT` to carry instant-teaser data.** Either changes `catalogueVersion` and breaks the 1 h prompt-cache prefix (Phase 4 had cache hits on 50/50 queries). Expose `deliverablesBySlug` as a new field on `Catalogue` instead.
- **Streaming partial StrategyCard/MetricGrid/VideoPlayer props.** Honesty risk (a half-written metric on screen). Components appear whole (D-506 already says so).
- **Treating streamed text as final.** The final event replaces it; eval grades `final`.
- **Letting the verifier mutate text already on screen.** With the verifier off this does not arise; if enabled later it must patch via an explicit event after `final`, not rewrite silently (D-508/D-419).
- **Setting `EVAL_DEBUG` anywhere but local `.env.local`.** Same gate in the new route (copy the exact expression).
- **Using `/api/chat` `GET` for health.** It is public by design (eval preflight uses it as a liveness probe); credit data goes only to the admin-protected `/api/health`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error classification for the stream | A second `classifyError` | Move the existing one to a shared module | UI-SPEC and D-507 require the identical messages and `retryable` semantics |
| Final parse + GEN-03 tags + raw-response re-render | A stream-side reimplementation | Run `parseOrchestratorResponse` + `postProcessOutput` on the full text at stream end | One code path decides what the user ends up with, and what the eval grades |
| OpenRouter key/credit logic | New fetch code | Lift `checkOpenRouter` from `eval/preflight.ts` into `src/lib/provider-health.ts`; preflight imports it back | D-515 explicitly says reuse |
| Orchestrator cache key | A new key shape | Extract the existing `cacheKey` builder from `orchestrate()` and call it from both paths | Streamed and JSON results must hit the same cache entries |
| Prompt-cache breakpoints | New `cache_control` placement | `buildSystemBlocks()` unchanged | Same prefix means the same cache hits |
| Rate limiting | New limiter | `rateLimiter.check(request, RATE_LIMITS.CHAT)` | Same quota for both routes |
| Hero skeleton height / motion | New tokens | `05-UI-SPEC.md` values | Approved contract |

**Key insight:** the dangerous part of this phase is not moving bytes, it is keeping a single authority for "what the prospect ends up seeing" (the `final` event built by the existing post-processing) while a preview streams ahead of it.

## Runtime State Inventory

Omitted: this is not a rename/refactor/migration phase. No stored data, registrations or secrets change names. (Environment variables are only read, never renamed.)

## Common Pitfalls

### Pitfall 1: Default adaptive thinking makes the 3-4 s hero target unreachable
**What goes wrong:** the stream opens fast but nothing visible arrives for about 10 s; `t_hero_first_ms` median lands near 11-12 s and D-511 fails.
**Why it happens:** Sonnet 5.5 thinks adaptively on every request, default effort `high`; OpenRouter sends `thinking: {type:'adaptive', display:'summarized'}`; thinking can't be disabled (400 for `reasoning.enabled:false`, `effort:'none'`, and Messages `thinking:{type:'disabled'}`). Evidence from the saved run: median 2,022 output tokens vs about 690 visible tokens; about 119 tok/s overall.
**How to avoid:** add `CONCIERGE_CONFIG.generation = { thinking: 'adaptive' | 'between_tools', effort?: 'low'|'medium'|'high' }`, applied via one `generationParams()` helper used by BOTH `orchestrate()` and the stream path (so rollback is config-only and A/B is fair). Candidate order to measure with the timing script: (a) `between_tools`; (b) adaptive with `output_config.effort: 'low'`; (c) current default. Do not combine `between_tools` with `display`, `budget_tokens` or effort above `high` (400). `between_tools` needs `output_config.effort` at `high` or below; effort cannot change mid-conversation under it (multi-turn follow-ups keep one level, so set it in config, never per message).
**Warning signs:** first `content_block_delta` of type `thinking_delta` arrives immediately, first `text_delta` seconds later; `usage.output_tokens` far above the visible character count / 4.
**Quality risk:** thinking may be helping honesty (claims 6/50, goal_as_result 2). Whatever is chosen must pass D-513 in the single full eval; if `between_tools` regresses, fall back to adaptive with low/medium effort and report that the 4 s bar was missed with numbers, rather than weakening the gate.

### Pitfall 2: Streaming works locally, arrives in one lump on Vercel
**What goes wrong:** all events land together at the end.
**Why it happens:** route inferred static, response compression/proxy buffering, or the handler awaiting everything before returning the `Response`.
**How to avoid:** return the `Response` immediately and do work inside `ReadableStream.start`; `export const dynamic = 'force-dynamic'` and `runtime = 'nodejs'`; headers `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`. Vercel enables streaming by default for Node.js functions (Vercel changelog "Streaming now enabled by default for all Node.js Vercel Functions"; page last updated 2026-09-01). Verify on a Vercel preview with `curl -N` and look at timestamps (this repo has no `vercel.json`; confirm the project's plan allows `maxDuration = 60`).
**Warning signs:** `t_teasers_ms` approximately equals `t_complete_ms` on the deployed URL but not locally.

### Pitfall 3: Cold catalogue load delays the teaser event
**What goes wrong:** first request after a cold start waits for `getCatalogue()` (documents + every embedded chunk's `content` paged 1,000 at a time + two join queries) before anything can be shown.
**How to avoid:** start `getCatalogue()` and `retrieveContext()` together with `Promise.all`; `getCatalogue()` never throws (memo or null), so a null catalogue means emit teasers without tags/summary rather than waiting or failing. Consider kicking `getCatalogue()` from `instrumentation.ts` at startup (warm the memo; it is a 1 h memo). Optional further gain: an additive `onCaseStudies` callback inside `retrieveContext` fired right after `selectedCaseStudies` is computed and before the sequential `getDocumentMetrics` round trip.
**Warning signs:** p90/max `t_teasers_ms` far above median on the first query of a run.

### Pitfall 4: Eval measures cold paths, production will look better
**What goes wrong:** `debug: true` sets `skipCache` for retrieval and the orchestrator cache, so the eval measures worst case (and a prompt-cache read still happens because that is server-side at Anthropic).
**How to avoid:** accept it (conservative) and say so in the report; a cache hit emits every event back-to-back, so warm production traffic is faster than the measured medians.

### Pitfall 5: Digits in DB deliverables lines reach the screen verbatim
**What goes wrong:** D-502 shows `deliverables` verbatim; `formatCatalogue` deliberately drops deliverables that contain digits (`!/\d/.test(...)`), presumably to keep metric-like text out. An instant teaser built from `CatalogueRow.deliverables` could show a numeric line the model never saw.
**How to avoid:** apply the same digit filter to instant-teaser summaries (render no summary when the line contains a digit). Note it in the plan so the executor does not "fix" it. Flag to user as Open Question 3.

### Pitfall 6: Follow-up block leaks into streamed narrative
**What goes wrong:** the `**Want to explore further?**` list appears as narrative text, then disappears on `final`.
**How to avoid:** buffer a suffix that could be the beginning of the marker (see Pattern 3 step 5); test with chunk boundaries that split the marker.

### Pitfall 7: Mid-stream failure shape differs per API
**What goes wrong:** a failure after HTTP 200 shows up as an `error` SSE event (Anthropic format) or a stream that simply stops; the SDK throws inside the `for await`.
**How to avoid:** wrap the loop; emit `error` with classified fields; treat a clean end without `message_stop`/without `final` text as an error; the client also treats "stream closed with no `final` and no `error`" as retryable. OpenRouter documents that errors after the 200 are events, not status codes, and that a 200 with no output must be treated as failure.

### Pitfall 8: Client disconnect keeps billing
**What goes wrong:** user navigates away, upstream generation keeps running.
**How to avoid:** pass an `AbortController` signal to `create(..., { signal })`, abort on `request.signal` abort and on `ReadableStream.cancel()`. OpenRouter documents that aborting a streaming connection stops processing and billing for supported providers.

### Pitfall 9: `limit_remaining` is a key budget, and can be null
**What goes wrong:** health reports "$5.39 left" while the account balance differs, or reports nothing when the key has no limit.
**How to avoid:** `GET /api/v1/key` returns `limit`, `limit_remaining` (null if unlimited), `usage`, and `effective_budget.remaining_usd` (the budget that blocks first, including guardrails). Report the minimum of the non-null values as "spendable credit". If `limit_remaining` is null and no effective budget, report `warn` ("credit unknown: key has no limit; account balance needs a management key") rather than `ok`. `GET /api/v1/credits` needs a management key (403 "Only management keys can perform this operation"); do not use it. Per-IP burst limits apply to both endpoints, so the startup check should run once, not per request.

### Pitfall 10: Health threshold vs preflight minimum drift
**What goes wrong:** health `warn` is below $5 (D-517) but `eval/preflight.ts` fails below `EVAL_MIN_CREDIT_USD` (default 4). Current credit is $5.39; a $3.50 eval leaves about $1.9, which health will flag as `warn`.
**How to avoid:** source both from the same config constants; keep preflight's default minimum as is (it is a per-run requirement) but make the health `warn` threshold the config value. Not a bug, just make the relationship explicit in config comments.

### Pitfall 11: Instrumentation hook in Next 14
**What goes wrong:** `register()` is never called, so the startup check silently never runs.
**Why:** Next 14 needs `experimental.instrumentationHook`; `next.config.js` does not set it. `@sentry/nextjs` 10.45.0 contains logic for Next versions that require the option (`build/cjs/config/util.js`) and the repo's existing `instrumentation.ts` already depends on it for Sentry.
**How to avoid:** confirm with a log line when `npm run dev` starts (and `next build` output "instrumentation"); if absent, set `experimental.instrumentationHook: true` explicitly. Do not `await` the check inside `register()`; fire and forget with `.catch(() => {})` so serving is never delayed (D-517).

### Pitfall 12: D-504 retrieval signals cannot separate the classes cleanly
See "D-504 Calibration" below. Do not ship a single threshold and claim it is calibrated.

## D-504 Calibration (offline, from saved data, no spend)

Source: `eval/results/2026-11-22T22-48-20/responses.json` (50 records with full retrieval snapshots; per-chunk `semantic_score` is the best chunk's cosine, `combined_score` the RRF score). Groups from `eval/queries.json`: 21 queries with `fallback_expected: true` (including 5 invention_bait and 5 off_topic), 29 direct-match queries.

| Signal | Fallback / bait range | Direct-match range | Verdict |
|--------|----------------------|--------------------|---------|
| Max case-study `semantic_score` | 0.154-0.434 for 20 of 21 (p4-q03 = 0.639 is a Strategy-Lead case that does have an education match); bait queries: 0.341, 0.376, 0.421, 0.427, 0.434 | 0.281-0.673; below 0.40: four (0.281 "insurance experience?", 0.308, 0.356, 0.373 "any science clients?"); below 0.45: eight | Best single signal. Floor 0.40 suppresses about 15/21 fallback (2/5 bait) at about 4/29 (14%) false suppression; floor 0.45 suppresses 20/21 fallback (5/5 bait) at 8/29 (28%) false suppression, i.e. about 56% of all queries lose instant teasers |
| Max `keyword_score` | 0.009-0.387 | 0.013-0.435 | No separation |
| Top RRF score / top-1 vs top-2 margin | 0.0250-0.0358 / 0.0000-0.0156 | 0.0306-0.0358 / 0.0000-0.0030 | No separation (RRF is rank-based; the top score is almost always near the ceiling) |
| `intent_match` in top 3 | True for 11/21 | True for 26/29 | Weak; direct-only false suppression 3/29 |
| `isAboutAG(query)` | not the trigger here (company-info queries) | | Use only to suppress when it is true, as the route already routes `includeCompanyInfo` on it |

Invention-bait queries are semantically close to real studies by construction ("I heard you did the category launch for Wiz around their CNAPP positioning"), so no retrieval score reliably catches them. A deterministic query-pattern signal does: a "claim of prior engagement" regex (`I heard|I understand|I was told|told me|said` followed within 60 characters by `you did|ran|handled|built|made|worked|launched|created|designed|led|produced|delivered`) matched 5/5 bait queries and 0/45 others on the Phase 4 query set. Caveat: written against the same five bait queries (overfit risk, n=5); the plan should add a handful of synthetic positive/negative strings to the unit test and state this limit in the report.

**Recommended D-504 design** (all in `concierge-config.ts`, pure function in `instant-teasers.ts`):
1. Suppress if the claim-of-prior-work pattern matches (catches bait deterministically).
2. Suppress if max case-study `semantic_score` < floor, starting at 0.40 (config), trading off about 14% false suppression for catching 15/21 fallback queries. Raising to 0.45 catches nearly all fallback at the cost of suppressing more than half of all queries (weakens PERF-01 coverage). The plan should compute and report both on the real run and let the user pick; default 0.40 plus the pattern.
3. Suppress on `isAboutAG(query)` and on zero case-study chunks.
4. Known miss: p4-q03 (fallback-expected, max score 0.639): instant teasers will show; the model's final reconcile and its honest framing handle it. Report it explicitly. The UI-SPEC requires no ranking language, which limits the harm.

Report per D-504/D-512: suppression rate on fallback_expected and invention_bait queries, false-suppression rate on direct-match queries, instant-teaser coverage over all 50, and the flash rate.

## Code Examples

### Health check shape (D-515/D-517)

```typescript
// src/lib/provider-health.ts. Source: OpenRouter GET /api/v1/key docs (https://openrouter.ai/docs/api-reference/limits)
export type HealthStatus = 'ok' | 'warn' | 'fail';
export interface ProviderHealth {
  status: HealthStatus; reason: string;
  route: ProviderRoute; models: { generation: string; embedding: string };
  key: { present: boolean; valid: boolean | null };
  credit: { limit: number | null; remaining: number | null; usage: number | null };
}
export async function checkProviderHealth(opts: { timeoutMs?: number } = {}): Promise<ProviderHealth> {
  // route !== 'openrouter'                  -> fail ("Chat is on the direct Anthropic route; expected OpenRouter")
  // no OPENROUTER_API_KEY                   -> fail
  // GET https://openrouter.ai/api/v1/key, Authorization: Bearer <key>, AbortSignal.timeout(timeoutMs)
  //   401/403                               -> fail (invalid key)
  //   timeout / network / 5xx               -> warn (never fail on OpenRouter being slow, D-517)
  //   spendable = min of non-null(limit_remaining, effective_budget.remaining_usd)
  //   spendable null                        -> warn (credit unknown)
  //   spendable <= 0                        -> fail;  < CONCIERGE_CONFIG.health.warnBelowUsd (5) -> warn;  else ok
}
```
`eval/preflight.ts` keeps `PreflightError` and its own minimum-credit throw but calls this function for the fetch and parsing. `/api/health` adds `provider: await checkProviderHealth()` behind the existing `requireAdminAuth`. `instrumentation.ts` (inside `NEXT_RUNTIME === 'nodejs'`) does `void checkProviderHealth({ timeoutMs: 3000 }).then(log).catch(() => {})` using `console.warn`/`APILogger` with an unmistakable prefix on `warn`/`fail`.

### SSE encode/decode (shared by route, page.tsx and eval)

```typescript
export const encodeSse = (e: StreamEvent) =>
  new TextEncoder().encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);

// Decoder: buffer chunks, split on blank line ("\n\n"), skip frames whose first char is ':', parse `data:` lines.
// Never JSON.parse a comment line (OpenRouter docs warn this crashes naive loops).
```

### Prompt caching (unchanged, verify in timing script)

`buildSystemBlocks()` already places `cache_control: {type:'ephemeral', ttl:'1h'}` on the catalogue block. OpenRouter docs (https://openrouter.ai/docs/guides/best-practices/prompt-caching): explicit per-block breakpoints are supported for Anthropic, Bedrock and Vertex (limit four); 1 h TTL is supported (writes 2x, reads 0.1x base price); minimum cacheable prompt is 512 tokens for Sonnet 5.5; sticky routing activates after a cache hit (or immediately if a `session_id` is sent); cache usage appears in `prompt_tokens_details.cached_tokens`/`cache_write_tokens` on the OpenAI-shaped APIs. Phase 4 already confirmed hits on 50/50 via the Anthropic-shaped `cache_read_input_tokens` on the Messages endpoint (median 12,160 tokens read), so no `cache_control` change is needed. In streams, the Anthropic format reports these in `message_start.message.usage` (MEDIUM: verify with the timing script; OpenRouter's page does not describe stream-specific usage placement for the Messages endpoint). Adding `thinking`/`output_config` to the request does not change the system-block prefix; Anthropic's rule (training knowledge, LOW-MEDIUM) is that changing thinking parameters invalidates cached message content but not system/tool prefixes. The timing script should confirm `cache_read_input_tokens` stays at about 12,160 after the change.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `thinking: {type:'disabled'}` to turn thinking off | `thinking: {type:'between_tools'}` (400 on `disabled` for Sonnet 5.5) | Sonnet 5.5 | Only supported way to skip up-front thinking; takes no other fields; effort <= `high` |
| `budget_tokens` manual thinking budgets | adaptive thinking + `output_config.effort` | Sonnet 5 / 5.5 | `budget_tokens` returns 400 on Sonnet 5.5; OpenRouter does not forward budgets |
| `stream_options: {include_usage: true}` | usage always included | OpenRouter current docs | Chat Completions only; irrelevant on the Messages endpoint |
| `messages.stream()` helpers | raw `create({stream:true})` here | n/a | SDK 0.30.1 accumulator is thinking-unaware; raw events are simpler and keep OpenRouter extras |
| OpenRouter `/api/v1/credits` for balance | `/api/v1/key` (regular key) | current docs | `/credits` is management-key only |

**Deprecated/outdated:** the existing code comment "Phase 5: apply postProcessOutput ... on this path too" and "SDK 0.30.1 types lack cache_control" remain true (cast to `any` for `cache_control`, `thinking`, `output_config`).

## Open Questions

1. **Thinking mode vs the 3-4 s hero bar (needs a user decision)**
   - What we know: default adaptive thinking at effort `high` puts about 10 s of silent thinking before any visible text; PERF-02 cannot be met by streaming alone; `between_tools` or low effort is the documented lever; model stays Sonnet 5.5.
   - What's unclear: how much thinking contributes to honesty (claims 6/50, goal_as_result 2 sit at the D-513 ceilings, so there is no headroom); real retrieval and TTFT times (no per-stage timing exists today).
   - Recommendation: plan it as a config knob decided by a cents-level timing run (about 5 queries per mode, under $0.50), then the one full eval. Tell the user before execution that this changes generation behaviour (not model or prompt) and that if it regresses quality the honest outcome is "PERF-02 missed, here are the numbers" rather than loosening D-513.
2. **Does OpenRouter's Anthropic endpoint pass `thinking: {type:'between_tools'}` and `output_config` through for `anthropic/claude-sonnet-5.5`?**
   - What we know: OpenRouter's Sonnet 5.5 migration page documents exactly this Messages-API request body.
   - What's unclear: not exercised here (no spend).
   - Recommendation: first task of the timing script; a 400 is cheap and informative.
3. **Digit-containing deliverables on instant teasers**
   - What we know: catalogue prompt text excludes them; D-502 says "verbatim".
   - Recommendation: apply the same digit filter (no summary shown) and note it in the plan; confirm if the user wants verbatim-including-digits instead.
4. **D-504 floor choice (0.40 vs 0.45) and the p4-q03 miss**
   - Recommendation: ship 0.40 plus the claim pattern; report both thresholds' rates from the real run; user can raise the floor in config without code changes.
5. **Raw SSE event details on OpenRouter's Messages endpoint**
   - What we know: stream is `text/event-stream`, `content_block_delta` with `text_delta` shown in OpenRouter's reference; usage has Anthropic fields plus OpenRouter's `cost`, `cost_details`.
   - What's unclear: exact placement of `cost` in `message_delta`; `message_start`/`ping`/`error` shapes were truncated in the fetched docs.
   - Recommendation: parser tolerant of unknown event types; confirm in the timing script by logging one raw stream to the scratchpad.
6. **Vercel plan and `maxDuration = 60`** (no `vercel.json`; plan unknown). Streaming does not change function duration limits, and the faster stream path should finish well under 60 s.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | yes | v24.13.0 | none needed |
| `tsx` / `node:test` | unit tests (`npm run eval:test`) | yes (existing script) | n/a | none needed |
| OpenRouter key with credit | timing script, full eval | key configured; credit about $5.39 per CONTEXT (not probed, research must not spend) | n/a | unit tests and recorded-stream replay are free |
| Supabase project | retrieval, catalogue | free tier may be paused (CLAUDE.md) | n/a | `npm run eval:preflight` checks; restore is a human action |
| Vercel preview deployment | verifying no buffering | unknown | n/a | `next build && next start` locally for functional check; buffering needs a real Vercel preview (`curl -N`) |
| Playwright | optional e2e | present (`tests/e2e`) | n/a | not required |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** Vercel preview verification is manual if unavailable.

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: false`; included because the orchestrator requested it explicitly.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in test runner through `tsx --test` (`npm run eval:test`), `node:assert` |
| Config file | none (script in `package.json`) |
| Quick run command | `npx tsx --test eval/stream-layout-parser.test.ts` (per file) |
| Full suite command | `npm run eval:test && npm run type-check` |

Note: `eval:test` globs `eval/*.test.ts`, so new tests for `src/lib` modules should live in `eval/` (matching existing `layout-postprocess.test.ts`, `verifier.test.ts` convention) to be picked up.

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-02 | Parser emits hero partials across arbitrary chunk splits (incl. split escapes, fences, split follow-up marker), complete components in order, falls back cleanly on malformed JSON | unit | `npx tsx --test eval/stream-layout-parser.test.ts` | no, Wave 0 |
| PERF-02 | Stream result after `postProcessOutput` equals the non-stream `orchestrate` result for the same recorded model text (tags overwritten, internal keys stripped, same `rawResponse`) | unit (recorded text from saved responses) | `npx tsx --test eval/stream-equivalence.test.ts` | no, Wave 0 |
| PERF-02 | SSE encode/decode round-trip, comment lines skipped, split frames | unit | `npx tsx --test eval/stream-events.test.ts` | no, Wave 0 |
| PERF-01 | Instant-teaser builder: DB-only fields, digit-filtered deliverables, tags from catalogue, null-catalogue degrade | unit | `npx tsx --test eval/instant-teasers.test.ts` | no, Wave 0 |
| PERF-01 / D-504 | Suppression function on Phase 4 retrieval snapshots: reproduces the calibration table; claim-pattern 5/5 bait, 0 false positives on the 50 queries | unit over saved JSON (free) | `npx tsx --test eval/suppression.test.ts` | no, Wave 0 |
| PERF-03 | `checkProviderHealth` with mocked `fetch`: ok / warn (low credit, timeout, null limit) / fail (no key, 401, route direct, credit <= 0) | unit | `npx tsx --test eval/provider-health.test.ts` | no, Wave 0 |
| PERF-03 | `eval/preflight.ts` still throws `PreflightError` below minimum | unit | same file | no, Wave 0 |
| D-510/511/512 | Metrics: medians exclude suppressed queries from teaser median, flash rate computed, `latency_ms` equals `t_complete_ms`, null-safe deltas against baselines that lack the new fields | unit | `npx tsx --test eval/metrics.test.ts` | partly (extend existing) |
| D-509 | JSON `/api/chat` response shape unchanged; `debug` only when `EVAL_DEBUG=true` and `debug:true` on both routes | unit/route test with env toggle | `npx tsx --test eval/debug-gate.test.ts` | no, Wave 0 |
| PERF-02 (real) | Time-to-first-hero and thinking mode comparison on 5 queries | manual/paid (cents) | `npx tsx eval/stream-timing.ts --ids p1-q01,p2-q02,p3-q04,p4-q05,p5-q09` | no, Wave 0 |
| Phase gate | Full eval, 50 queries, D-511 and D-513 | paid, once | `npm run eval:run` then grade/report | exists (adapted) |
| UI | Reconcile/keying/CLS/aria-busy, reduced motion | manual + optional Playwright | `npx playwright test tests/e2e/homepage.spec.ts` | partial |

### Sampling Rate
- **Per task commit:** the single new test file plus `npm run type-check`.
- **Per wave merge:** `npm run eval:test && npm run type-check`.
- **Phase gate:** full unit suite green, the 5-query timing run reviewed, then the one full eval with preflight; report lists every metric delta vs `2026-11-20T15-12-31` and the D-513 bar vs `2026-11-22T22-48-20`.

### Wave 0 Gaps
- [ ] `eval/stream-layout-parser.test.ts`, `eval/stream-events.test.ts`, `eval/stream-equivalence.test.ts`
- [ ] `eval/instant-teasers.test.ts`, `eval/suppression.test.ts` (fixtures sliced from the saved Phase 4 `responses.json`, committed small)
- [ ] `eval/provider-health.test.ts`, `eval/debug-gate.test.ts`
- [ ] `eval/stream-timing.ts` (records `t_*`, raw first-stream capture to the scratchpad, usage/cache fields, thinking-mode comparison)
- [ ] A recorded-stream replay helper (fake `Response` from a saved SSE capture) so the client reducer and eval consumer are testable without credit

## Budget Notes (D-514)

- Free: all unit tests, the D-504 calibration (done above from saved data), parser and reducer replay tests.
- Cents: timing script, about $0.03-0.07 per query (Phase 4 median generation cost $0.032, range $0.022-0.045; embeddings are fractions of a cent). Five queries x two thinking modes is roughly $0.3-0.7. `between_tools` should lower per-query cost since thinking tokens are output tokens.
- One full eval about $3.50 (CLAUDE.md), no second grader. Credit $5.39 minus timing runs, topped up by the user before the eval as agreed. After the eval, health will report `warn` (< $5) by design.
- Do not enable `verifierEnabled()`; no verifier spend.

## Sources

### Primary (HIGH confidence)
- Repo files read: `src/lib/orchestrator.ts`, `src/app/api/chat/route.ts`, `src/lib/llm-config.ts`, `src/app/api/health/route.ts`, `src/instrumentation.ts`, `src/lib/admin-auth.ts`, `src/lib/catalogue.ts`, `src/lib/supabase.ts` (`retrieveContext`), `src/lib/concierge-config.ts`, `src/lib/layout-postprocess.ts`, `src/app/page.tsx`, `src/components/HeroBlock.tsx`, `eval/run.ts`, `eval/preflight.ts`, `eval/metrics.ts`; `node_modules/@anthropic-ai/sdk` 0.30.1 (`lib/MessageStream.js`).
- Saved eval data: `eval/results/2026-11-22T22-48-20/responses.json` and `eval/queries.json` (token, latency, cost and retrieval-score statistics computed here).
- Anthropic: What's new in Claude Sonnet 5.5, https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5 (adaptive thinking on by default, default effort high, `between_tools`, `disabled` returns 400, 512-token cache minimum).
- OpenRouter Claude Sonnet 5.5 migration, https://openrouter.ai/docs/cookbook/evaluate-and-optimize/model-migrations/claude-5-5 (OpenRouter sends adaptive + `display:summarized`, mandatory reasoning 400s, `between_tools` Messages example, `max_tokens` shared with thinking).
- OpenRouter streaming, https://openrouter.ai/docs/api-reference/streaming (SSE `data:` lines, `:` comment keepalives, post-200 errors as events, cancel stops billing).
- OpenRouter prompt caching, https://openrouter.ai/docs/guides/best-practices/prompt-caching (explicit breakpoints, 1 h TTL, usage fields, sticky routing).
- OpenRouter `GET /api/v1/key`, https://openrouter.ai/docs/api-reference/limits (`limit`, `limit_remaining`, `effective_budget`, `usage`, per-IP burst limits); `GET /api/v1/credits` requires a management key, https://openrouter.ai/docs/api/api-reference/credits/get-credits.
- OpenRouter create-a-message (Anthropic format), https://openrouter.ai/docs/api/api-reference/anthropic-messages/create-a-message.md (stream param, `thinking` variants, top-level `cache_control`, usage fields incl. `cost`; first 100,000 of 259,474 characters read).
- Vercel streaming functions, https://vercel.com/docs/functions/streaming-functions (last updated 2026-09-01; Node streaming default, `text/event-stream` example, max durations).

### Secondary (MEDIUM confidence)
- Web search on Next.js/Vercel SSE buffering (static inference, `no-transform`, `X-Accel-Buffering`): community posts and AI SDK troubleshooting pages, consistent with each other but not Next 14 official docs.
- Anthropic raw stream event names (`message_start`, `content_block_delta`, `message_delta`, `message_stop`) from Anthropic's public format; OpenRouter's reference confirms `content_block_delta`/`text_delta` only.

### Tertiary (LOW confidence)
- Anthropic's rule that thinking-parameter changes do not invalidate the system-prompt cache prefix (training knowledge, not re-verified here).
- Visible-token estimate (characters / 4) used to infer the thinking share; JSON with URLs tokenizes denser, so the true thinking share may be somewhat below two thirds, but even at 900 visible tokens it is about 1,100 thinking tokens, about 9 s.
- Instrumentation hook auto-enabled by Sentry for Next 14 (inferred from Sentry source; verify at dev start).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new dependencies; SDK behaviour read from source.
- Architecture: MEDIUM-HIGH, event model and reconcile are design choices consistent with locked decisions; raw OpenRouter Messages SSE specifics are unverified without a paid call.
- Thinking/latency finding: HIGH on documented behaviour, MEDIUM on the exact seconds (derived from saved token counts).
- D-504 calibration: MEDIUM, computed from a single saved run (50 queries; bait n=5, pattern overfit risk stated).
- Pitfalls: MEDIUM-HIGH.

**Research date:** 2026-11-23
**Valid until:** 2026-12-07 (fast-moving: model docs and OpenRouter behaviour changed repeatedly in recent months)
