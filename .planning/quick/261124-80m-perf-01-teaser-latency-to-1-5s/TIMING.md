# PERF-01 teaser latency: measured breakdown (2026-11-24)

Setup: `npm run build` + `next start -p 3100` spawned fresh per run (in-memory caches reset), `EVAL_DEBUG=true`,
teasers-only mode (zero generation spend), 10-query fixed set, 2 harness invocations x 3 runs (cold query rotated),
laptop -> Supabase / OpenRouter over the public internet. Harness: `eval/teaser-timing.ts`. Raw data: `evidence/`.

## Baseline (no behaviour change, before any speed work)

| Stage (ms) | WARM non-suppressed median (n=42) | COLD first request median (n=6) |
|---|---|---|
| client t_teasers | **2118** | **2477** |
| body parse | ~0 | 2-3 |
| gap before embedding starts | ~0 | 9 |
| embedding (OpenRouter text-embedding-3-small) | **1004** | 1170 (one outlier 3.6 s) |
| hybrid_search_v2 RPC | **1108** | 1284 |
| post-RPC best-per-doc + onChunks | ~0 | 1 |
| catalogue wait beyond chunks_ready | 0 | 0 (loads in 1.2-2.3 s, finishes while embedding/RPC run) |
| decideInstantTeasers | ~0 | 2 |
| client minus server (network + framework) | 3 | 50-60 |

Embedding and RPC are strictly sequential and account for ~99.5% of the time. Everything else is under 10 ms warm.
The catalogue (the suspected cold-path cost) is NOT on the critical path: its cold load (1 chunk page, 0.5-2.3 s) always
finishes before the RPC does. Suppressed queries take the same time (2154 median), as expected.

## Probes (eval/teaser-probes.ts)

- (a) Trivial Supabase REST select RTT from here: median **324 ms** (290-389). RPC alone with embedding cached: **1085 ms**. So ~760 ms is DB execution + transfer on top of one RTT.
- (c) RPC alone 1085 ms vs RPC in-route 1108 ms: **no connection contention** from side fetches in the route. With side fetches deliberately fired concurrently in the probe: 1276 ms (noise-level, +190 ms, not reproduced in-route).
- (b) Embedding via OpenRouter: ~986 ms for a single 1536-d embedding (very slow for this model; typical direct latency is a fraction of that). **OpenAI direct could not be measured: `OPENAI_API_KEY` in .env.local returns 401** (invalid/expired), so no numbers and no vector-identity check.
- (d) Vercel/Supabase regions: not determined (read-only CLI check not attempted; Supabase RTT of 324 ms from a laptop suggests a distant region, but this is not proven).
- The RPC SQL (migration 005) computes `to_tsvector('english', ...)` for title, client, taxonomy and content of EVERY eligible chunk on every call (no stored tsvector, no index), plus a lateral tag aggregate per chunk. That is the likely DB-execution cost. No EXPLAIN ANALYZE was run (supabase-js cannot run it; would need SQL editor access).

## Decision

Rows >= 100 ms: embedding (1004), RPC (1108). Cold deltas (embedding +170, RPC +180) are connection setup, same rows.

| Row | Allowed fix per plan? | Status |
|---|---|---|
| Catalogue wait | yes, but measured 0 ms | not changed (nothing to fix; plan said no change on a guess) |
| Contention from side fetches | yes, but in-route RPC (1108) ~ RPC alone (1085) | not changed |
| Cold TLS warm-up at module load | yes, but module load coincides with the first request on serverless and the harness cannot show a gain; < 200 ms cold only | not changed |
| Embedding slow (1.0 s) | NO, needs user decision (provider switch, new env var) | **STOP, see summary**. Blocked further because the existing OPENAI_API_KEY is rejected (401) |
| DB execution of the RPC (~760 ms above RTT) | NO, needs user decision (SQL) | **STOP, draft in `draft-migration-006.sql`, not applied** |
| Region | NO | not proposed (no evidence) |
| First-byte/framework overhead | yes, but 3 ms warm | nothing to fix |

Result: no speed change is possible without a STOP-row approval, so no code change to retrieval was made.
Warm median stays 2118 ms; target 1500 ms needs about 620 ms removed from embedding and/or RPC.

## Equivalence

Two baseline harness invocations (3 runs each, 60 requests) produced identical chunk keys (order included), teaser slugs and
suppression for all 10 queries (second invocation compared against the first with `--baseline`, exit 0). Snapshot is stable,
so equivalence can be checked for future fixes. Snapshot: `evidence/baseline-snapshot.json`.

## After

Not applicable: nothing applied. Production projection: production smoke was 1.8-1.9 s vs 2.2-2.4 s local; the same two
stages dominate there, so production stays ~1.8-1.9 s until embedding and/or RPC are reduced (projection, not measured).

## Fix applied: hybrid_search_v2_top (migration 006)

Follow-up measurement showed the ~760 ms above RTT was mostly response transfer, not DB work:
v2 with match_count 1 / 10 / 60 took 623 / 588 / 1071 ms (2 KB / 21 KB / 123 KB), vs a 350 ms REST ping.
Only 212 chunks (247 KB of text) exist, so a stored tsvector would save little; the draft 006 was dropped.

The app keeps only the best chunk per document, top 8 case studies + top 2 articles, of v2's 60 rows.
`hybrid_search_v2_top` wraps v2 (unchanged, same args) and makes that selection in SQL, returning ~10 rows.
The app calls it for the main search and falls back to v2 if the function is missing.

- Equivalence: all 50 eval queries x include_company_info off/on, v2 + app selection vs v2_top: 0 mismatches.
- RPC alone (cached embeddings): 1078 ms / 124 KB -> 605 ms / 19 KB.
- Harness (`--label v2top`, 3 runs, `evidence/v2top-*.json`), snapshot identical to baseline:

| warm median | baseline | v2top |
|---|---|---|
| rpc | 1108 | 612 |
| embedding | 1004 | 996 |
| teasers on screen | 2118 | 1633 |

Embedding (~1 s) is now the largest stage; cutting it needs a provider decision (open).
