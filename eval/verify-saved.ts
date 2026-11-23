/**
 * GEN-07: run the claim-check verifier over a saved run (no regeneration) and re-grade only the
 * responses it rewrote. The source run is only read.
 *
 * Usage: npm run eval:verify-saved -- --of eval/results/<run>
 * Costs Haiku calls plus Opus re-grades of rewritten responses (about $3 for 50 responses).
 */

import * as fs from 'fs';
import * as path from 'path';
import { RESULTS_DIR, argValue, readJson, timestamp, writeJson, type GradesFile, type RunFile } from './lib';
import { gradeDir } from './grade';
import { writeReport } from './report';
import { runPreflight, PreflightError } from './preflight';
import { median } from './metrics';
import { verifyOutput } from '../src/lib/verifier';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function p90(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.9 * s.length) - 1)];
}

export async function verifySaved(sourceDir: string): Promise<string> {
  if (!fs.existsSync(path.join(sourceDir, 'responses.json'))) {
    throw new Error(`No responses.json in ${sourceDir}`);
  }
  const source = readJson<RunFile>(path.join(sourceDir, 'responses.json'));

  const before = await runPreflight({
    supabase: false,
    openrouter: true,
    devServer: null,
    minCreditUsd: Number(process.env.EVAL_MIN_CREDIT_USD || 4),
  });

  const newDir = path.join(RESULTS_DIR, `${timestamp()}-verified`);
  const run: RunFile = JSON.parse(JSON.stringify(source));
  run.verified_of = path.basename(sourceDir);

  const rewritten = new Set<string>();
  let verifiedOk = 0;
  let failed = 0;
  let rewritesTotal = 0;
  let haikuCost = 0;
  const latencies: number[] = [];

  for (const record of run.records) {
    if (record.status !== 'ok' || !record.response || !record.retrieval) continue;
    const { output, report } = await verifyOutput({
      query: record.query,
      context: record.retrieval,
      output: { ...record.response, rawResponse: record.raw_response ?? undefined },
    });
    record.verifier = report;
    if (report.ok) verifiedOk++;
    else failed++;
    haikuCost += report.cost ?? 0;
    if (report.spans > 0) latencies.push(report.latencyMs);
    if (report.rewrites.length > 0) {
      rewritesTotal += report.rewrites.length;
      rewritten.add(record.id);
      const { rawResponse, verifier: _v, ...rest } = output;
      record.response = rest;
      record.raw_response = rawResponse ?? record.raw_response;
    }
    console.log(`${record.id}: ${report.ok ? 'ok' : 'FAILED ' + report.error} spans=${report.spans} rewrites=${report.rewrites.length} ${report.latencyMs}ms`);
    await sleep(500);
  }
  writeJson(path.join(newDir, 'responses.json'), run);

  // Unchanged responses keep their grade (same text); gradeDir without force re-grades only the rest.
  const srcGrades = path.join(sourceDir, 'grades.json');
  if (fs.existsSync(srcGrades)) {
    const g = readJson<GradesFile>(srcGrades);
    writeJson(path.join(newDir, 'grades.json'), { ...g, grades: g.grades.filter(x => !rewritten.has(x.id)) });
  }
  await gradeDir(newDir);
  writeReport(newDir);

  const after = await runPreflight({ supabase: false, openrouter: true, devServer: null, minCreditUsd: 0 });
  const totalCost =
    before.creditRemainingUsd !== null && after.creditRemainingUsd !== null
      ? Math.round((before.creditRemainingUsd - after.creditRemainingUsd) * 100) / 100
      : null;
  const summary = {
    source: path.basename(sourceDir),
    responses: run.records.length,
    verified_ok: verifiedOk,
    failed,
    responses_rewritten: rewritten.size,
    rewrites_total: rewritesTotal,
    latency_ms: { median: median(latencies), p90: p90(latencies), max: latencies.length ? Math.max(...latencies) : null },
    haiku_cost_usd: Math.round(haikuCost * 10000) / 10000,
    credit_before_usd: before.creditRemainingUsd,
    credit_after_usd: after.creditRemainingUsd,
    total_cost_usd: totalCost,
  };
  writeJson(path.join(newDir, 'verifier.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
  return newDir;
}

if (require.main === module) {
  const of = argValue('--of');
  if (!of) {
    console.error('Usage: npm run eval:verify-saved -- --of eval/results/<run>');
    process.exit(1);
  }
  verifySaved(path.resolve(of))
    .then(dir => console.log(`Verified into ${dir}`))
    .catch(error => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(error instanceof PreflightError ? 2 : 1);
    });
}
