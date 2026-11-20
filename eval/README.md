# Concierge evaluation harness

Runs a fixed set of persona-based queries through `/api/chat`, has Claude grade each response against what was actually retrieved, and writes a markdown report.

```
personas.json ──► generate.ts ──► queries.json
                                       │
               dev server ◄── run.ts ◄─┘──► results/<ts>/responses.json
                                                 │
                                    grade.ts ────┴──► results/<ts>/grades.json
                                                 │
                                    report.ts ───┴──► results/<ts>/report.md
```

## One-time setup

1. Add to `.env.local` (alongside the existing Supabase / Anthropic / OpenAI keys):

   ```bash
   EVAL_DEBUG=true
   ```

   This lets `/api/chat` honour `{"debug": true}`: it bypasses the in-memory caches and returns the retrieved chunks, visual assets, metrics and raw model output alongside the normal response. **Never set it in production.**

2. Start the dev server: `npm run dev`

3. Generate queries (needs Supabase + Anthropic access): `npm run eval:generate`

## Running

```bash
npm run eval            # generate (skipped if queries.json exists) → run → grade → report
```

Or step by step:

| Command | What it does |
|---|---|
| `npm run eval:generate` | Builds `eval/queries.json` from `personas.json` and the live document index. Skips if the file exists; `-- --force` regenerates. |
| `npm run eval:run` | Posts every query to the chat API, one at a time with a 4s gap. `-- --persona p5` or `-- --limit 3` for a smoke test. |
| `npm run eval:grade` | Grades the latest run. Resumes if interrupted; `-- --force` re-grades everything; `-- --dir eval/results/<ts>` targets an older run. |
| `npm run eval:report` | Writes `report.md` and `grades.csv` (one row per query: every score and reason, retrieved vs expected case studies) for the latest (or `--dir`) run. |

A full run is 50 chat requests plus 50 grading calls (Claude Opus 5.5 at high effort, rubric prompt cached), and takes roughly 30–45 minutes end to end.

## Rerunning after reingesting documents

1. Reingest as usual (`npm run ingest:*`, `npm run populate`, etc.).
2. **Restart the dev server.** Debug requests already skip the retrieval and response caches, but a restart guarantees nothing stale is held in memory.
3. Decide whether to keep the query set:
   - **Keep `queries.json`** (default) to compare before/after on identical queries. That's usually what you want.
   - If you added or removed case studies, the `expected.case_studies` slugs may be out of date. Regenerate with `npm run eval:generate -- --force`, accepting that the new run isn't directly comparable with old ones. Generation rejects slugs that aren't in the index, so expectations always point at real documents.
4. `npm run eval:run && npm run eval:grade && npm run eval:report`
5. Compare `report.md` with the previous run's in `eval/results/`. Look first at **Retrieval gaps** (recall should rise when you add content) and **Content gaps** (items should disappear once that work is indexed).

## What gets scored

Each response gets 1–5 plus a one-line reason on:

| Criterion | Question |
|---|---|
| grounded | Is every client, case study, metric and outcome present in the retrieved context? ≤ 2 is flagged as a **hallucination**. |
| components | Valid layout JSON, registry tags only, required props, slugs/media/titles taken from context, prompt rules followed. |
| fallback | **Honest reframing standard:** when nothing relevant was retrieved, showing adjacent work is fine, but it must not be presented as a direct match, imply experience AG doesn't have, or invent anything. `would_strict_pass_fallback` records whether it *explicitly* admitted the gap. The current orchestrator prompt tells it never to, so expect strict failures. |
| cta | Ends with a useful next step for this persona. |
| voice | Matches the brand voice described in the orchestrator prompt. |

The grader reads the live `SYSTEM_PROMPT` from `src/lib/orchestrator.ts`, so prompt changes automatically flow into the voice and component standards.

Before grading, `lib.ts` also runs **deterministic checks** that need no model: unknown component tags, missing required props, slugs / thumbnails / video URLs / image paths that weren't retrieved, case-study titles that aren't verbatim, metric values that don't appear in context, and retrieved videos that weren't used. These go to the grader as evidence and get their own section in the report.

## Report sections

- Averages per criterion, per persona, per query type
- Hallucination flags, with the invented claims
- Fallback behaviour on off-topic, out-of-domain and invention-bait queries
- **Retrieval gaps:** an expected case study wasn't retrieved (with what came back instead), plus overall expected-case-study recall
- **Content gaps:** the query targets work on articlegroup.com/work that isn't indexed (fix by ingesting, not by tuning retrieval)
- Automated check failures, lowest-scoring responses, errors

## Files

| File | Notes |
|---|---|
| `personas.json` | Five hand-reviewed personas from articlegroup.com (p5 is deliberately out of domain). Edit freely, then regenerate queries. |
| `queries.json` | Generated; commit it so runs stay comparable. Includes a snapshot of the indexed documents. |
| `results/` | Gitignored (responses contain signed storage URLs). |
| `lib.ts` | Shared types, the Claude JSON helper, automated checks. |

## Configuration

| Env var | Default | |
|---|---|---|
| `EVAL_DEBUG` | unset | Must be `true` on the **server** for the runner to work. |
| `EVAL_BASE_URL` | `http://localhost:3000` | Chat API base URL. |
| `EVAL_DELAY_MS` | `4000` | Gap between chat requests (the route allows 20/min). |
| `EVAL_MODEL` | `claude-opus-5-5` | Generator and grader model. |
| `EVAL_GRADE_CONCURRENCY` | `3` | Parallel grading calls. |
| `EVAL_FALLBACKS` | on | Server-side refusal fallback on grader/generator calls; set `off` to disable. Not used via OpenRouter. |
| `OPENROUTER_API_KEY` | unset | When set, the app, ingestion scripts and eval route embeddings and Claude through OpenRouter (see `src/lib/llm-config.ts`). |

## Troubleshooting

- **"did not return debug data"**: `EVAL_DEBUG=true` is missing from `.env.local`, or the dev server wasn't restarted after adding it.
- **Every query errors with `embeddings_unavailable` / `database_unavailable`**: the dev server can't reach OpenAI or Supabase. The run records the error per query and carries on.
- **`Orchestrator error: …`**: the chat model call failed. Production would have shown the polite fallback message; the eval records it as an error rather than grading it as an answer.
