# Phase 2 Plan 01: Simulated retrieval impact of article chunks

Generated 2026-11-21 by `npx tsx scripts/embed-articles.ts --prepare` and `--simulate`. Nothing has been inserted into the DB
(`content_chunks` still has 43 rows).

## Classes

| Class | Docs | Chunks | Inserted now | Held for Phase 3 |
|---|---|---|---|---|
| thought_leadership | 35 | 92 | yes (if approved) | no |
| newsletter | 9 | 41 | yes (if approved) | no |
| company_info | 5 | 5 | no | yes |
| excluded (LinkedIn collection) | 1 | 15 | no | yes |
| **Total** | 50 | 153 | 133 chunks / 44 docs | 20 chunks / 6 docs |

## Held docs (D-18)

Held until `hybrid_search_v2` can filter on `metadata.article_class`; the live `hybrid_search` cannot exclude them, so inserting
would expose them to production retrieval. Text is in `data/held-article-chunks.json` (no embeddings).

1. Article Group Careers Overview
2. Article Group Contact Page
3. Article Group Employee Rewards and Benefits
4. Article Group How We Work
5. Article Group Jobs Page
6. Article Group LinkedIn Posts Collection

## Method (approximate)

The simulation models only the unfiltered semantic path of the live pipeline: top 60 by cosine, x0.7, top 20, drop < 0.15,
best chunk per document, 4 case studies + 2 articles. It has no intent-filtered primary search and no 10% boost, sets the keyword
term to 0 on both sides, and excludes chunks added by Plan 02-02. Real impact is measured by the phase-end eval. (Its "before"
recall, 36/52, differs from the live eval's 39/52 for exactly these reasons; compare before to after, not to the eval.)

## Results

- recall before: 36/52 (69.2%)
- recall after: 36/52 (69.2%)
- Expected case studies displaced (selected before, not after): 0
- Mean case studies selected per query: 3.86 before, 3.64 after
- Queries with >= 1 article selected after: 49/50
- Queries with < 4 distinct case studies in the top 20 after: 9/50

## Spend

Embedding input 206,565 chars, about 51.6k tokens, about $0.001 at $0.02/1M tokens, plus 50 short query embeddings. Well under $0.05.

## Recommendation

`insert-all`: simulated recall after (36/52) equals recall before and no expected case study is displaced. Trade-off: the mean
number of case studies shown drops 3.86 to 3.64 because articles take some of the top-20 slots, and 9 queries end with fewer than
4 case studies in the window. Articles reach 49/50 queries, so DATA-01 is met for the non-held set.

Decision: insert-all (2026-11-21, user reply to the Task 3 checkpoint)

## Applied

- `npx tsx scripts/embed-articles.ts --insert --yes`: inserted **133 chunks across 44 docs** (35 thought_leadership, 9 newsletter). `content_chunks` went from 43 to 176 rows.
- `--verify`: VERIFY OK, exit 0. The 6 held docs have 0 chunks, the 43 summary chunks are unchanged, and there are no duplicates. Article probes hit:
  - "how to write a good creative brief" → creative-brief-best-practices-problem-framing-avoiding-assumptions (top 3)
  - "Barbie movie marketing" → article-group-newsletter-issue-3-barbie-movie-marketing-… (top 3)
  - "empathy map for understanding your audience" → empathy-map-audience-first-customer-profile-tool (top 1)
- Idempotent rerun of `--insert --yes`: 0 chunks across 0 docs, with every doc skipped as already chunked.
