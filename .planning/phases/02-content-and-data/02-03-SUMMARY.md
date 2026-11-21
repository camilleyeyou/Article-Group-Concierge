---
phase: 02-content-and-data
plan: 03
subsystem: data
tags: [taxonomy, capabilities, industries, supabase]
requires: [02-02]
provides:
  - evidence-backed capability/industry links for all 50 case studies (each added link has a verbatim quote from indexed chunks)
  - 7 new capability slugs (messaging-positioning, content-strategy, events-keynotes, thought-leadership, naming, research-insights, go-to-market)
  - 8 new industry slugs (enterprise-software, consumer-tech, artificial-intelligence, cloud-infrastructure, cybersecurity, energy, education, real-estate)
  - scripts/taxonomy.ts (--check, --check --against-db, --apply --yes with backup first, --restore)
affects: [02-04 intent keyword map must target the new slugs, 02-06 eval]
tech-stack:
  added: []
  patterns: [backup before write + restore command; link-row diffs only, never update/delete taxonomy rows]
key-files:
  created:
    - scripts/taxonomy.ts
    - data/taxonomy-proposal.json
    - data/taxonomy-backup.json
    - data/taxonomy-backup.pre-change.json
    - .planning/phases/02-content-and-data/02-TAXONOMY-PROPOSAL.md
  modified: []
key-decisions:
  - "User approved all 50 rows as proposed"
  - "Strict evidence rule kept: CrowdStrike marketecture, AWS keynotes, Task Mate long-form have no industry (user declined user_asserted tags)"
  - "02-04 runs before 02-05 to shorten the window where the live 'technology' filter matches only 5 docs"
requirements-completed: [DATA-03]
duration: ~25 min
completed: 2026-11-21
---

# Phase 2 Plan 03: Taxonomy Cleanup Summary

Every case study's capability and industry tags now describe it accurately, and every added link is backed by a verbatim quote from its indexed text. 103 links were added and 81 removed across 48 of 50 studies. A full pre-change backup and a one-command restore are in place.

## Tasks

| Task | Commit | Notes |
|------|--------|-------|
| 1 Tooling + proposal | ef6c9cc | 50 studies covered, CHECK OK, $0 spend |
| 2 User approval | this commit | Approve all; flagged 3 left without industry |
| 3 Apply + verify | this commit | Backup taken first, 103 inserted / 81 deleted, CHECK --against-db OK |

## Deviations

- The orchestrator ran the apply after the user's direct approval, not the subagent.
- A first attempt to fill the Decision column corrupted the markdown table in the working tree. It was restored from the committed version and redone. The DB was unaffected.

## Follow-ups

- The live intent filter for 'technology' matches only 5 docs until 02-04 maps keywords to the new slugs. 02-04 runs next.
- enterprise-software (15) and consumer-tech (7) are inferred from product names and are the softest tags. Spot-check them if eval grounding flags tags.
- The 3 studies with no industry won't match industry-filtered queries.

## Self-Check: PASSED
