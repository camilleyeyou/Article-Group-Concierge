---
phase: 05-speed
plan: 10
status: complete
completed: 2026-11-23
commit: d9d5ccf
---

# 05-10 Summary: outcome, squash, push, production smoke

## User decision

Option: **push** ("Squash and push"), given as "push" on 2026-11-23.

## Squash and push

- Checks before the squash: eval:test 0 failures, tsc clean, lint clean, `next build` OK.
- 45 Phase 5 commits squashed onto origin/main 4db5d2d as **d9d5ccf**. The tree is identical to the pre-squash HEAD a13184e, which is kept as branch `backup/phase5-pre-squash`.
- Unrelated working-tree files were not staged.
- Pushed to main. The Vercel deploy was live in about 80 s (the stream route stopped returning 404).

## Production smoke (measured from Douala)

| Query (uncached) | teasers | hero | complete |
|---|---|---|---|
| Security software companies partnered with | 1876 ms | 13.9 s | 19.0 s |
| Cloud infrastructure to enterprise buyers | 1814 ms | 12.5 s | 18.2 s |
| Fintech, explaining complex products | 1899 ms | 11.1 s | 18.0 s |
| Wiz CNAPP bait | suppressed at 2128 ms | 9.3 s | 13.9 s |

- Events arrive incrementally, so the proxy is not buffering.
- The Wiz answer says AG "can't point to a Wiz CNAPP launch" and confirms no results.
- The JSON route `/api/chat` returned 200 in 15.1 s.
- `debug: true` is ignored in production; no debug payload is returned.
- `/api/health` returns 503 "Admin endpoint not configured" because `ADMIN_API_TOKEN` is not set in Vercel. It is admin-gated by design and was left unchanged. The startup log and local `/api/health` show live credit.
- Note: `eval/stream-smoke.ts` takes `--query "<text>"`, and a positional argument is ignored. The first smoke pass reused the default query, so it hit the answer cache.

## Verdicts

- PERF-01: **FAIL / Partial**. Teasers arrive at 1.8-1.9 s against the 1.5 s target.
- PERF-02: **MISSED**. The hero arrives at 11-14 s with default thinking; deferred to Phase 6.
- PERF-03: **Complete**.
- D-513 quality: **PASS** (eval 2026-11-23T19-49-22).
