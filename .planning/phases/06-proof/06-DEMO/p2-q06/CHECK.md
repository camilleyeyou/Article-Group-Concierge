# Check sheet: p2-q06

Query: insurance experience?

Verdict: VERIFIED under both rules (strict: same two teasers in all rounds; claims: 0 unsupported, no leak). No video. No Strategy Lead offer in any round.

## Round 1 (2026-11-25T17:26:30.878Z, http 200, complete 15451 ms)

- Hero: **Insurance Needs a Story That Earns Confidence** / Looking for insurance experience / You're asking about insurance experience, and what that could mean for communicating in a complex, high-stakes category.
- StrategyCard: **Structure Before Slides**: With dense financial material, our approach would be to set the visual logic first, so every chart and page follows one system and the audience always knows where they are in the story.
- Teaser `aig-when-stakes-are-high-reintroducing-aig-to-the-market`: We designed the keynote for AIG's first Investor Day in over a decade, including a visual direction and design guide, hundreds of slides, graphs and charts, and event branding. [capabilities: Creative Direction, Events & Keynotes; industries: Finance]
- Teaser `android-enterprise-hyper-targeted-consideration-campaign`: We built a consideration campaign for the financial services industry, with content aimed at sub-sectors including insurance: a 16-page eBook on mobile device management, a research-driven blog post and promotional social posts. [capabilities: Content Marketing, Growth Marketing; industries: Enterprise Software, Finance]
- Narrative: AIG is our most direct insurance work, and it shows how we handle dense financial material for an executive audience. Android Enterprise is adjacent: it covers financial services broadly, with insurance as one of the sub-sectors its content spoke to. For you, we'd start by pinning down who most needs to believe the story, whether investors, buyers or partners.

## Round 2 (2026-11-25T18:35:54.873Z, http 200, complete 16766 ms)

- Hero: **Insurance: Finding the Right Partner for the Story** / Insurance marketing and communications / You're asking about insurance experience. Here is what we can point to in our portfolio.
- StrategyCard: **Find the Story Inside the Data**: In financial services, we'd start by deciding the one thing the numbers need to say, then design every visual to carry that message instead of just displaying data.
- Teaser `aig-when-stakes-are-high-reintroducing-aig-to-the-market`: We worked with AIG's C-suite over a two-month sprint on the keynote visual design system, hundreds of slides, and event branding for their first Investor Day in over a decade. [capabilities: Creative Direction, Events & Keynotes; industries: Finance]
- Teaser `android-enterprise-hyper-targeted-consideration-campaign`: We built a consideration campaign for Android Enterprise aimed at financial services, with content for sub-sectors including insurance: a 16-page eBook, a research-driven blog post, and promotional social posts. [capabilities: Content Marketing, Growth Marketing; industries: Enterprise Software, Finance]
- Narrative: AIG is our direct insurance work, built around turning complex financials into a clear story. The Android Enterprise campaign is adjacent: it targeted financial services broadly, with insurance as one of its sub-sectors. For you, we'd start by pinning down who needs persuading, whether investors, customers or partners, because that decides what the story has to do.

## Round 3 (2026-11-25T19:41:55.308Z, http 200, complete 14910 ms)

- Hero: **Insurance Needs Clarity, Credibility and a Story That Holds** / Marketing and communications in insurance / You're asking about insurance experience, and what that could mean for a brand or company in this space.
- StrategyCard: **Make Complexity Legible**: In financial services, we'd start by deciding the few ideas your audience must walk away with, then shape the data, design and story around them.
- Teaser `aig-when-stakes-are-high-reintroducing-aig-to-the-market`: We designed the keynote visual system and presentation for AIG's first Investor Day in over a decade, including hundreds of slides, graphs and charts, plus environmental and simulcast event branding. [capabilities: Creative Direction, Events & Keynotes; industries: Finance]
- Teaser `android-enterprise-hyper-targeted-consideration-campaign`: We made a 16-page eBook on mobile device management in financial services, a research-driven blog post and promotional social posts, with content aimed at sub-sectors including banking, insurance, investing and fintech. [capabilities: Content Marketing, Growth Marketing; industries: Enterprise Software, Finance]
- Narrative: AIG is our most direct insurance work. Android Enterprise is adjacent: it was a technology campaign for financial services, with insurance as one of several sub-sectors. We'd start by pinning down who you need to reach, whether investors, customers or IT buyers, because that shapes everything after it.

## Stability

| round | started | teaser slugs | video URLs | Strategy Lead offer | rag_cache_hit | orch_cached |
|---|---|---|---|---|---|---|
| 1 | 2026-11-25T17:26:30.878Z | aig-when-stakes-are-high-reintroducing-aig-to-the-market, android-enterprise-hyper-targeted-consideration-campaign | none | no | 0 | false |
| 2 | 2026-11-25T18:35:54.873Z | aig-when-stakes-are-high-reintroducing-aig-to-the-market, android-enterprise-hyper-targeted-consideration-campaign | none | no | 0 | false |
| 3 | 2026-11-25T19:41:55.308Z | aig-when-stakes-are-high-reintroducing-aig-to-the-market, android-enterprise-hyper-targeted-consideration-campaign | none | no | 0 | false |

## Notes

Perf flags: rag_cache_hit 0, orch_cached false every round; rounds 17:26:30, 18:35:54, 19:41:55 UTC. Round 2 hero says "Here is what we can point to in our portfolio" (normal user-facing wording, not a retrieval leak). Round 2 AIG teaser "two-month sprint ... C-suite" and round 3 "environmental and simulcast event branding" are in source.

## Claims

Round 1 items, checked by hand against the appendix (and, for catalogue-wide statements, 06-CATALOGUE.md). Advice phrased as "we'd start by..." is a proposed approach, not a claim about past work, and is marked n/a-approach.

| item | source slug | supporting quote from indexed text | verdict | stable in rounds 2-3 |
|---|---|---|---|---|
| Hero: insurance experience; communicating in a complex, high-stakes category | | restates the query | supported | yes |
| StrategyCard: set the visual logic first so every chart and page follows one system | | proposed approach | n/a-approach | yes |
| Teaser AIG: keynote for AIG's first Investor Day in over a decade; visual direction and design guide; hundreds of slides, graphs and charts; event branding | aig-when-stakes-are-high-reintroducing-aig-to-the-market | "first Investor Day in over a decade"; "event and keynote visual direction and design guide"; "hundreds of slides, graphs, and charts"; "environmental and simulcast event branding" | supported | yes |
| Teaser Android: consideration campaign for financial services; content for sub-sectors including insurance; 16-page eBook on MDM; research-driven blog post; promotional social posts | android-enterprise-hyper-targeted-consideration-campaign | "sub-sectors like banking, insurance, investing, and fintech"; "16-page eBook exploring the nuances of mobile device management"; "research-driven blog post"; "promotional social posts" | supported | yes |
| Tags: Creative Direction, Events & Keynotes / Finance (AIG); Content Marketing, Growth Marketing / Enterprise Software, Finance (Android) | both | DB tags match | supported | yes |
| Narrative: AIG is our most direct insurance work; shows how we handle dense financial material for an executive audience | aig-when-stakes-are-high-reintroducing-aig-to-the-market | "global insurance giant"; "complex strategic roadmap and financials"; "AIG's C-suite" | supported | yes |
| Narrative: Android Enterprise is adjacent; financial services broadly, insurance one of the sub-sectors | android-enterprise-hyper-targeted-consideration-campaign | sub-sectors list above | supported | yes |
| Narrative: we'd start by pinning down who most needs to believe the story | | proposed approach | n/a-approach | yes |

## Appendix: indexed source text

### aig-when-stakes-are-high-reintroducing-aig-to-the-market

Title: AIG: When Stakes Are High: Reintroducing AIG to the Market; client: AIG; hero_video_url: none; vimeo_url: none
DB capabilities: Creative Direction, Events & Keynotes; DB industries: Finance

[chunk 0] For their first Investor Day in over a decade, global insurance giant AIG needed a creative partner to turn their complex strategic roadmap and financials into a compelling visual narrative that reinforced their transformation and built market confidence. Over a two-month sprint, Article Group worked side-by-side with AIG's C-suite and partners to create a keynote visual design system bringing clarity and visual intrigue to complex data and the story of performance, turnaround, and transformation. In the final week, the team embedded on-site in NYC to refine delivery, finalize hundreds of slides and key materials, and support live production. Solution included event and keynote visual direction and design guide, keynote presentation design including hundreds of slides, graphs, and charts, environmental and simulcast event branding and design, on-site keynote adjustments and delivery, and production solutioning and problem solving.

### android-enterprise-hyper-targeted-consideration-campaign

Title: Android Enterprise: Hyper-Targeted Consideration Campaign; client: Android Enterprise; hero_video_url: none; vimeo_url: none
DB capabilities: Content Marketing, Growth Marketing; DB industries: Finance, Enterprise Software

[chunk 0] The financial service industry (FSI) has a strong appetite for modern technology, but a complex web of regulatory and security concerns makes it difficult to manage their software and devices. Android Enterprise needed to tell a hard-working story about the advantages they have to offer across mobile devices and IT management. AG helped Android Enterprise create a marketing moment with a consideration campaign built on flexibility and modernization. We enhanced messaging with distinct content that connected with industry sub-sectors like banking, insurance, investing, and fintech. Solution included a 16-page eBook exploring the nuances of mobile device management in FSI, research-driven blog post to share insights and promote eBook and webinar, and promotional social posts to drive engagement.
