# Phase 5: Speed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-23
**Phase:** 05-speed
**Areas discussed:** Instant teasers, Hero streaming + output, Measuring speed in eval, Health check behaviour

---

## Instant teasers

| Question | Options | Selected |
|----------|---------|----------|
| Which studies show at ~1.5 s | Top few, then prune / Only confident matches / All retrieved, model reorders | Top few, then prune |
| Teaser text before the model's summary exists | DB text, then model's / DB text only, permanently / Title card, fill later | DB text, then model's |
| Placement while hero streams | Final layout slots / Top first, then move / You decide | Final layout slots |
| No-match queries in the first 1.5 s | Nothing until the hero / Adjacent work, labelled | Nothing until the hero |

**Notes:** Claude added a caveat to D-504. Retrieval has no score cutoff, so it needs a calibrated pre-model suppression signal.

## Hero streaming + output

| Question | Options | Selected |
|----------|---------|----------|
| Getting the hero out early | Parse partial JSON / One component per line / Separate fast hero call | Parse partial JSON |
| Text reveal | Type in as it streams / Whole blocks | Type in as it streams |
| Mid-stream failure | Keep content + retry note / Clear and show error | Keep content + retry note |
| GEN-07 verifier | Leave it off / Re-evaluate as async patch | Leave it off |

## Measuring speed in eval

| Question | Options | Selected |
|----------|---------|----------|
| Eval path | Eval reads the stream / Keep JSON for eval | Eval reads the stream |
| Pass bar | Median, p90 reported / p90 must pass / Median + spot check | Median, p90 reported |
| Budget | Top up before phase-end / Subset only, no top-up | Top up before phase-end |
| No-regression bar | Phase 4 run, noise-aware / Exact: no metric worse | Phase 4 run, noise-aware |

## Health check behaviour

| Question | Options | Selected |
|----------|---------|----------|
| Where it runs | /api/health + startup log / /api/health only / Startup only | /api/health + startup log |
| On failure in production | Report only, chat unchanged / Block chat with a message | Report only, chat unchanged |
| Low-credit threshold | Warn < $5, fail at $0 / Warn < $10 | Warn < $5, fail at $0 |

## Claude's Discretion

Transport (SSE vs NDJSON), route shape, incremental parser, cache-hit emission, D-504 signal design, thumbnails and skeletons, and parallelising pre-model work.

## Deferred Ideas

- Verifier as an async patch pass
- Blocking chat on a failed health check
- DB deliverables as the permanent teaser summary
