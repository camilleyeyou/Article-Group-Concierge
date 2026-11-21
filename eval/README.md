# Concierge evaluation harness

Runs a fixed set of persona-based queries through `/api/chat`, has Claude grade each response against what was actually retrieved, and writes a markdown report. Can repeat the run N times for mean and spread, re-grade an old run under the current rules, and ask a second, non-Anthropic grader for a sanity check.

```
personas.json ──► generate.ts ──► queries.json
                                       │
  preflight ──► dev server ◄── run.ts ◄┘──► results/<ts>/responses.json
  (credit,                                       │
   Supabase)               grade.ts (Opus) ──────┴──► results/<ts>/grades.json
                                                 │
        optional:          grade-second.ts ──────┴──► grades-second.json + agreement.json
                                                 │
                           report.ts ────────────┴──► report.md, grades.csv

batch.ts      = preflight → N × (run → grade → [grade2 on run 1] → report) → aggregate.md + batch.json
regrade.ts    = copy responses of an existing run → grade → report (judge calls only)
aggregate.ts  = mean / SD / min–max across runs, deltas against the baseline
```

## One-time setup

1. Add to `.env.local` (alongside the existing Supabase / OpenRouter keys):

   ```bash
   EVAL_DEBUG=true
   ```

   This lets `/api/chat` honour `{"debug": true}`: it bypasses the in-memory caches and returns the retrieved chunks, visual assets, metrics and raw model output alongside the normal response. **Set it only on the local dev server. Never set it in production.**

2. Start the dev server: `npm run dev`

3. Generate queries (needs Supabase + OpenRouter access): `npm run eval:generate`

## Running

```bash
npm run eval                      # generate (skipped if queries.json exists) → batch of EVAL_RUNS runs (default 1)
EVAL_RUNS=3 npm run eval          # three runs, then mean / SD / min–max
```

Commands:

| Command | What it does |
|---|---|
| `npm run eval` | `eval:generate` then `eval:batch`. `EVAL_RUNS` sets N (default 1, max 5). |
| `npm run eval:preflight` | Checks Supabase is reachable (the free tier pauses), the OpenRouter key has enough credit, and the dev server is up. Exits 2 with a clear message instead of recording errors. Spends nothing. |
| `npm run eval:generate` | Builds `eval/queries.json` from `personas.json` and the live document index. Skips if the file exists; `-- --force` regenerates. |
| `npm run eval:run` | Posts every query to the chat API, one at a time with a 4s gap. `-- --persona p5` or `-- --limit 3` for a smoke test. |
| `npm run eval:grade` | Grades the latest run with Opus. Resumes if interrupted; `-- --force` re-grades everything; `-- --dir eval/results/<ts>` targets another run. |
| `npm run eval:grade2` | Optional second grader on a 15-response sample (see below). Needs Opus grades on the same run first. `-- --dir`, `-- --sample N`, `-- --force`. |
| `npm run eval:report` | Writes `report.md` and `grades.csv` for the latest (or `--dir`) run. |
| `npm run eval:batch -- --runs N [--second-grader]` | Preflight, then N × run + grade + report, with the second grader on run 1 when the flag (or `EVAL_SECOND_GRADER=on`) is set. Writes `results/batch-<ts>/` with `batch.json` (measured credit cost) and `aggregate.md`. |
| `npm run eval:aggregate -- --dirs a,b,c` | Mean, SD and min–max per metric over already-graded runs, with deltas against the baseline. |
| `npm run eval:regrade [-- --of <dir>]` | Re-grades a copy of a run (default: the frozen baseline) under the current harness. Judge calls only. |
| `npm run eval:test` | Unit tests (numbers, concierge-config, rubric, metrics, agreement). Free. |

### Costs

One run is about **$3.50** (50 chat requests plus 50 Opus grading calls). A re-grade of 50 responses is about **$2** (judge only, estimate). The second grader on 15 responses is about **$1** (estimate, Opus-like pricing). The preflight prints the remaining credit before spending; `batch.json` and `regrade.json` record the measured cost as the credit delta.

## What gets scored

Each response gets 1–5 plus a one-line reason on:

| Criterion | Question |
|---|---|
| grounded | Is every client, case study, metric and outcome present in the retrieved context? ≤ 2 is flagged as a **hallucination**. |
| components | Valid layout JSON, registry tags only, required props, slugs/media/titles taken from context, prompt rules followed. |
| fallback | **Honest reframing standard:** when nothing relevant was retrieved, showing adjacent work is fine, but it must not be presented as a direct match, imply experience AG doesn't have, or invent anything. `would_strict_pass_fallback` records whether it *explicitly* admitted the gap. |
| cta | Ends with specific follow-up questions, plus a Strategy Lead offer where the shared config requires it. |
| voice | Matches the brand voice described in the orchestrator prompt. |

The grader reads the live `SYSTEM_PROMPT` from `src/lib/orchestrator.ts`, so prompt changes automatically flow into the voice and component standards.

### What the grader sees

The query, the retrieved context, the automated checks and the response. That is what the concierge itself saw. The grader does **not** see the persona, the `expected` block or the query type, so it cannot grade on information the app never had (EVAL-03). Personas are used only to generate queries and to group results in the report.

### Unsupported-claim kinds

Every unsupported claim the grader lists is classified as one of:

- `goal_as_result`: a goal, aim, brief or intended outcome in the context is presented as an achieved result.
- `capability_not_shown`: the response says or implies AG offers or has done a kind of work that no retrieved case study shows. Articles show AG's thinking, not proof of capability.
- `generated_tags`: a CaseStudyTeaser `capabilities` or `industries` value that the retrieved content for that case study does not state.
- `other`: any other unsupported claim (invented client, case study, metric, deliverable, audience detail or outcome, or confirming an engagement the user asserted).

### Number normalisation

Numbers that express the same quantity in a different format are the same number: `8M+` = `over 8 million` = `8,000,000`; `40%` = `40 percent`; `3x` = `three times`. The deterministic `metrics_not_in_context` check compares quantities (unit plus value, 0.5% tolerance), and the grader is told the same rule (`numbers.ts`).

### Shared config

The Strategy Lead rule (which situations require offering a conversation with the Strategy Lead) and the component-count rule come from `src/lib/concierge-config.ts`. Both the app prompt and the rubric are rendered from it, so they cannot drift. **Changing that file changes what the live concierge is told to do**, not just the eval.

## Baselines and comparison

- The frozen baseline run `2026-11-20T15-12-31` (commit `a5b2722`, graded with harness v1) is **read-only**. `grade`, `grade2` and `report` refuse to write there.
- Harness v2 changed the metric definitions, so a fair comparison needs the baseline graded under the same rules. `npm run eval:regrade` copies the baseline responses into `<timestamp>-regrade` (with `regrade_of` set) and grades that copy.
- The report's comparison table has two delta columns: **Δ vs frozen** mixes harness changes with app changes; **Δ vs re-graded** compares the same harness and is the like-for-like one. Retrieval recall, latency, `metrics_not_in_context` and the Strategy Lead rows are recomputed from the stored responses, so they are comparable either way.
- Spread across runs is the **sample SD (n−1)** plus **min–max**. With one run the SD is shown as `–`.

## Second grader and agreement score

`eval:grade2` sends a deterministic sample to a model from another provider, through OpenRouter, using the identical rubric, prompt and JSON schema as Opus. The default is `openai/gpt-5.6-sol` (listed on OpenRouter with structured outputs and reasoning effort); override with `EVAL_SECOND_GRADER_MODEL`. `anthropic/*` ids are refused. The Opus judge (`EVAL_MODEL`) is unchanged.

- **Sample:** 15 responses, stratified 3 per query type, ordered by `sha256('eval-06' + id)`, so the same ids are chosen every time.
- **Agreement score:** the share of (response × criterion) score pairs where the second grader is within ±1 of Opus.
- Also reported per criterion: exact-match rate, mean absolute difference (MAD) and quadratic weighted kappa (`–` when there is no expected disagreement), plus hallucination-flag agreement, "any unsupported claim" agreement, and a list of every pair that differs by 2 or more.
- Output: `grades-second.json` and `agreement.json` in the run directory; `report.md` gets a "Second grader agreement" section and a header line naming the model.

## Report sections

- Summary, comparison with baseline, averages per persona and per query type
- Hallucination flags, with the invented claims
- Unsupported claims by kind
- Second grader agreement (when `agreement.json` exists)
- Fallback behaviour on off-topic, out-of-domain and invention-bait queries
- **Retrieval gaps:** an expected case study wasn't retrieved, plus overall expected-case-study recall
- **Content gaps:** the query targets work on articlegroup.com/work that isn't indexed (fix by ingesting, not by tuning retrieval)
- Automated check failures, lowest-scoring responses, errors

## Rerunning after reingesting documents

1. Reingest as usual (`npm run ingest:*`, `npm run populate`, etc.).
2. **Restart the dev server.** Debug requests already skip the retrieval and response caches, but a restart guarantees nothing stale is held in memory.
3. Keep `queries.json` to compare before/after on identical queries. If you added or removed case studies, regenerate with `npm run eval:generate -- --force`, accepting that the new run isn't directly comparable with old ones.
4. `npm run eval:batch -- --runs 3` (add `--second-grader` for the agreement check).
5. Compare `aggregate.md` and each run's `report.md` with the baseline. Look first at **Retrieval gaps** and **Content gaps**.

## Files

| File | Notes |
|---|---|
| `personas.json` | Five hand-reviewed personas from articlegroup.com (p5 is deliberately out of domain). Used for query generation and report grouping only. |
| `queries.json` | Generated; commit it so runs stay comparable. Includes a snapshot of the indexed documents. |
| `results/` | Gitignored (responses contain signed storage URLs). |
| `lib.ts` | Shared types, the Claude JSON helper, automated checks. |
| `rubric.ts` | Rubric, output schema and prompt builder shared by every grader. |
| `numbers.ts`, `metrics.ts` | Number normalisation; per-run metrics and spread. |
| `agreement.ts` | Sample selection and agreement statistics. |
| `preflight.ts`, `batch.ts`, `regrade.ts`, `aggregate.ts`, `grade-second.ts` | Commands above. |

## Configuration

| Env var | Default | |
|---|---|---|
| `EVAL_DEBUG` | unset | Must be `true` on the **local dev server** for the runner to work. Never in production. |
| `EVAL_BASE_URL` | `http://localhost:3000` | Chat API base URL. |
| `EVAL_DELAY_MS` | `4000` | Gap between chat requests (the route allows 20/min). |
| `EVAL_MODEL` | `claude-opus-5-5` | Judge and query-generator model (stays claude-opus-5-5). |
| `EVAL_RUNS` | `1` | Runs per `npm run eval` / `eval:batch` (max 5). |
| `EVAL_SECOND_GRADER` | unset | `on` enables the second grader in `eval:batch`. |
| `EVAL_SECOND_GRADER_MODEL` | `openai/gpt-5.6-sol` | Second grader via OpenRouter; `anthropic/*` is refused. |
| `EVAL_SECOND_GRADER_SAMPLE` | `15` | Responses in the second-grader sample. |
| `EVAL_BASELINE_DIR` | `eval/results/2026-11-20T15-12-31` | Baseline used by report and aggregate comparisons. |
| `EVAL_MIN_CREDIT_USD` | 4 for a run, 3 for a re-grade, 2 for the second grader | Preflight stops if OpenRouter credit is below this. Batches use runs × 3.5 + 1 (+1 with the second grader). |
| `EVAL_GRADE_CONCURRENCY` | `3` | Parallel grading calls. |
| `EVAL_FALLBACKS` | on | Server-side refusal fallback on grader/generator calls; set `off` to disable. Not used via OpenRouter. |
| `OPENROUTER_API_KEY` | unset | Required. The app, ingestion scripts and eval route embeddings and Claude through OpenRouter (see `src/lib/llm-config.ts`). |

## Troubleshooting

- **Preflight exits 2 with "unreachable or paused"**: the Supabase free tier paused after inactivity. Restore the project in the Supabase dashboard (human action), wait until it is healthy, then rerun. No eval calls were made.
- **Preflight says the key has $X left**: top up OpenRouter or lower the scope (fewer runs, a smaller `--limit`).
- **"did not return debug data"**: `EVAL_DEBUG=true` is missing from `.env.local`, or the dev server wasn't restarted after adding it.
- **Every query errors with `embeddings_unavailable` / `database_unavailable`**: the dev server can't reach OpenRouter or Supabase. The run records the error per query and carries on.
- **`Orchestrator error: …`**: the chat model call failed. Production would have shown the polite fallback message; the eval records it as an error rather than grading it as an answer.
- **`eval:grade2` says to run `eval:grade` first**: the second grader compares against Opus grades made with the current harness version.
- **"X is the frozen baseline and is read-only"**: use `npm run eval:regrade` to grade a copy.
