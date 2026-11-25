# Owner demo queries (PROOF-03): final set

PROOF-03 is **met under demo_rule: claims** (user, 2026-11-25): five queries pass. Under the earlier strict rule, four of the five pass (p3-q09 differs).

Production: https://article-group-concierge.vercel.app at b50bb0c. Each query was run in 3 rounds at least 65 minutes apart on 2026-11-25 (picked five: 15:07, 16:14, 17:20 UTC; reserves: 17:26, 18:35, 19:41 UTC), 24 independent generations in all. Perf flags were present in every request: rag_cache_hit 0, orch_cached false. A DNS failure at the first scheduled reserve round 2 (no request sent, nothing billed) was re-run after the spacing had already been exceeded.

## Rules

- **demo_rule: claims** (user, 2026-11-25): pass when every claim is supported in all 3 rounds, there is no meta or retrieval-language leak, videos are the study's own and return HEAD 200, and links work. The teaser card set may vary between rounds.
- **Strict rule** (original plan): additionally, teaser slugs and videos identical in all 3 rounds.
- The relaxation was decided after seeing results, by the user. It is a disclosure for the 06-12 page.

## Demo order (final set)

| order | id | query | what it shows | strict | claims |
|-------|----|-------|---------------|--------|--------|
| 1 | p2-q06 | insurance experience? | a two-word query answered with AIG as most direct and Android Enterprise as adjacent | VERIFIED | VERIFIED |
| 2 | p1-q06 | messaging house + marketecture? | richest layout: Meta video, CrowdStrike, Omnicell, Meta teasers; admits no study uses "messaging house" | VERIFIED | VERIFIED |
| 3 | p3-q02 | What does your co-branded video work look like? ... | Project Ceiba video and 8M+ views; "our one published co-branded video" | VERIFIED | VERIFIED |
| 4 | p2-q04 | naming work for major financial institutions ... rename part of our business | J.P. Morgan as the closest parallel, not a business-unit rename; Strategy Lead offered | VERIFIED | VERIFIED |
| 5 | p3-q09 | I heard you ran the Microsoft Azure Marketplace partner program refresh. What pipeline lift ...? | declines the false claim, no figure, Salesforce partner work as adjacent; Strategy Lead offered | REPLACE (teaser set varies) | VERIFIED |

## Failed

| id | strict | claims | reason |
|----|--------|--------|--------|
| p3-q10 | REPLACE | REPLACE | round 3 narrative says "in what we pulled up" (retrieval language leaking); all claims otherwise supported. The plan's expected pass did not hold. |
| p1-q03 | REPLACE | REPLACE | round 1 says Chorus was a "standalone startup"; the source says "within Alphabet's X". Round 3 also adds a Salt teaser. |
| p5-q06 | REPLACE | REPLACE | round 1 "so you're only paying for what moves you forward" implies a pricing commitment; round 3 "Nothing we retrieved speaks to pricing" leaks retrieval language. |

## Caveats

- D-611 range: the final set has no multi-part query (p3-q10 failed) and no pricing/timeline answer (p5-q06 failed). It does have direct matches, two videos (Meta, Ceiba), two honest "haven't published that" answers (p3-q09, p2-q04), and the Strategy Lead offer in two. The 06-12 page should say this.
- Four of five carry no Strategy Lead offer or only one; the two that do are p2-q04 and p3-q09.
- Warm the app first (D-606): one request ("What kind of work does Article Group do?") before the demo. A cold answer took about 17 s.
- Videos checked: Chorus, Ceiba and Meta Business Messenger explainer each equal the study's own hero_video_url and return HEAD 200 video/mp4.
- Demo verification spend $1.55 against the $1.50 stop line (see 06-SPEND.md).
