/**
 * Optional second grader (EVAL-06): a non-Anthropic model, reached through
 * OpenRouter, grades a deterministic ~15-response sample with the identical
 * rubric, prompt and schema as the Opus judge. Writes grades-second.json and
 * agreement.json (agreement score against Opus, per-criterion detail).
 *
 * Usage:
 *   npm run eval:grade2 -- --dir eval/results/<ts> [--sample 15] [--force]
 *
 * Env: EVAL_SECOND_GRADER_MODEL (default openai/gpt-5.6-sol; anthropic/* refused),
 *      EVAL_SECOND_GRADER_SAMPLE (15), EVAL_GRADE_CONCURRENCY (3)
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { computeAgreement, selectSample, type AgreementResult } from './agreement';
import { GRADER_SCHEMA, HARNESS_VERSION, RUBRIC, buildGraderPrompt, catalogueSection, type GraderOutput } from './rubric';
import { PreflightError, runPreflight } from './preflight';
import {
  assertWritableRunDir,
  CRITERIA,
  argValue,
  hasFlag,
  readJson,
  resolveResultsDir,
  runAutomatedChecks,
  writeJson,
  type Criterion,
  type CriterionScore,
  type GradeRecord,
  type GradesFile,
  type RunFile,
  type RunRecord,
} from './lib';

export const SECOND_GRADER_MODEL = process.env.EVAL_SECOND_GRADER_MODEL || 'openai/gpt-5.6-sol';
const CONCURRENCY = Number(process.env.EVAL_GRADE_CONCURRENCY || 3);
const HALLUCINATION_THRESHOLD = 2;
const SEED = 'eval-06';

interface SecondGradesFile extends GradesFile {
  grader_route: string;
  sample_ids: string[];
  seed: string;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

async function callOnce(client: OpenAI, record: RunRecord, prompt: string): Promise<GraderOutput> {
  const params = {
    model: SECOND_GRADER_MODEL,
    max_tokens: 16000,
    messages: [
      { role: 'system', content: RUBRIC },
      ...(catalogueSection(record) ? [{ role: 'system' as const, content: catalogueSection(record)! }] : []),
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'concierge_grade', strict: true, schema: GRADER_SCHEMA },
    },
    reasoning: { effort: 'high' },
  };
  const res = await client.chat.completions.create(
    params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
  );
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error(`empty response for ${record.id} (finish_reason: ${res.choices[0]?.finish_reason})`);
  return JSON.parse(content) as GraderOutput;
}

async function gradeOne(client: OpenAI, record: RunRecord): Promise<GradeRecord> {
  const base: GradeRecord = {
    id: record.id,
    grader_model: SECOND_GRADER_MODEL,
    harness_version: HARNESS_VERSION,
    graded_at: new Date().toISOString(),
    skipped: null,
    grader_error: null,
    scores: null,
    invented_claims: [],
    context_relevant: null,
    would_strict_pass_fallback: null,
    hallucination: false,
    automated_checks: null,
  };
  if (record.status !== 'ok') return { ...base, skipped: `Run failed: ${record.error}` };

  const checks = runAutomatedChecks(record);
  const prompt = buildGraderPrompt(record, checks);
  let lastError = '';
  // One retry on empty or unparseable output
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const output = await callOnce(client, record, prompt);
      const scores = Object.fromEntries(CRITERIA.map(c => [c, output[c]])) as Record<Criterion, CriterionScore>;
      return {
        ...base,
        scores,
        claims: output.claims,
        invented_claims: output.claims.map(c => c.claim),
        context_relevant: output.context_relevant,
        would_strict_pass_fallback: output.would_strict_pass_fallback,
        hallucination: scores.grounded.score <= HALLUCINATION_THRESHOLD,
        automated_checks: checks,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { ...base, automated_checks: checks, grader_error: lastError };
}

export async function gradeSecond(
  dir: string,
  opts: { sample?: number; force?: boolean } = {},
): Promise<AgreementResult> {
  assertWritableRunDir(dir);
  if (SECOND_GRADER_MODEL.startsWith('anthropic/')) {
    throw new Error(`The second grader must be from another provider (got ${SECOND_GRADER_MODEL})`);
  }
  await runPreflight({
    supabase: false,
    openrouter: true,
    devServer: null,
    minCreditUsd: Number(process.env.EVAL_MIN_CREDIT_USD || 2),
  });

  const gradesPath = path.join(dir, 'grades.json');
  if (!fs.existsSync(gradesPath)) {
    throw new Error('Run `npm run eval:grade` on this run first (Opus grades with harness v2 are needed)');
  }
  const opus = readJson<GradesFile>(gradesPath);
  if (opus.harness_version !== HARNESS_VERSION) {
    throw new Error('Run `npm run eval:grade` on this run first (Opus grades with harness v2 are needed)');
  }
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  const okIds = new Set(opus.grades.filter(g => g.scores).map(g => g.id));
  const candidates = run.records.filter(r => r.status === 'ok' && okIds.has(r.id));

  const size = opts.sample ?? Number(process.env.EVAL_SECOND_GRADER_SAMPLE || 15);
  const ids = selectSample(candidates, size, SEED);
  const byId = new Map(candidates.map(r => [r.id, r]));

  const secondPath = path.join(dir, 'grades-second.json');
  const existing =
    fs.existsSync(secondPath) && !opts.force ? readJson<SecondGradesFile>(secondPath).grades : [];
  const done = new Map(
    existing
      .filter(g => !g.grader_error && g.harness_version === HARNESS_VERSION && g.grader_model === SECOND_GRADER_MODEL)
      .map(g => [g.id, g]),
  );
  const todo = ids.filter(id => !done.has(id));
  console.log(
    `Second grader ${SECOND_GRADER_MODEL} (openrouter): ${todo.length} of ${ids.length} sampled responses to grade (${done.size} already graded)`,
  );

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    timeout: 180_000,
    maxRetries: 3,
  });

  const save = () =>
    writeJson(secondPath, {
      grader_model: SECOND_GRADER_MODEL,
      grader_route: 'openrouter',
      harness_version: HARNESS_VERSION,
      sample_ids: ids,
      seed: SEED,
      grades: ids.map(id => done.get(id)).filter((g): g is GradeRecord => Boolean(g)),
    } satisfies SecondGradesFile);

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const id = todo[next++];
      const grade = await gradeOne(client, byId.get(id)!);
      done.set(id, grade);
      save();
      console.log(
        `  ${id}: ` +
          (grade.scores ? CRITERIA.map(c => `${c}=${grade.scores![c].score}`).join(' ') : `grader error: ${grade.grader_error}`),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  save();

  const result = computeAgreement(
    opus.grades,
    ids.map(id => done.get(id)).filter((g): g is GradeRecord => Boolean(g)),
    { primary: opus.grader_model, second: SECOND_GRADER_MODEL },
  );
  writeJson(path.join(dir, 'agreement.json'), result);

  const q = (c: Criterion) => (result.perCriterion[c].qwk === null ? '-' : result.perCriterion[c].qwk!.toFixed(2));
  console.log(
    `Second grader ${SECOND_GRADER_MODEL} on ${result.n} responses: agreement ${pct(result.agreementScore)} within ±1; exact ${pct(result.overall.exact)}; QWK grounded ${q('grounded')} voice ${q('voice')}`,
  );
  return result;
}

if (require.main === module) {
  const sample = argValue('--sample');
  gradeSecond(resolveResultsDir(), { sample: sample ? Number(sample) : undefined, force: hasFlag('--force') }).catch(
    error => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(error instanceof PreflightError ? 2 : 1);
    },
  );
}
