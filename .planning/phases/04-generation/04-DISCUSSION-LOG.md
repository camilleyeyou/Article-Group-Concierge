# Phase 4: Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md; this log preserves the alternatives considered.

**Date:** 2026-11-22
**Phase:** 04-generation
**Areas discussed:** Outcome wording, Narrative & voice, Strategy Lead offer, Verifier & eval budget

---

## Outcome wording

| Question | Options | Selected |
|---|---|---|
| Client's aim only in source | Deliverables only / Aim, explicitly framed / Only stated results | Deliverables only |
| Events phrased as plans | Only if stated / Allow obvious inference | Only if stated |
| Where honesty rules apply | Everywhere (incl. teaser summary) / Server-side teaser summary | Everywhere |
| Model inferences | No inferred facts / Allow labelled inference | No inferred facts |
| "Can you do X?" with no study | Honest + closest work / Conditional yes | Honest + closest work |

## Narrative & voice

| Question | Options | Selected |
|---|---|---|
| Enforcing 2-4 sentences | Prompt rule + eval check / Also trim on server | Prompt rule + eval check |
| What the narrative adds | The "why it fits" link / A point of view | The "why it fits" link |
| "We" voice | Always we/our / We in narrative only | Always we/our |
| StrategyCard content | Approach only, max 2 / Optional, at most 1 | Approach only, max 2 |
| Prompt example | New fictional example / Real AG study / Two short examples | New fictional example |
| Casual register | Plain but premium / Same register always | Plain but premium |

## Strategy Lead offer

| Question | Options | Selected |
|---|---|---|
| Triggers (multi) | fallback / pricing / timeline / invention_bait | All four |
| Form | Closing narrative line / StrategyCard "Next step" | Closing narrative line |
| Numbers on pricing/timeline | Never / Only if indexed | Never |
| Outside triggers | No, triggers only / Optional | No, triggers only |
| Measuring "expected" | Labels + keywords / Grader decides | Labels + keywords |

## Verifier & eval budget

| Question | Options | Selected |
|---|---|---|
| ~$16 left vs ~$22 needed | Top up credit / Stay within $16 / Fewer Phase 4 runs | User will top up |
| Verifier kind | Haiku claim-check / Deterministic only / Sonnet self-revision | Haiku claim-check |
| Latency budget | <= 2 s off hero path / <= 1 s total / Whatever honesty needs | <= 2 s off hero path |
| On a hit | Rewrite to supported / Delete it | Rewrite to supported |
| How to evaluate | On saved responses + re-grade / Full live eval | On saved responses |

## Claude's Discretion

- GEN-03 server-side teaser tags (overwrite from DB links via the catalogue; omit if no links)
- GEN-05 video rule wording
- Prompt wording, sentence splitting, keyword lists, smoke subset composition, optional aim-verb diagnostic

## Deferred Ideas

- Server-side teaser summaries (no summary source yet)
- Rendering contactCTA in the UI (new UI feature)
- Verification inside the streaming path (Phase 5)
