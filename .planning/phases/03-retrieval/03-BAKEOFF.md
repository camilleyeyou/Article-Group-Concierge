# Phase 3 RETR-06 recall-lever bake-off (plan 03-11, D-305)

Date: 2026-11-22. OpenRouter credit: $21.02 before, $20.89 after (about $0.13 total, including two aborted/superseded runs; final run's reranker spend reported $0.0613: Cohere $0.0082, Haiku $0.0531). Script: `npm run eval:recall-bakeoff` (raw results in `data/.cache/recall-bakeoff-latest.json`, not committed).

Method: real `retrieveContext` over the 52 expected pairs (50 queries), `skipCache`, two passes per mode, eval recall rule (expected slug among returned case-study slugs plus article slugs). Caps 6/7/8 are scored from one run at cap 8 (selection is a slice of the same ordering). Frozen = 52 pairs, corrected = 49 (disputed labels removed). A candidate qualifies if both passes are >= 47/52 frozen. Latency is the added reranker call latency (ok calls only); "Added gen $/q" is the extra Sonnet 5.5 input cost of the 7th/8th case-study chunk.

| Candidate | Frozen p1 | Frozen p2 | Corrected p1 | Corrected p2 | Added latency p50 / max | Cost per query (rerank + added gen) | Fallbacks | Qualifies |
|---|---|---|---|---|---|---|---|---|
| cap6 (control) | 43/52 | 43/52 | 43/49 | 43/49 | 0 / 0 ms | $0 | 0 | no |
| cap7 | 45/52 | 45/52 | 45/49 | 45/49 | 0 / 0 ms | $0.000429 | 0 | no |
| cap8 | 47/52 | 47/52 | 47/49 | 47/49 | 0 / 0 ms | $0.000880 | 0 | yes |
| cohere-cap6 (control) | 44/52 | 44/52 | 44/49 | 44/49 | 863 / 2226 ms | $0.000082 | 0 | no |
| cohere-cap7 | 47/52 | 47/52 | 47/49 | 47/49 | 863 / 2226 ms | $0.000082 + $0.000428 | 0 | yes |
| cohere-cap8 | 48/52 | 48/52 | 48/49 | 48/49 | 863 / 2226 ms | $0.000082 + $0.000869 | 0 | yes |
| haiku-cap6 | 46/52 | 45/52 | 45/49 | 44/49 | 935 / 1793 ms | $0.000531 | 11 | no |
| haiku-cap7 | 46/52 | 46/52 | 45/49 | 45/49 | 935 / 1793 ms | $0.000531 + $0.000447 | 11 | no |
| haiku-cap8 | 47/52 | 47/52 | 46/49 | 46/49 | 935 / 1793 ms | $0.000531 + $0.000894 | 11 | yes |

CONTROLS: OK

Controls reproduce known numbers (cap6 = 43/52, cohere-cap6 = 44/52).

## Misses (pass 1, frozen)

- cap6: p1-q02 Renew Home (disputed); p1-q03 Google Workspace; p1-q05 Chorus (disputed); p1-q07 CrowdStrike + Chorus (disputed); p2-q03 AIG; p2-q05 J.P. Morgan + ADP; p3-q10 Android
- cap7: p1-q02 Renew Home; p1-q03 Google Workspace; p1-q05 Chorus; p1-q07 CrowdStrike + Chorus; p2-q03 AIG; p2-q05 J.P. Morgan
- cap8: p1-q02 Renew Home; p1-q05 Chorus; p1-q07 Chorus; p2-q03 AIG; p2-q05 J.P. Morgan
- cohere-cap6: p1-q02 Renew Home; p1-q05 Chorus; p1-q06 Salt Security; p1-q07 Chorus; p2-q03 AIG; p2-q05 ADP; p2-q10 ADP; p3-q10 Android
- cohere-cap7: p1-q02 Renew Home; p1-q05 Chorus; p1-q07 Chorus; p2-q03 AIG; p2-q10 ADP
- cohere-cap8: p1-q02 Renew Home; p1-q05 Chorus; p1-q07 Chorus; p2-q03 AIG
- haiku-cap6: p1-q03 Google Workspace; p1-q04 Salesforce/Slack; p1-q05 Chorus; p1-q07 Chorus; p3-q10 Android; p4-q01 Google Cloud
- haiku-cap7: same as haiku-cap6
- haiku-cap8: p1-q03 Google Workspace; p1-q04 Salesforce/Slack; p1-q05 Chorus; p1-q07 Chorus; p3-q10 Android

## Gains and losses vs cap6 (no rerank)

- cap7: +2 (ADP keynotes p2-q05, Android p3-q10); no losses.
- cap8: +4 (Google Workspace p1-q03, CrowdStrike p1-q07, ADP keynotes p2-q05, Android p3-q10); no losses.
- cohere-cap6: +1 net (gains Google Workspace, CrowdStrike, J.P. Morgan; loses Salt Security p1-q06 and ADP p2-q10, which no-rerank found).
- haiku-cap6: +3 net on pass 1 (gains Renew Home, CrowdStrike, AIG, J.P. Morgan, ADP; loses Salesforce/Slack p1-q04 and Google Cloud p4-q01); pass 2 is 45/52 (the reranker is nondeterministic and 11 of 104 calls fell back).

## Haiku reranker notes

- First attempt: 99/104 calls returned no text, because Haiku 5.5 thinks by default and the thinking tokens consumed `max_tokens: 200`. Fixed by passing `thinking: { type: 'disabled' }` (not in the installed SDK types, passed untyped). That run was discarded; the table above is the rerun.
- After the fix, 11/104 calls (about 11%) were still unparseable and fell back to the RRF order (cause not investigated; fix attempt budget used). Those fallbacks make the Haiku rows a slight underestimate of a perfectly behaving Haiku reranker.
- Haiku cost per call is about $0.0005 (about 6x Cohere); p50 935 ms, similar to Cohere.

## Selection per D-305

No-rerank candidates are preferred over any reranker (no new latency, no new data processor). Qualifying no-rerank candidates: cap8 only (47/52 on both passes, the frozen target exactly). Smaller k first: cap7 reaches 45/52, below the gate. Reranker candidates (cohere-cap7 47/52, cohere-cap8 48/52, haiku-cap8 47/52) also qualify but add 0.9 s p50 latency and a call per query, which the user already declined for +1 recall in 03-08. cap8 costs about $0.00088 per query of extra generation input and passes 8 case studies to the generator.

Caveats: cap8 sits exactly on the gate, with zero headroom; it does not fix Renew Home, Chorus, AIG, or J.P. Morgan keynotes (the 3 disputed + 2 remaining). Teaser padding (RETR-05) cannot be measured offline and is checked by the D-307 guard in the eval; cap 8 gives the generator 2 more case studies to pad teasers with.

BAKEOFF WINNER: cap8
