---
status: resolved
trigger: "perf-02-hero-speed: hero reaches the user 11-14 s after the query in production vs 3-4 s target (PERF-02)"
created: 2026-11-24
updated: 2026-11-24
---

## Current Focus

hypothesis: a second low-effort Sonnet 5.5 call that writes only the HeroBlock (aborted after hero_done) gives a hero at about 2 s after generation start, while the default-thinking call keeps writing everything else.
test: live timing (4+5+4 queries) and a targeted graded run of 6 queries that had hero-located claims earlier.
expecting: hero visible 3.5-4.8 s after the query (local), final layout quality unchanged apart from the hero.
next_action: read the graded batch, report to the orchestrator.

## Symptoms

expected: first hero text visible about 3-4 s after the query (PERF-02)
actual: production smoke 05-10: hero 13.9 / 12.5 / 11.1 s, complete 18-19 s
errors: none
reproduction: eval/stream-smoke.ts --query "<text>"; generation alone via eval/stream-timing.ts
started: never met

## Eliminated

- hypothesis: capped thinking budget / medium effort (direction 2)
  evidence: OpenRouter Sonnet 5 migration guide: adaptive-only thinking, thinking.budget_tokens unsupported, reasoning.max_tokens accepted but ignored; effort only maps to output_config.effort. 05-EVAL-DELTA: medium emitted no thinking (same as low), high thought and was as slow as default. No middle setting.
  timestamp: 2026-11-24
- hypothesis: between_tools keeps the quality gates (direction 1)
  evidence: 05-TIMING.md: between_tools emitted 0 thinking_delta events and 0 thinking tokens, output 1208 tokens, same as adaptive low. It is "no thinking" on a no-tool request, so the same loss of deliberation is expected; not tested because it is paid and unlikely to differ.
  timestamp: 2026-11-24
- hypothesis: start generation before retrieval finishes (direction 4)
  evidence: the thinking needs the retrieved context (it is in the user turn). The static system prefix is already a prompt-cache hit (cache_read 12,160 per call), so there is nothing left to pre-send.
  timestamp: 2026-11-24

## Evidence

- timestamp: 2026-11-24
  checked: where the 16 low-effort unsupported-claim responses (run 2026-11-23T19-00-37) sit
  found: about 4 of 16 are in the HeroBlock subtitle/title (p2-q05 "Fortune 100 experience", p4-q09 "mission-driven organizations", p3-q10 "Co-Branded", p1-q02); the rest are teaser summaries, StrategyCards and narrative ("began with", "we closed it", "designed and produced"). Default runs A/B: hero is implicated in 1-2 of 9 / 6.
  implication: the quality loss from low effort is mostly outside the hero. A fast hero plus a full-thinking body keeps default quality for everything but the hero, and the hero can be constrained by prompt.
- timestamp: 2026-11-24
  checked: hero pass v1 (instruction without examples) on p1-q01, p2-q05, p4-q09, p5-q07
  found: hero_done 2.1-2.3 s after generation start; but the fast hero repeated the user's words as claims about us ("Fortune 100 work in regulated industries", "Howard Hughes Medical Institute" as subtitle).
  implication: instruction must forbid claims about us in title/subtitle.
- timestamp: 2026-11-24
  checked: hero pass v2 (no claims about us, user's presuppositions only as "You're asking about...") on 4 queries
  found: leaks reduced; "senior-level partnership" and HHMI in the subtitle remained.
  implication: add a bad/good example and ban client names the user attributes to us in title/subtitle.
- timestamp: 2026-11-24
  checked: hero pass v3 (shipped) on p2-q05, p4-q09, p4-q10, p5-q06, p2-q01
  found: hero first text 1.4-2.0 s, hero_done 1.9-2.8 s after generation start; titles/subtitles free of claims about AG; local retrieval 2.2-4.0 s so user-visible hero 3.6-6.1 s locally (production retrieval about 1.8 s => about 3.3-4.6 s).
  implication: PERF-02 met in production if retrieval stays about 1.8 s.

## Resolution

root_cause: Sonnet 5.5 thinks adaptively before the first text token (about 1,760 thinking tokens, 8-16 s), and the hero is the first text of the same response. Any single-call setting that removes the thinking (low/medium effort, between_tools) also removes the deliberation that keeps the body honest (D-513 failed 4 gates). Capped budgets do not exist on Sonnet 5.
fix: hero pass in orchestrateStream (src/lib/orchestrator.ts): a parallel low-effort call writes only the HeroBlock (stream aborted at hero_done); the default-thinking call is unchanged. The fast hero is streamed and is also written into `final` (layout[0]), so there is no swap and no hero/body mismatch in what was graded. Falls back to the main call's hero if the hero pass fails. Config: CONCIERGE_CONFIG.heroPass, HERO_PASS_ENABLED env kill switch, heroPassInstruction().
verification: unit tests 230/230 (4 new in eval/hero-pass.test.ts), tsc clean. Live: hero first text 1.4-2.0 s and hero_done 1.9-2.8 s after generation start (13 queries, v1-v3). Graded 6-query subset (p1-q07, p2-q05, p3-q10, p4-q09, p4-q10, p5-q07; run 2026-11-24T10-06-42, credit $15.59 -> $14.78): 1/6 responses with unsupported claims (p4-q10 body, recurring), 0 hero-located; grounded 4.83, voice 4.50, bait 0, hallucinations 0. Not a full D-513 run. Status: awaiting orchestrator/user decision on a full eval.
files_changed:
  - src/lib/concierge-config.ts
  - src/lib/orchestrator.ts
  - eval/hero-pass.test.ts

## Verification (full eval, user-approved)

Run `2026-11-24T10-42-25` (batch-2026-11-24T10-42-24), 50/50 ok, hero pass on, Opus 5.5 judge, cost about $4.50 (credit $14.64 -> $10.14).
- PERF-02 median t_hero_first 3944 ms (gate 4000): PASS locally, including distance-inflated local retrieval. Production smoke still to run.
- D-513 all PASS: unsupported-claim responses 4 (<= 6; default runs were 6 and 9), goal_as_result 0, capability_not_shown 0, invention_bait_presupposed 0, recall hit 47, teasers_zero_expected_mean 1.40, grounded 4.82, voice 4.48, D-307 2.
- PERF-01 still FAIL locally (t_teasers 2414 ms); not in scope here.
- Note: video_queries_missing_video 1 (p4-q09, Google for Education Vimeo); main pass, not the hero.
