---
phase: 03-retrieval
plan: 06
subsystem: prompt-and-rubric
tags: [teaser-policy, anti-padding, rank-labels, grader-catalogue, harness-v3]
requires:
  - phase: 03-retrieval
    provides: teaserPromptRule/teaserRubricText (03-02), RunRecord.catalogue (03-03), getCatalogue (03-05)
provides:
  - noDirectMatchPrompt(policy) and fallbackRubricText(policy) in concierge-config
  - SYSTEM_PROMPT teaser/video/no-match rules driven by config (no "include every case study")
  - formatContext (exported) with rank/signal labels via rankSignals
  - catalogueSection(record), HARNESS_VERSION 3, grader and second grader receive the catalogue
affects: [03-09 phase-end eval, Phase 4 GEN-01]
key-files:
  modified: [src/lib/concierge-config.ts, src/lib/orchestrator.ts, eval/rubric.ts, eval/lib.ts, eval/grade.ts, eval/grade-second.ts, eval/concierge-config.test.ts, eval/rubric.test.ts]
key-decisions:
  - "Prompt, rubric and automated video check all derive from CONCIERGE_CONFIG.teasers.policy"
  - "relevant_only bakes in the assumed-YES 'admit no matching work' behaviour; Phase 4 GEN-01 owns the flag"
requirements-completed: [RETR-04]
duration: ~25min
completed: 2026-11-22
---

# Phase 3 Plan 06: Anti-padding prompt and rubric, grader catalogue Summary

**Teaser, no-match and video rules now come from one config setting in the prompt, the rubric and the automated check; context labels use retrieval rank instead of RRF-meaningless score bands; the grader sees the same catalogue the app saw (harness v3).**

RETR-05 stays pending until the 03-09 phase-end eval shows no padding. RETR-04 was already complete.

## Verification
- `npm run eval:test`: 74 tests, 74 pass, 0 fail
- `npx tsc --noEmit -p .`: clean
- No paid calls, no DB changes, nothing pushed.

## Commits
- 8d87e07 feat(03-06): config-driven teaser, no-match and video rules in prompt; rank labels (concierge-config, its test, orchestrator, eval/lib.ts)
- 409b74f feat(03-06): rubric teaser/fallback text from config; grader sees catalogue; harness v3 (rubric, rubric tests, grade, grade-second)

Note: rubric.ts and rubric.test.ts carry both tasks' edits, so the Task 1 rubric changes landed in the second commit rather than being split with `git add -p`.

## Before / after: SYSTEM_PROMPT lines
| Line | Before | After |
|---|---|---|
| VideoPlayer registry | MANDATORY when vimeo_url is present in context for a relevant case study. | MANDATORY when a case study you present has a vimeo_url in context. |
| No-match intro | Instead of saying "We don't have TikTok-specific case studies", reframe positively: | `${noDirectMatchPrompt().intro}` = "If no retrieved case study directly matches, be honest about it, then reframe positively:" |
| Adjacent bullet | - Connect to adjacent work: "Our experience... | - Connect to adjacent work where it genuinely transfers, and label it as adjacent: "Our experience... |
| NEVER/INSTEAD pair | NEVER say: "We don't currently have X case studies" / INSTEAD say: ... | `${noDirectMatchPrompt().rule}` (say so plainly in one short sentence, then reframe; adjacent work allowed not required; never presented as a direct match) |
| CRITICAL case-study line | **CRITICAL: If ANY case studies appear in the context, you MUST include them as CaseStudyTeaser components, even if their relevance scores are lower.** ... | **Case studies first:** ... lead with case studies. `${teaserPromptRule()}` |
| Video usage | If a case study in context has a vimeo_url, you MUST include a VideoPlayer | If a case study you present has a vimeo_url, you MUST include a VideoPlayer |
| MANDATORY teaser line | **MANDATORY: If case studies are in context, include CaseStudyTeaser for each one** - even if articles are more relevant... | `- ${teaserPromptRule()}` |
| Case Study Inclusion Rule block | 8-line block forcing teasers "even if not perfect matches" | deleted |

## Before / after: rubric
- components: "VideoPlayer when a retrieved case study has a Vimeo URL, a CaseStudyTeaser for retrieved case studies" becomes "VideoPlayer when a case study the response presents has a Vimeo URL, ${teaserRubricText()}".
- fallback: "the prompt tells the concierge to reframe positively and still show case studies, so showing adjacent work is allowed." becomes `${fallbackRubricText()}` ("...say plainly that AG has no directly matching work and then reframe positively; showing adjacent work (labelled as adjacent) is allowed, not required, and an honest note with no case studies is acceptable.").
- grounded: added the PORTFOLIO CATALOGUE paragraph (catalogue lines support existence, client, tags, video flag, listed deliverables; never outcomes or metrics).
- grader context header: `rank N, semantic #S, keyword #K` for v2 chunks, `score x.xxx` for legacy ones.

## Deviations from Plan
**1. [Rule 2 - Core value / padding guard] formatContext case-study section header**
- The header read "(AG's Actual Client Work - Present these prominently)", which pushes the model to show every study and would undercut the relevant_only rule (03-04 always returns 6 studies).
- Changed to "present only those that fit the request". No other text changed beyond the planned formatContext edits.
- Commit: 8d87e07

**2. rankSignals duplicated header string** - the plan's header format is inlined in both branches (calling `rankSignals(chunk)` in each) to meet the `>= 2` call-site criterion; no separate header helper.

## Notes
- Harness v2 grades are not reused by grade.ts (it filters on harness_version); frozen/re-graded baselines are left as they are (no re-grade, budget).
- The byte-identical SYSTEM_PROMPT hash test was deleted as the plan directed; the prompt/rubric/config consistency tests replace it.
- grade-second.ts adds the catalogue as a second system message so both graders see the same input.

## Known Stubs
None.

## Self-Check: PASSED
