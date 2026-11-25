# Phase 6: Proof - Context

**Gathered:** 2026-11-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Show AG's owner, with evidence, that every ready-bar check holds. Phase 6 delivers:
- an expanded query set (75 queries), run three consecutive times with every ready-bar check passing on all three (PROOF-01);
- a one-page before/after against frozen baseline `2026-11-20T15-12-31` (PROOF-02);
- five demo queries, each verified to produce an accurate, strong response on production (PROOF-03).

Before the counted runs, a short fix pass closes the known gaps. Each fix is routed to the area that owns it (prompt/voice, retrieval, video data), and the bars stay as they are. The generation model (Sonnet 5.5) and the judge (Opus 5.5) stay unchanged.

</domain>

<decisions>
## Implementation Decisions

### Expanded query set (PROOF-01)
- **D-601:** 75 queries: the existing 50 in `eval/queries.json` plus 25 new ones.
- **D-602:** The 25 new queries are **held out**. They follow the existing type proportions (50% well_formed, 20% vague, 10% off_topic, 10% invention_bait, 10% multi_part; about 12/5/3/3/2), are written fresh, and are never used to tune anything.
  - The fix pass (D-607) tunes and checks only against the original 50.
  - The held-out queries are first run in the counted proof runs, or in a dry run whose only purpose is measurement.
  - Report the held-out results separately as well as in the totals, so generalisation is visible.
- **D-603:** Claude drafts the expected case studies (recall labels) and `fallback_expected` flags for the new queries from the DB catalogue, with evidence for each label. The user approves or edits them in one table **before any paid run**. Once approved, the labels are frozen, like the original frozen set.
- **D-604:** Scale the bars proportionally to 75 queries:
  - responses with any unsupported claim < 10% (at most 7 of 75);
  - recall >= 90% over all labelled expectations;
  - absolute-zero bars stay at 0 (goals stated as results, invention-bait presupposed, capabilities not shown);
  - voice >= 4.5 (mean).

### Speed measurement (PERF-01/02 within the ready bar)
- **D-605:** The speed bar gates on **client-side timings from a US machine against production** `/api/chat/stream` (for example a free CI runner using `eval/stream-smoke.ts` / `eval/stream-timing.ts` logic).
  - Bar: median `t_teasers` <= 1500 ms (non-suppressed queries) and median `t_hero_first` <= 4000 ms (same median definition as D-511).
  - Diagnostics only, not gates: server-side `PERF_TIMING` logs and the local eval timings (inflated by the Cameroon network: DLA → fra1 edge → iad1).
- **D-606:** Medians gate on **warm** requests. Cold-start timings are measured and reported separately. For the owner demo, warm the app first.
- **D-606a:** Each of the three proof runs gets its own production timing batch (~20 queries from the set, cents each), so speed "holds on all three" like every other bar.
  - Production timing requests must not be orchestrator or RAG cache hits. Production caches are in-memory: the orchestrator TTL is 30 min, RAG is 1 h, and `debug` is ignored in production.
  - Use distinct queries per batch or another cache-safe design, and record the `PERF_TIMING` cache-hit flag to prove it.

### Fix first, then prove
- **D-607:** Run a fix pass **before** the counted runs, on the known gaps:
  - voice 4.48 vs 4.5;
  - recall exactly at 90% (47/52), with no margin;
  - the cybersecurity answer understating its retrieved studies;
  - the missing Google for Education video (p4-q09).

  Route each fix to its owning area (prompt/voice: Phase 4 rules; retrieval: Phase 3; video data: Phase 2/quick 261124-0q7), keeping those phases' gates (D-513 no-regression bar). Verify with cheap subset runs on the original 50 only (D-602).
- **D-608:** If any proof run fails any bar, stop, fix it in the responsible area, then **restart the count from zero**. All three counted runs must be on the same code. Never relax a bar (ROADMAP gate).
- **D-609:** Re-check the two bars the eval doesn't measure, against the current site and DB:
  - re-run the articlegroup.com/work diff (`scripts/site-work-diff.ts`) for "site work missing from index = 0";
  - re-confirm the video audit (`scripts/video-audit.ts`, including the videos hidden and the posters added in quick 261124-0q7) for "mismatched videos = 0".

  Ingesting any newly found site work needs user approval (Phase 2 rule).
- **D-610:** Budget cap **~$20** for the whole phase (fix-pass subset runs, three proof runs on 75 queries at ~$5.25 each, second grader ~$1, production timing batches). Any restart or spend beyond the cap needs the user's OK first.
  - Current credit is ~$10, so the user tops up before the paid runs.
  - Run preflight before every paid run, and restore Supabase if it has paused.
  - A full restart of three runs does not fit inside the cap, so it must be asked for.

### Demo queries (PROOF-03)
- **D-611:** Claude shortlists about 10 candidates, drawn from proof-run results, and the user picks 5. The shortlist must show range:
  - a strong direct match;
  - a video;
  - a multi-part question;
  - an honest "we haven't published work on that", with the closest real work;
  - a pricing or timeline answer with the Strategy Lead offer.
- **D-612:** "Verified" means:
  - each query is run on **production** several times (warm);
  - every claim, tag, metric, video and link in each answer is checked against the indexed source text;
  - the answer is stable across runs;
  - the check sheet for each query is saved in the phase directory.

  A query that is unstable or has any unsupported claim is replaced or fixed. It is never shown as-is.

### Before/after page (PROOF-02)
- **D-613:** The audience is **AG's owner** (very detail-oriented), so the page is written in plain language. Contents:
  - each ready-bar check, frozen baseline vs final (three-run mean and min–max range), pass/fail, and a short note per metric;
  - every metric's delta listed.

  Publish it as a private shareable page (Artifact), with a markdown copy in the phase directory.
- **D-614:** The page names what isn't perfect yet: cold-start latency, any metric that only just clears its bar, and anything else known. Honesty about limits is part of the core value; the page must not oversell.

### Claude's Discretion
- Exact wording of the 25 held-out queries, within D-602's mix and in the style of the existing personas.
- Whether the US-vantage timing runs on GitHub Actions (the repo is on GitHub) or another free US runner, and the exact batch design that avoids cache hits.
- How each known gap is fixed in the fix pass, within the owning phase's rules.
- The structure of the report and aggregation changes needed for 75 queries, held-out splits and three-run mean/range.
- Whether to run the second grader on one of the three runs or on a sample across them (~$1, EVAL-06 sample size).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bars and scope
- `.planning/ROADMAP.md` §"Phase 6: Proof": success criteria and the "return to earlier phase, don't relax" gate
- `.planning/REQUIREMENTS.md`: PROOF-01..03, and the partial GEN-01/GEN-04/GEN-06/PERF-01/PERF-02 status
- `.planning/PROJECT.md`: core value, ready bar, constraints (models, budget, DB safety, EVAL_DEBUG)
- `eval/PLAN.md` §"Ready bar": the original ready-bar table

### Prior decisions that still hold
- `.planning/phases/05-speed/05-CONTEXT.md`: D-510/D-511 timing definitions, D-513 no-regression bar, D-504 suppression
- `.planning/phases/04-generation/04-CONTEXT.md`: honesty/voice rules (D-401..D-414) the fix pass must respect
- `.planning/phases/03-retrieval/03-CONTEXT.md`: retrieval decisions (cap8, no reranker by default)
- `.planning/phases/02-content-and-data/02-SITE-DIFF.md`, `02-VIDEO-AUDIT.md`: the previous static-check results to re-confirm (D-609)

### Latest measurements
- `eval/results/2026-11-24T10-42-25/report.md`: latest full eval (voice 4.48, recall 47/52, unsupported 4/50, local teasers 2.4 s, hero 3.9 s)
- `eval/results/2026-11-20T15-12-31/`: frozen baseline; `eval/results/2026-11-21T07-32-49-regrade/`: re-graded baseline
- `.planning/STATE.md`: production timing findings (server teasers ~0.75 s; cross-region path; caches)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `eval/queries.json`: 50 queries (`id`, `persona_id`, `type`, `text`, `expected`); extend it to 75 with held-out ids
- `eval/labels.ts`: frozen/corrected label sets; add the held-out labels the same frozen way
- `eval/batch.ts` + `eval/aggregate.ts`: N-run batch with mean/SD/min–max; preflight via `eval/preflight.ts` (credit check sized per run count)
- `eval/report.ts` + `eval/metrics.ts`: baseline comparison table and Phase 5 gate table; extend them with a Phase 6 ready-bar table (proportional bars, held-out split)
- `eval/grade-second.ts` + `eval/agreement.ts`: second grader (openai/gpt-5.6-sol)
- `eval/subsets.ts`: subset runs for the cheap fix-pass checks
- `eval/stream-smoke.ts`, `eval/stream-timing.ts`, `eval/stream-client.ts`: client-side SSE timing against any `EVAL_BASE_URL`; the base for the US-vantage production timing batches
- `src/lib/perf-marks.ts` + `PERF_TIMING=true` on Vercel production: server-side `perf_teaser` log lines with a cache-hit flag (diagnostic)
- `scripts/site-work-diff.ts`, `scripts/video-audit.ts`: static re-checks (D-609)

### Established Patterns
- Paid runs: preflight → run → grade → report, then report deltas vs the frozen and re-graded baselines
- One phase = one squashed commit, pushed after user approval
- Production caches are in-memory (`src/lib/cache.ts`: orchestrator 30 min, RAG 1 h, embedding 24 h); `debug` only works with `EVAL_DEBUG=true`, never in production

### Integration Points
- Production URL `article-group-concierge.vercel.app`, route `/api/chat/stream` (SSE) and JSON `/api/chat`
- GitHub repo `camilleyeyou/Article-Group-Concierge` (possible free US runner via Actions)

</code_context>

<specifics>
## Specific Ideas

- The owner is very detail-oriented. A wrong demo claim is worse than a weak metric, so check demo answers claim by claim on production.
- Warm the app before the live demo (cold starts are reported, not hidden).
- The held-out queries exist to show the 50-query results weren't tuned to the test.

</specifics>

<deferred>
## Deferred Ideas

- Making cold starts pass the bar (keep-warm or a platform/region change). Out of scope here: cold is reported, not gated.
- DB deliverables as the permanent teaser summary (carried over from Phase 5's deferred list). Revisit only if teaser-summary claims block the bar.
- Automated nightly eval with regression alerts (V2-01).

</deferred>

---

*Phase: 06-proof*
*Context gathered: 2026-11-24*
