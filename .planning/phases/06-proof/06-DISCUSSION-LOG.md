# Phase 6: Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-11-24
**Phase:** 06-proof
**Areas discussed:** Expanded query set, Measuring speed for the bar, Fix first or prove first, Demo queries + one-pager

---

## Expanded query set

| Question | Options | Selected |
|----------|---------|----------|
| Set size | 75 (+25, ~$16 for 3 runs) / 100 (+50, ~$22) / 65 (+15, ~$14) | 75 ✓ |
| Composition | Held-out, same mix / Owner-style questions / Mix of both | Held-out, same mix ✓ |
| Labels | Claude drafts, user approves / Claude alone / User writes | Claude drafts, user approves ✓ |
| Bar scaling | Proportional < 10% / Keep absolute < 5 / Gate on original 50 only | Proportional ✓ |

## Measuring speed for the bar

| Question | Options | Selected |
|----------|---------|----------|
| Speed source | US client → production / Production server logs / Local eval as-is | US client → production ✓ |
| Cold starts | Gate warm, report cold / Include cold in median / Must pass cold too | Gate warm, report cold ✓ |
| Speed runs | One timing batch per run / One timing batch overall | One per run ✓ |

## Fix first, or prove first

| Question | Options | Selected |
|----------|---------|----------|
| Fix vs prove | Fix pass first / Prove first / One dry run first | Fix pass first ✓ |
| On failure | Fix, restart all three / Fix, rerun failed one / Stop and ask | Fix, restart all three ✓ |
| Static checks | Re-check now / Carry forward Phase 2 | Re-check now ✓ |
| Budget cap | ~$30, ask beyond / ~$20, ask beyond / Ask before every paid run | ~$20, ask beyond ✓ |

**Notes:** Claude added that the fix pass tunes only against the original 50, so the 25 held-out queries stay unseen (follows from the held-out choice).

## Demo queries + one-pager

| Question | Options | Selected |
|----------|---------|----------|
| Demo picks | Claude proposes ~10, user picks 5 / User chooses / Claude picks all 5 | Claude proposes ~10 ✓ |
| Verification | Prod run + claim-by-claim check / Prod run + eval grade / Prod run + user review | Claim-by-claim ✓ |
| One-pager | For the owner, shareable page / For the user, markdown / Both | For the owner, shareable page ✓ |

**Notes:** Claude added that the page names its limitations (cold starts, metrics that only just clear their bar), in line with the core value.

## Claude's Discretion

- Wording of the held-out queries; the US-runner choice and cache-safe timing batch design; how each known gap is fixed; report structure; second-grader sampling.

## Deferred Ideas

- Cold starts passing the bar (keep-warm / region change).
- DB deliverables as the permanent teaser summary.
- Nightly eval (V2-01).
