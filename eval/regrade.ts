/**
 * Re-grade a copy of an existing run under the current harness.
 *
 * Copies responses.json into a new `<timestamp>-regrade` directory (the source
 * is only read, so the frozen baseline is never touched), then runs the grader
 * and report there. Judge calls only; no generation.
 *
 * Usage:
 *   npm run eval:regrade                       # re-grade the frozen baseline
 *   npm run eval:regrade -- --of eval/results/<dir>
 */

import * as path from 'path';
import { FROZEN_BASELINE_ID, RESULTS_DIR, argValue, readJson, timestamp, writeJson, type RunFile } from './lib';
import * as fs from 'fs';
import { gradeDir } from './grade';
import { writeReport } from './report';
import { runPreflight, PreflightError } from './preflight';

export async function regradeRun(sourceDir: string): Promise<string> {
  if (!fs.existsSync(path.join(sourceDir, 'responses.json'))) {
    throw new Error(`No responses.json in ${sourceDir}`);
  }
  const source = readJson<RunFile>(path.join(sourceDir, 'responses.json'));

  // Grading needs no Supabase or dev server
  const before = await runPreflight({
    supabase: false,
    openrouter: true,
    devServer: null,
    minCreditUsd: Number(process.env.EVAL_MIN_CREDIT_USD || 3),
  });

  const newDir = path.join(RESULTS_DIR, `${timestamp()}-regrade`);
  const run: RunFile = {
    ...source,
    regrade_of: path.basename(sourceDir),
    regraded_at: new Date().toISOString(),
  };
  writeJson(path.join(newDir, 'responses.json'), run);

  await gradeDir(newDir, { force: true });
  writeReport(newDir);

  const after = await runPreflight({ supabase: false, openrouter: true, devServer: null, minCreditUsd: 0 });
  let costUsd: number | null = null;
  if (before.creditRemainingUsd !== null && after.creditRemainingUsd !== null) {
    costUsd = Math.round((before.creditRemainingUsd - after.creditRemainingUsd) * 100) / 100;
    console.log(`Regrade cost: $${costUsd.toFixed(2)} (OpenRouter credit before − after)`);
  }
  writeJson(path.join(newDir, 'regrade.json'), { cost_usd: costUsd });
  return newDir;
}

if (require.main === module) {
  const of = argValue('--of');
  const source = of ? path.resolve(of) : path.join(RESULTS_DIR, FROZEN_BASELINE_ID);
  regradeRun(source)
    .then(dir => console.log(`Regraded into ${dir}`))
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(error instanceof PreflightError ? 2 : 1);
    });
}
