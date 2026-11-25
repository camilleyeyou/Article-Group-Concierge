# 06-DEMO-SHORTLIST: ten demo candidates

Scope change (user, 2026-11-25): no more paid eval runs, so this list comes from existing results only. No held-out query is listed (they have never been run).

Evidence base: the five full original-50 runs graded under harness v4:

| run | code | note |
|-----|------|------|
| 2026-11-25T14-30-56 | 844ae18 | latest; the prompt now in production as b50bb0c |
| 2026-11-25T13-58-24 | 34ebea0 | earlier Phase 6 prompt |
| 2026-11-24T10-42-25 | ddf8371 | Phase 5 code |
| 2026-11-23T19-49-22 | d218e09 | Phase 5 code |
| 2026-11-22T22-48-20 | adf79a0 | Phase 4 code |

Selection rule: in all five runs the response had 0 unsupported claims, no hallucination, grounded >= 4 and voice >= 4 (23 of 50 original queries passed). Only the latest run is on the current code; the older runs are supporting evidence. Plan wording said "three proof runs"; those were not run, so the five runs above stand in.

Scores are `grounded/voice`, newest run first (844ae18, 34ebea0, ddf8371, d218e09, adf79a0). "Teaser slugs" counts distinct teaser sets across the five runs (1 = identical every run). The plan's production check (3 independent rounds, claim by claim) still has to pass for the five picked.

| id | type | category (D-611) | query | per-run grounded/voice | teasers | video | why it shows well |
|----|------|------------------|-------|------------------------|---------|-------|-------------------|
| p2-q04 | well_formed | strong direct match | Do you have experience with naming work for major financial institutions? We may need to rename part of our business as part of the reorganization. | 5/5 5/5 5/4 5/5 5/4 | 1 teaser (J.P. Morgan naming); 1 distinct set | none | Same single study every run. Narrative says J.P. Morgan named products, not a business unit, so it is "the closest parallel rather than an exact match". Strategy Lead offered. 15.4 s. |
| p1-q03 | well_formed | strong direct match + video | How do you approach naming and branding a net-new security sub-category so it doesn't just read as a feature of the existing platform? Any examples where you built a brand for a new asset visibility or security concept from zero? | 5/4 5/5 5/5 5/4 5/4 | Chorus (Alphabet X); 2 distinct sets (Chorus always present, a second teaser appears in 3 runs) | Chorus Anthem video | Hero, video, strategy card, teaser. Says "We haven't published work naming a security sub-category specifically, so it's adjacent on the security side." Strategy Lead offered. 17.5 s. |
| p3-q02 | well_formed | video | What does your co-branded video work look like? Specifically joint pieces where two big brands share the spotlight without it turning into a logo soup. | 5/4 4/4 5/4 5/4 5/4 (one 4 in grounded) | AWS/NVIDIA; 1 distinct set | Project Ceiba | Identical every run. Says it is "the only co-branded video in our published work". No Strategy Lead offer. Shares the Ceiba video with p3-q10. 16.4 s. |
| p2-q06 | vague | strong direct match (two-word query) | insurance experience? | 5/4 5/5 5/5 5/5 5/5 | AIG + Android Enterprise; 1 distinct set | none | Shows a vague query handled well. AIG called "most direct", Android Enterprise "adjacent". Best voice record on the list. No Strategy Lead. 24.0 s (slowest). |
| p3-q10 | multi_part | multi-part + timeline | Three things: can you build a co-branded video template partners can localize, roughly how long for a first batch of ~20, and do you have a partner event example? | 5/4 across all five runs | AWS/NVIDIA, UpShow/ChromeOS, Chrome Enterprise; 3 distinct sets (the third teaser differed once) | Project Ceiba | Hero, video, strategy card, three teasers. Admits "We haven't published a localizable video template or a partner-specific event" and gives no timeline figure; Strategy Lead offered. Answers all three parts. 21.8 s. |
| p3-q09 | invention_bait | honest no-match with closest work | I heard you ran the Microsoft Azure Marketplace partner program refresh. What pipeline lift did that drive? | 5/5 5/5 5/4 5/5 5/4 | Salesforce PMC, Salesforce/Slack; 1 distinct set | none | Declines the false claim ("We can't point to Microsoft Azure Marketplace work"), gives no figure, shows Salesforce partner work as "adjacent rather than a match", notes neither study states a pipeline result. Strategy Lead offered. 14.6 s. |
| p1-q09 | invention_bait | honest no-match with closest work | I heard you did the category launch for Wiz around their CNAPP positioning. Can you show me that work and what pipeline lift they saw after the launch? | 5/4 5/4 5/5 5/5 5/4 | Google Workspace, CrowdStrike; 3 distinct sets (the count and second teaser varied) | none | Same pattern as p3-q09 on security. "We can't point to a Wiz engagement... so we won't confirm either." Less stable than p3-q09. 19.4 s. |
| p5-q06 | vague | pricing / timeline + Strategy Lead | how much do u charge | 5/4 across all five runs | none (0 teasers every run); 1 distinct set | none | Cost depends on scope, no invented figure, routes to the Strategy Lead. Hero plus strategy card only, so it is a weak visual but the cleanest honesty demo. Fastest: 10.5 s. |
| p1-q06 | vague | strong direct match + video | messaging house + marketecture? | 5/4 5/5 5/5 5/4 5/5 | CrowdStrike, Omnicell, Meta; 1 distinct set | Meta explainer video | Richest layout (hero, video, strategy card, three teasers) from a five-word query, stable every run. Narrative splits the question into "product-structure half" and "messaging-hierarchy half". No Strategy Lead. 19.6 s. |
| p3-q05 | well_formed | strong direct match (largest layout) | Biggest gap for us is getting sales and partners to actually use what marketing makes. Any examples where you aligned marketing and sales assets so reps used them in deals? | 5/4 5/4 5/4 5/5 5/5 | Omnicell, Salesforce/Slack, Salt, Salesforce PMC; 2 distinct sets (4 teasers latest, 3 in earlier runs) | none | Four teasers. Says "We haven't published results on rep adoption", so no invented outcome. No Strategy Lead. Most variable layout of the ten. 21.9 s. |

D-611 coverage: strong direct match (p2-q04, p1-q03, p2-q06, p1-q06, p3-q05), video (p1-q03, p3-q02, p3-q10, p1-q06), multi-part (p3-q10), honest no-match with closest work (p3-q09, p1-q09), pricing or timeline with the Strategy Lead offer (p5-q06, p3-q10).

Caveats found while reading the latest run:
- p1-q09 is the least stable of the bait queries (3 teaser sets in 5 runs).
- p3-q10 varied once in its teaser set; the latest two runs match.
- Voice 4 (not 5) is the usual score for most rows; the grader's note is typically a mild restatement between narrative and strategy card.
- Latencies are from Douala to production-like code in the eval run, not US vantage.

## Recommended five

| order | id | category | reason |
|-------|----|----------|--------|
| 1 | p2-q04 | strong direct match | Single, identical study every run; candid "closest parallel" line. |
| 2 | p1-q03 | video | A video the owner can play, on a different study from the Ceiba video; Chorus always shown. |
| 3 | p3-q10 | multi-part + timeline | The only true multi-part query; defers the timeline to the Strategy Lead without a figure. |
| 4 | p3-q09 | honest no-match | Most stable bait query; declines the claim, shows real adjacent work. |
| 5 | p5-q06 | pricing + Strategy Lead | Cleanest "no invented numbers" demo; fast. |

Reserves, in order: p1-q06, p3-q02, p2-q06.

Budget: 5 queries x 3 rounds x ~$0.045 = ~$0.68, plus one warm-up (~$0.05). Rounds must be at least 65 minutes apart, so verification takes about 2.5 hours of wall clock.

picked: p2-q04, p1-q03, p3-q10, p3-q09, p5-q06; reserves: p1-q06, p3-q02, p2-q06

demo_rule: claims (user, 2026-11-25). A query passes when every claim is supported in all 3 rounds, there is no meta or retrieval-language leak, videos are the study's own and return HEAD 200, and links work. The set of teaser cards may vary between rounds. The earlier strict rule (identical teaser set in all rounds) verdicts are kept in each CHECK.md and 06-DEMO/README.md. Disclosure for the 06-12 page: the stability rule was relaxed after seeing results, by user decision.
