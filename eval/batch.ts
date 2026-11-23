/**
 * Run, grade and report N eval runs, then print mean / SD / min-max per metric.
 *
 * Usage:
 *   npm run eval:batch -- --runs 3
 *   EVAL_RUNS=3 npm run eval
 *   npm run eval:batch -- --runs 1 --persona p5 --limit 3   # cheap smoke batch
 *   npm run eval:batch -- --runs 3 --second-grader            # also grade a 15-response sample with a non-Anthropic model
 *   npm run eval:batch -- --runs 1 --subset phase4-smoke   # Phase 4 smoke (~21 queries, ~$1.80)
 *
 * N defaults to 1 (EVAL_RUNS env or --runs), max 5.
 */

import * as path from 'path';
import { RESULTS_DIR, argValue, hasFlag, timestamp, writeJson } from './lib';
import * as fs from 'fs';
import { aggregateRuns } from './aggregate';
import { gradeDir } from './grade';
import { gradeSecond } from './grade-second';
import { PreflightError, runPreflight } from './preflight';
import { writeReport } from './report';
import { runEval } from './run';
import { resolveIds } from './subsets';

const BASE_URL = (process.env.EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function main() {
  const runs = Number(argValue('--runs') ?? process.env.EVAL_RUNS ?? 1);
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) {
    console.error('--runs (or EVAL_RUNS) must be an integer from 1 to 5');
    process.exit(1);
  }
  const secondGrader = hasFlag('--second-grader') || process.env.EVAL_SECOND_GRADER === 'on';
  const persona = argValue('--persona');
  const limitArg = argValue('--limit');
  const limit = limitArg ? Number(limitArg) : undefined;
  const ids = resolveIds({ ids: argValue('--ids'), subset: argValue('--subset') });

  // Stops before spending if the credit can't cover the whole batch
  const pre = await runPreflight({
    supabase: true,
    openrouter: true,
    devServer: BASE_URL,
    minCreditUsd: runs * (ids ? Math.max(0.5, 0.09 * ids.length) : 3.5) + 1 + (secondGrader ? 1 : 0),
  });

  const startedAt = new Date().toISOString();
  const batchDir = path.join(RESULTS_DIR, `batch-${timestamp()}`);
  const dirs: string[] = [];
  for (let i = 1; i <= runs; i++) {
    const dir = await runEval({ persona, limit, ids });
    await gradeDir(dir);
    // Second-grader agreement is computed on the first run only
    if (secondGrader && i === 1) await gradeSecond(dir);
    writeReport(dir);
    dirs.push(dir);
    console.log(`Run ${i}/${runs} done: ${dir}`);
  }

  const post = await runPreflight({ supabase: false, openrouter: true, devServer: null, minCreditUsd: 0 });
  const before = pre.creditRemainingUsd;
  const after = post.creditRemainingUsd;
  writeJson(path.join(batchDir, 'batch.json'), {
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    ids: ids ?? null,
    runs: dirs.map(d => path.basename(d)),
    credit_before_usd: before,
    credit_after_usd: after,
    cost_usd: before !== null && after !== null ? Math.round((before - after) * 100) / 100 : null,
  });

  const aggregate = aggregateRuns(dirs);
  fs.writeFileSync(path.join(batchDir, 'aggregate.md'), aggregate);
  console.log(`\n${aggregate}`);
  console.log(`Batch written to ${batchDir}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(error instanceof PreflightError ? 2 : 1);
});
