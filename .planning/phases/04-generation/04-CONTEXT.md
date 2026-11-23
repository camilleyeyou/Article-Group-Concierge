# Phase 4: Generation - Context

**Gathered:** 2026-11-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every concierge answer honest, in AG's "we" voice, and supported by indexed content (GEN-01..GEN-07): honesty rules in the prompt, invention-bait handling, teaser tags filled server-side from DB links, a 2-4 sentence narrative that adds something, video components when relevant, a Strategy Lead offer per the shared config, and a verifier pass only if unsupported claims stay at >= 5/50 after the prompt fixes. No retrieval changes (Phase 3 is closed), no streaming/latency work (Phase 5), no new UI features.

**Starting point (gap run `eval/results/2026-11-22T13-42-12`, commit 2faba11 in prod):** unsupported claims in 14/50 responses (15 claims: goal_as_result 7, capability_not_shown 2, generated_tags 0, other 6), voice 4.18 (41x score 4, 9x score 5; 39 of the 41 voice-4 reasons cite a narrative longer than 2-4 sentences, 28 cite repetition), hallucinations 0, recall 47/52 frozen, strategy_lead_offered_when_expected 0.
**Targets:** goals as results 0, invention-bait presupposed 0, capabilities claimed but not shown 0, responses with any unsupported claim < 5/50, voice >= 4.5.

</domain>

<decisions>
## Implementation Decisions

### Outcome wording and honesty (GEN-01, GEN-02)
- **D-401:** Deliverables only. When a case study states only the client's aim ("Salt wanted to be less technical and more memorable"), describe what AG made ("We rebuilt Salt's brand and messaging to make API security less technical"). An aim may be stated as an aim, never as an achieved effect. Results are stated only when the indexed text states them as results (e.g. "8M+ views").
- **D-402:** Events and launches are said to have happened only if the text says so. "Built for the Fal.con unveiling", not "unveiled at Fal.con", unless the context states the unveiling.
- **D-403:** The honesty rules apply everywhere the model writes text: HeroBlock, StrategyCard, CaseStudyTeaser `summary`, and the narrative. Three of the seven current goal_as_result claims sit in teaser summaries. The model keeps writing teaser summaries (no server-side summaries).
- **D-404:** No inferred facts. Advice and opinion are fine ("our approach would be..."), but nothing that reads as a fact about a past engagement unless the text states it: no inferred reach ("8M views suggest it travelled beyond..."), no invented order of work, no carrying one study's details to another. Each study's details stay attached to that study.
- **D-405:** For "can you do X?" with no study showing X: say plainly that we haven't published work on X, show the closest real work and label it as adjacent, and never give a flat "Yes, we can build this". The Strategy Lead offer follows (D-412). This is the GEN-01 capability rule, and it is consistent with the existing `noDirectMatchPrompt()` (relevant_only) behaviour, which stays.
- **D-406:** Invention bait (GEN-02): don't confirm or describe the asserted engagement or result. Say we can't point to that work, then redirect to real related work and offer the Strategy Lead (D-411 adds invention_bait as a trigger).

### Narrative and voice (GEN-04)
- **D-407:** The narrative is 2-4 sentences, enforced by a hard prompt rule, with the numbers in `src/lib/concierge-config.ts` (like the component-count rule) so the prompt and the rubric share them. Add a deterministic sentence-count check to the eval automated checks and report it. No server-side trimming.
- **D-408:** The narrative's job is the "why it fits" link: connect the prospect's situation to the shown work and to what we'd do first. It must not restate teaser summaries or deliverables already shown in StrategyCards or teasers.
- **D-409:** Always "we"/"our" in the narrative, StrategyCards and teaser summaries ("We built...", "Our work with..."), never "Article Group did" or "the agency". Articles stay "our thinking", never "we did".
- **D-410:** StrategyCards describe AG's approach only (method or principle), with no client results or deliverables; those belong in teasers. Keep the current limit of 1-2 cards.
- **D-421:** Replace the fictional NeoBank example (it models "+340% brand awareness" as an outcome) with a new fictional example that demonstrates the new rules: deliverables rather than outcomes, a 3-sentence narrative, "we" voice, and an honest gap line. It stays fictional, so the rubric's "fictional example = invention marker" note must be updated to the new example's names.
- **D-422:** Register: plain but premium. Casual queries get short sentences and no jargon (no "marketecture" unprompted), still in a confident AG voice. This matches what the rubric already rewards.

### Strategy Lead offer (GEN-06)
- **D-411:** `CONCIERGE_CONFIG.strategyLead.offerOn` becomes `['no_context', 'fallback', 'pricing', 'timeline', 'invention_bait']`. `invention_bait` is a new `StrategyLeadTrigger` that needs a description in `STRATEGY_LEAD_TRIGGER_DESCRIPTIONS`. Prompt and rubric text derive from the config, as today.
- **D-412:** Form: one closing sentence of the narrative that names the Strategy Lead by the config name (e.g. "Our Strategy Lead can scope this with you."). No new UI or component. (`contactCTA` isn't rendered anywhere in the UI today; leave it as is.)
- **D-413:** Pricing and timeline answers never give figures (fees, weeks, months). Say it depends on scope, name what drives it if the content supports that, and offer the Strategy Lead.
- **D-414:** Triggers only. On a good direct match, the Strategy Lead is not mentioned; the follow-up questions act as the CTA. The rubric should treat an unprompted offer on a direct match as a minor voice/CTA issue, not a pass requirement.
- **D-415:** The eval decides "expected" deterministically: the query `type === 'invention_bait'`, `expected.fallback_expected`, the existing no_context check, and pricing/timeline keyword detection on the query text (word lists in config or eval, whole-word). Report offered/expected for each trigger. The grader judges only the soft "retrieved work not directly relevant" cases that the labels don't cover.

### Verifier (GEN-07) and eval budget
- **D-416:** Budget: the user will top up OpenRouter credit (about $16 left now; Phases 4-6 need about $22 at planned run counts). Phase 4 runs cheap subset smoke runs while iterating (e.g. the ~15 queries that currently have claims, plus invention-bait, pricing, timeline and video queries) and one full eval at the end. Run preflight and confirm credit before each paid run; restore Supabase if it has paused.
- **D-417:** If unsupported claims are still >= 5/50 after the GEN-01..06 prompt fixes, evaluate a **Haiku 5.5 claim-check** (OpenRouter `anthropic/claude-haiku-5.5`, same provider as now, so no new data processor). It checks teaser summaries, StrategyCards and the narrative against the retrieved text. Thinking must be disabled (the Phase 3 finding: Haiku's thinking used up max_tokens; see `src/lib/rerank.ts`). Timeout and fallback: on failure keep the unverified response and flag it in logs/debug.
- **D-418:** On a hit, the verifier **rewrites** the sentence or summary into a supported version using only facts from the retrieved text. It doesn't delete it, so the deck stays intact.
- **D-419:** Latency budget: <= 2 s extra, and only on parts off the first-content path (teasers and narrative can be verified while the hero streams in Phase 5). Phase 5 designs around this.
- **D-420:** Evaluate the verifier on **saved responses**: run Haiku over the 50 responses from the Phase 4 prompt-fix full eval, then re-grade only those with Opus (~$3). Measure claims removed and latency added, without regenerating. The user approves before the verifier ships (ROADMAP gate). It ships behind a config flag, default off until approved.

### Claude's Discretion
- **GEN-03 server-side teaser tags:** after parsing the layout, overwrite each CaseStudyTeaser's `capabilities`/`industries` with the DB link names for that slug (the catalogue data in `src/lib/catalogue.ts` already loads `document_capabilities` / `document_industries`). If a study has no links, omit the props. If the slug is unknown, drop the model's tags. The model can stop emitting tags, or they are simply ignored.
- **GEN-05 video rule:** use a VideoPlayer when the query is about video or a presented study has a verified `vimeo_url` (the existing rule stays). Tighten the wording so video queries prefer studies with a verified video when they genuinely match. The `videos_available_not_used` check already exists.
- Exact prompt wording and structure, sentence-splitting rules for the count check, the pricing/timeline keyword lists, and the composition of the subset used for smoke runs.
- Whether goal/aim detection also gets a cheap deterministic eval check (e.g. aim verbs like "wanted to" or "aimed to" in the source next to past-tense result phrasing in the response) as an extra diagnostic.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and roadmap
- `.planning/ROADMAP.md` (Phase 4 section): goal, success criteria, and the verifier gate (needs user approval and a latency evaluation)
- `.planning/REQUIREMENTS.md`: GEN-01..GEN-07, the out-of-scope table (no verifier by default, no model changes)
- `.planning/PROJECT.md`: core value (never misrepresent AG's work), ready bar, constraints (budget, models, EVAL_DEBUG)
- `eval/PLAN.md`: "Verified findings" (Generation section) and "Agreed adjustments" (Phase 4 bullet list)

### Latest measurements
- `.planning/phases/03-retrieval/03-GAP-EVAL-DELTA.md`: current metrics and the run ids to compare against
- `eval/results/2026-11-22T13-42-12/grades.json`: the 15 remaining unsupported claims with kinds, and the voice reasons (the evidence for D-401..D-410)
- Frozen baseline `eval/results/2026-11-20T15-12-31` and re-graded baseline `eval/results/2026-11-21T07-32-49-regrade`: the deltas must be reported against both

### Prior phase decisions
- `.planning/phases/03-retrieval/03-CONTEXT.md`: D-302 relevant_only teasers, D-304 the grader sees the catalogue, D-307 the teaser padding guard
- `.planning/phases/02-content-and-data/02-CONTEXT.md`: D-07 strict tagging (tags shown to prospects in Phase 4 come from these DB links), D-15/D-16 article classes
- `.planning/phases/03-retrieval/03-BAKEOFF.md`: Haiku 5.5 via OpenRouter, thinking must be disabled

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/concierge-config.ts`: the single source for prompt and rubric rules. Extend it with the narrative sentence limits, the `invention_bait` trigger, the pricing/timeline keywords and a verifier flag. `teaserPromptRule()`, `noDirectMatchPrompt()` and `STRATEGY_LEAD_TRIGGER_DESCRIPTIONS` are already config-driven.
- `src/lib/catalogue.ts`: loads per-study capability and industry names, the video flag and deliverables. Reuse it for GEN-03 server-side tags (it is cached, so no extra DB call).
- `src/lib/rerank.ts`: the existing Haiku-via-OpenRouter call pattern, with the thinking-disabled cast, timeout and fallback. This is the template for the D-417 verifier.
- `eval/lib.ts` automated checks (~L360-400): add the sentence count, the per-trigger Strategy Lead expected/offered, and the teaser-tag source check. `videos_available_not_used` already exists.
- `eval/regrade.ts`: the re-grading command, the basis for D-420 (verify saved responses, then re-grade).
- `eval/rubric.ts`: derives its rules from the config. Update the fictional-example note (L35) and the Strategy Lead text (L27-28).

### Established Patterns
- Prompt text is built from config helpers so prompt and rubric can't drift (Phase 1 rule). Every new rule should follow this.
- The catalogue is a cached system block (`buildSystemBlocks`, ttl 1h). Changing `SYSTEM_PROMPT` invalidates the cache once, which is fine.
- `parseOrchestratorResponse` splits the narrative at "**Want to explore**". The sentence-count check should measure the explanation before the follow-ups.
- Each eval run is ~$4.30; preflight checks credit and Supabase.

### Integration Points
- `src/lib/orchestrator.ts`: `SYSTEM_PROMPT` (L50-223) rewrite, `formatContext` (L244) labels, and the place to post-process the layout (server-side tags, the verifier hook) after `parseOrchestratorResponse` in `orchestrate()`. The unused `orchestrateStream` must get the same post-processing in Phase 5.
- `src/app/api/chat/route.ts`: the response path. Alternatively, apply the tag overwrite here once the layout is returned.

</code_context>

<specifics>
## Specific Ideas

- Real failure examples to design against (from the gap run): Salt "made the brand less technical and more memorable" (aim stated as a result, in 3 responses); CrowdStrike "unveiled at Fal.con"; AIG "built market confidence"; Coca-Cola x Spotify "8M views suggest it travelled beyond..."; Simons "research, then messaging, then design system..." (invented order); re:MARS "one-time event"; "Yes, we can build this" (localizable templates); "Yes, we plan launch events" (in-person parties).
- The owner is very detail-oriented: a weaker but true answer beats a stronger one with a stretch.

</specifics>

<deferred>
## Deferred Ideas

- Server-side teaser summaries from a fixed per-study summary (considered for D-403, not chosen; no summary source exists yet). Revisit only if teaser summaries keep producing claims after the verifier.
- Rendering `contactCTA` as a UI element: a new UI feature, out of scope for this milestone.
- Verifying inside the streaming path: Phase 5 (D-419 sets its latency budget).

</deferred>

---

*Phase: 04-generation*
*Context gathered: 2026-11-22*
