# Phase 2: Content and data - Context

**Gathered:** 2026-11-21
**Status:** Ready for planning

<domain>
## Phase Boundary

The index contains all of AG's work with accurate tags and correct videos (DATA-01..05):
- All 50 articles are chunked and embedded (additive only).
- Site work missing from the index is diffed against articlegroup.com/work and ingested after user approval. This includes the Simons Foundation education division and the Salesforce partner-ecosystem work.
- The capability/industry taxonomy is made accurate (no longer 39/43 "technology"), and the `detectQueryIntent` slug maps reference only slugs that exist in the DB.
- Every case-study video is audited, and mismatches are fixed or unlinked.
- The eval is rerun and the deltas are reported.

Not in this phase: `hybrid_search_v2`, whole-word intent matching (RETR-02), removing the cutoff, the catalogue prefix (all Phase 3), and server-side teaser tags (GEN-03, Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Missing site work (DATA-02)
- **D-01:** The live site is the source of truth. Scrape articlegroup.com/work for the list of work and for each item's page text. Use `AG Website RAG case studies.pdf` (43 pp., Challenge/Journey format) only where it covers the same study in more detail. It covers Salesforce on pp. 27–29. No local PDF mentions Simons Foundation, so Simons must come from the site.
- **D-02:** The diff matches site items to indexed case studies by fuzzy client + title. Near-matches (e.g. renamed studies) are shown for the user to decide, so no duplicates get created.
- **D-03:** Approval happens in one pass. Show a single table with these columns: title, client, source URL/page, proposed tags, extracted text preview, and match status. The user approves, rejects or edits rows. Nothing is ingested before approval.
- **D-04:** New work is ingested with its full page text in several chunks. The existing 43 single-chunk case studies stay untouched in this phase. Re-chunking them is a Phase 3 option, only if recall needs it.

### Taxonomy (DATA-03, DATA-04)
- **D-05:** Keep all existing capability and industry slugs, so production doesn't break. Add slugs for AG's real service lines, taken from the site's services list: e.g. messaging/positioning, GTM, events/keynotes, executive storytelling, plus video and content strategy if they aren't already covered. Then relink. Don't delete or rename existing slugs.
- **D-06:** Split "technology" into sub-sectors, e.g. cloud/infrastructure, cybersecurity, AI, consumer tech, enterprise software. Clients outside tech get their real industry (e.g. ADP → HR/b2b services, AIG → insurance/finance).
- **D-07:** Strict tagging. A capability is tagged only if the indexed text shows AG doing it, and each link has a quote as evidence. Studies may end up with only 1–2 tags. (Phase 4 shows these tags to prospects.)
- **D-08:** Articles get no capability/industry tags. They keep their topic links only, so they can't look like client work.
- **D-09:** Approval happens in one pass. Show a full table: every case study with its current tags, proposed tags, and a one-line reason quoted from its content. Apply only after approval.
- **D-10:** Update the `detectQueryIntent` keyword maps (`src/lib/supabase.ts` ~L311–341) so they reference only slugs that exist in the DB after the taxonomy change. Whole-word matching is RETR-02 (Phase 3), not this phase.

### Video audit (DATA-05)
- **D-11:** For each video, extract a few keyframes and an audio transcript and compare them to the case study. Produce a verdict table (match / mismatch / unsure) with the evidence. The user confirms, especially the "unsure" rows. Record the result as an audit file in the phase directory.
- **D-12:** On a mismatch, relink to the correct video if one clearly exists on disk or in storage, after approval. Otherwise unlink it (set the URL to null), so the study shows no video rather than the wrong one. Never delete video files from storage. Known case: Google "Crafting a Cross-Product Narrative" → `Google_Recruiting_-_Technical_Judgment.mp4`.
- **D-13:** Also audit the unlinked videos in `content/videos/` (16 files, 12 linked; e.g. Amazon Nova ×3, Android Theft Detection). If one clearly belongs to an indexed or newly ingested study, propose the link in the same approval table.

### Article handling (DATA-01)
- **D-14:** Embed all 50 articles (carried forward). The earlier ingest created document rows but zero chunks, so the new run must be idempotent with existing `documents` rows and must not create duplicates.
- **D-15:** Careers, jobs, benefits, contact and "How we work" PDFs are marked as **company info**, as a flag or a topic (the planner decides how). Company info should be retrieved only for questions about AG itself, never presented as thought leadership.
- **D-16:** The LinkedIn posts collection is **excluded from search**: it is embedded, but retrieval must not return it. Short client mentions could otherwise be quoted as client claims.
- **D-17:** All newsletters, including off-topic issues, are normal articles. Relevance ranking decides when they appear.
- **D-18:** Production impact: the live `hybrid_search` can't apply D-15/D-16. Insert chunks now only for thought-leadership articles and newsletters. **Hold** chunks for the company-info and LinkedIn docs until Phase 3's `hybrid_search_v2` can filter them. The held text and embeddings can be prepared but not inserted into `content_chunks`. Success criterion 1 ("all 50 articles have chunks") is then met for the non-held set now and for the held set in Phase 3. Record this in VERIFICATION.

### Phase-end eval
- **D-19:** One eval run, no second grader (~$3.50). Report the deltas against both the frozen baseline `2026-11-20T15-12-31` and the re-graded baseline `2026-11-21T07-32-49-regrade`. Restore Supabase and run preflight first.

### Claude's Discretion
- The chunk size and overlap for articles and new work (the existing `chunkContent` uses 1500 chars).
- How the company-info and excluded markers are stored (column, topic, or metadata), as long as nothing in production breaks.
- The tooling for frame and transcript extraction (ffmpeg plus a local or low-cost transcription). Keep the spend small against the budget.
- Exact names for the new slugs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Findings and agreements
- `eval/PLAN.md` — "Verified findings" (Index shape, Data) and "Agreed adjustments" (Phase 2 bullets)
- `.planning/PROJECT.md` — core value, constraints (DB safety, budget, shared Supabase)
- `.planning/REQUIREMENTS.md` — DATA-01..05
- `.planning/ROADMAP.md` — Phase 2 success criteria and gates
- `.planning/STATE.md` — re-graded baseline numbers and noise levels
- `.planning/phases/01-eval-improvements/01-EVAL-DELTA.md` — delta report format to follow

### Schema and retrieval
- `supabase/migrations/003_pdf_first_ui_restructure.sql` — the live `hybrid_search`, `get_related_articles*`, and the `document_type` enum
- `src/lib/supabase.ts` — `detectQueryIntent` and the keyword maps (~L311–370), article/case-study selection (~L505–560)
- `src/lib/orchestrator.ts` ~L245–300 — how articles and case studies are presented to the model

### Source content
- `AG Website RAG case studies.pdf` (repo root; identical copy in `content/case-studies/New case studies/`) — 43 studies, Salesforce pp. 27–29
- `content/case-studies/AG single page case studies 2025.pdf` — 54-page deck, Sept 2025
- `content/Articles/` — the 50 article PDFs
- `content/videos/` — 16 video files

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/ingest-articles.ts`: PyMuPDF extraction, `chunkContent`, embeddings via `embeddingConfig()` (OpenRouter), topic linking. Reuse it, but make it idempotent (rows exist, chunks don't).
- `scripts/relink-videos.ts`: repoints `hero_video_url` at storage paths without re-uploading. Reuse it for relinks and unlinks.
- `scripts/upload-videos.ts`: uploads video files to storage if an unlinked file needs to be uploaded.
- `scripts/populate-case-studies.ts`, `scripts/ingest-clean.ts`: the existing case-study ingest path. Follow its document/chunk shape for new work.
- `eval/preflight.ts`, `eval/batch.ts`, `eval/report.ts`: the phase-end eval and the delta report.

### Established Patterns
- Articles are already labelled in the prompt as "AG's perspective, not client work", with at most 2 per response.
- Embeddings: text-embedding-3-small via OpenRouter, 1536 dims.
- DB changes are additive. New functions and columns go alongside the old ones, never replacing them in place.

### Integration Points
- `documents`, `content_chunks`, `document_capabilities`, `document_industries`, `capabilities`, `industries`, `topics`, `document_topics`
- The live site reads the same tables, so every inserted chunk is immediately live (hence D-18).

</code_context>

<specifics>
## Specific Ideas

- The site's contact page lists the service lines: Messaging, GTM, Content Strategy, Video, Events. Use these as a starting point for the new capability slugs.
- Known data issues to resolve explicitly: the Google cross-product video; the Simons Foundation education division (site only); the Salesforce partner ecosystem (PDF pp. 27–29 plus the site); "A world of perspectives on the future of learning", which may be an article.

</specifics>

<deferred>
## Deferred Ideas

- Re-chunking the 43 existing case studies with fuller text: Phase 3, only if recall is still below 90%.
- Filtering company-info and LinkedIn docs in retrieval, and inserting their held chunks: Phase 3 (`hybrid_search_v2`).
- Populating `document_metrics` / `visual_assets`: v2 (V2-02).

</deferred>

---

*Phase: 02-content-and-data*
*Context gathered: 2026-11-21*
