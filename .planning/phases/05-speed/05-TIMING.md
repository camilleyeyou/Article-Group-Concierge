# 05-08 Thinking-mode timing

Date: 2026-11-23. Run folder: `eval/results/stream-timing-2026-11-23T18-20-20` (raw captures `raw-<mode>.jsonl`, `timing.json`). Model: anthropic/claude-sonnet-5.5 via OpenRouter, queries p1-q01, p2-q01, p1-q05 through orchestrateStream.

## Spend ledger

| Invocation | Credit before | Credit after | Actual spend |
| --- | --- | --- | --- |
| stream-timing (9 calls) | $29.85 | ~$29.59 | $0.257 (script-reported) |
| route smoke 1 (mode default, local dev) | ~$29.54 | ~$29.51 | ~$0.03 |
| route smoke 2 (mode adaptive_effort:low, local dev) | $29.51 | $29.48 | ~$0.03 |

CUMULATIVE ACTUAL SPEND: $0.37 (cap $1.00 authorised for this plan; plan text said $0.75). Credit left $29.48 vs FULL_EVAL_MIN_CREDIT_USD $4.50.

Modes timed: default, between_tools, adaptive_effort:low (credit was well above $5.30, none skipped).

## Per-mode results (medians of 3 calls)

| Mode | Calls ok | t_first_text ms | t_hero_first ms | t_complete ms | Output tokens | cache_read/call | Cost USD | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| default | 3/3 | 12298 | 12299 | 15955 | 2146 | 12160 | 0.0332 | none |
| between_tools | 3/3 | 2181 | 2181 | 8797 | 1208 | 12159 | 0.0247 | none |
| adaptive_effort:low | 3/3 | 1433 | 1438 | 8154 | 1231 | 12160 | 0.0240 | none |

Per call t_hero_first (ms): default 16148 / 12299 / 8490; between_tools 2181 / 1462 / 2437; adaptive_effort:low 1438 / 1327 / 1693. All 9 final layouts start with HeroBlock.

Cache: the first call of the run (p1-q01 default) wrote the cache (cache_creation 12160, cache_read 0, cost $0.089); p1-q01 between_tools also reported cache_creation 12159 (cache TTL/ordering effect, not a mode problem). Every other call reported cache_read 12159-12160 and no creation, exactly the Phase 4 reference of 12,160.

Retrieval time per query: p1-q01 4882 ms (cold), p2-q01 3013 ms, p1-q05 3655 ms (median 3655 ms). Note t_hero_first is measured from the start of generation, so retrieval is added on top for the user-visible hero time.

## OpenRouter pass-through

Pass-through is confirmed for both parameter sets. No HTTP 400 on any call. Raw events: default has 140 thinking_delta events and `thinking_tokens` 1762 on p1-q01; between_tools and adaptive_effort:low have 0 thinking_delta events and `thinking_tokens: 0`; output tokens drop from ~2146 to ~1210-1230 median. Usage arrives in `message_delta` (`usage.input_tokens`, `output_tokens`, `output_tokens_details.thinking_tokens`); cost and cache counts were recovered by the script into `usage.{input,output,cache_read,cache_creation,cost}` in timing.json.

## Route smoke (local dev server, EVAL_DEBUG not sent, no debug event)

Smoke 1 (mode default): hero first at 16916 ms, hero_done 16916 ms, final at 21593 ms, exit OK (head of the timeline was not captured; tail shows hero, hero_done, component x4, narrative, final).

Smoke 2 (mode adaptive_effort:low), default query: `suppressed` 5652 ms, first `hero` 7226 ms, `hero_done` 8062 ms, component events 8679 / 9398 / 10754 / 11798 / 12784 ms, `final` 14266 ms (32 narrative events between). suppressed before hero, final last, no debug event. SMOKE OK. The first request on a cold dev server includes slow retrieval (suppression event at 5.6 s), so wall-clock numbers are inflated versus production.

## Decision

Rule: eligible modes (only those timed) need all 3 calls successful, every final layout starting with HeroBlock, and every call reporting no cache_creation having cache_read within 10,944-13,376 (12,160 +/- 10%). Winner is the eligible mode with the lowest median t_hero_first_ms; if two are within 200 ms, the lower median cost. default is always the fallback.

Eligibility: all three modes eligible. Winner: adaptive_effort:low, 1438 ms vs between_tools 2181 ms (gap 743 ms > 200 ms) and default 12299 ms. Layouts looked intact (HeroBlock, strategy card, case study teasers); quality is not graded here, the D-513 eval in 05-09 decides whether the mode ships and reverts to default on regression.

THINKING DECISION: adaptive_effort:low (median t_hero_first 1438 ms vs default 12299 ms)

PERF-02 RISK: projected hero-first 5093 ms > 4000 ms (1438 ms generation + 3655 ms median retrieval; instant teasers and streaming give earlier first visible content, but hero itself waits on retrieval)
