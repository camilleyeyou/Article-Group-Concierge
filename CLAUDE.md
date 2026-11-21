<!-- GSD:project-start source:PROJECT.md -->
## Project

**Article Group Concierge: owner-ready quality milestone**

The Article Group (AG) AI Concierge is a RAG chat app (Next.js on Vercel, Supabase pgvector,
Claude via OpenRouter) that answers prospective clients' questions about AG's work. It
retrieves AG case studies and returns a generated layout of components (hero, case-study
teasers, metrics, video, CTA). This milestone makes it ready to show AG's owner, who is
very detail-oriented.

**Core Value:** **Never misrepresent AG's work.** A wrong claim about a client engagement is worse than a
weak answer. Every claim about a client, outcome, metric or capability must be supported
by indexed content.

### Constraints

- **Models:** the generation model stays Sonnet 5.5 and the eval judge stays Opus 5.5 — user decision
- **Process:** one phase at a time. After each phase, rerun the eval, report the deltas against
  the baseline, and squash the phase into one commit before pushing — user rule
- **Evidence:** verify hypotheses against code and data before acting. Check current docs
  before choosing external products, APIs or model names (rerankers, OpenRouter prompt
  caching, embedding models) — user rule. Per-phase research is off by default; enable it
  for the phases that pick external products (3–5).
- **Database safety:** ask before any destructive DB change or full re-index. Production shares
  the Supabase project, so add new functions alongside the old ones, never replace them in place.
- **Budget:** the OpenRouter key has a $50 cap (about $45 left after Phase 0). One eval run
  costs ~$3.50; three runs plus the second grader cost ~$12 per phase.
- **Eval debug mode:** `/api/chat` honours `debug: true` only when `EVAL_DEBUG=true`, which must never be set in production.
- **Supabase free tier:** the project pauses after inactivity and must be restored before eval runs.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
