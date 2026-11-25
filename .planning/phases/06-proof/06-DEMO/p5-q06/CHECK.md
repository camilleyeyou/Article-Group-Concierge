# Check sheet: p5-q06

Query: how much do u charge

Verdict (strict rule): REPLACE (pricing implication, undelivered promise, retrieval leak)
Verdict (demo_rule: claims): REPLACE (round 1 "only paying for what moves you forward" implies a pricing commitment; round 3 "Nothing we retrieved speaks to pricing" leaks retrieval language)

## Round 1 (2026-11-25T15:09:01.071Z, http 200, complete 9933 ms)

- Hero: **Understanding What a Project Would Cost** / Pricing and scope / You're asking what we charge and want a sense of the investment involved.
- StrategyCard: **Start With the Problem**: We'd begin by getting clear on what you need to change and who needs to believe it. Then we'd shape the work around that, so you're only paying for what moves you forward.
- Narrative: Cost depends on scope, so we can't give you a figure here. Tell us what you're trying to achieve and we can point you to the closest work in our portfolio. Our Strategy Lead can scope it with you.

## Round 2 (2026-11-25T16:15:26.349Z, http 200, complete 9647 ms)

- Hero: **Understanding What a Creative Engagement Costs** / Pricing and scope / You're asking how much we charge and want a sense of what an engagement would involve.
- StrategyCard: **Scope Before Price**: We'd start by defining the problem you need solved and what you want in hand at the end of it, so any conversation about investment is tied to a clear scope rather than a generic rate.
- Narrative: We don't publish rates, and cost depends on scope, so we can't give you a number here. Our first step would be to understand what you need made and who it's for. Our Strategy Lead can scope that with you and talk through investment.

## Round 3 (2026-11-25T17:21:31.463Z, http 200, complete 8107 ms)

- Hero: **Understanding What a Project Will Cost** / Pricing and fees / You're asking what we charge and want to know what working together might involve.
- StrategyCard: **Scope Before Price**: We'd start with the outcome you're after and the audience you need to reach, then shape the work around that rather than starting from a fixed package.
- Narrative: Price depends on scope, so we don't quote figures here. Nothing we retrieved speaks to pricing, so we haven't shown client work. The first step is a short conversation about what you're trying to achieve, and our Strategy Lead can scope that with you.

## Stability

| round | started | teaser slugs | video URLs | Strategy Lead offer | rag_cache_hit | orch_cached |
|---|---|---|---|---|---|---|
| 1 | 2026-11-25T15:09:01.071Z | none | none | yes | 0 | false |
| 2 | 2026-11-25T16:15:26.349Z | none | none | yes | 0 | false |
| 3 | 2026-11-25T17:21:31.463Z | none | none | yes | 0 | false |

## Notes

Round 2 narrative also says "We don't publish rates", which no indexed text supports (probably true but unsourced). Layout is stable (hero + card, no teasers, Strategy Lead offered every round) and no figure is invented, so this is a wording problem, not an invention problem. Perf flags present each round (rag_cache_hit 0, orch_cached false); rounds 15:09:01, 16:15:26, 17:21:31 UTC.

## Claims

Round 1 items, checked by hand against the appendix (and, for catalogue-wide statements, 06-CATALOGUE.md). Advice phrased as "we'd start by..." is a proposed approach, not a claim about past work, and is marked n/a-approach.

| item | source slug | supporting quote from indexed text | verdict | stable in rounds 2-3 |
|---|---|---|---|---|
| Hero: Understanding What a Project Would Cost / Pricing and scope / you're asking what we charge | | restates the query | supported | yes (same each round) |
| StrategyCard: begin by getting clear on what you need to change and who needs to believe it | | proposed approach | n/a-approach | yes |
| StrategyCard: "so you're only paying for what moves you forward" | | no indexed text about pricing or billing | unsupported (implied pricing commitment) | not repeated in rounds 2-3 |
| Narrative: cost depends on scope, so we can't give you a figure here | | makes no figure claim | supported | yes |
| Narrative: "we can point you to the closest work in our portfolio" | | no work is shown in the layout, so the promise is not delivered | unsupported (promise with nothing shown) | no (rounds 2-3 do not say it) |
| Narrative: our Strategy Lead can scope it with you | | config offer | supported | yes |

## Appendix: indexed source text
