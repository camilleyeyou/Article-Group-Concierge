/**
 * Eval step 3: grade each response with Claude as judge.
 *
 * Sends (query, retrieved context, automated checks, raw response) to Claude
 * with the shared rubric (eval/rubric.ts) and stores 1-5 scores plus a one-line
 * reason for grounded / components / fallback / cta / voice. The grader sees
 * what the concierge saw and nothing about who is asking, no expected block. Unsupported claims are
 * classified by kind. A grounded score of 2 or less is flagged as a hallucination.
 *
 * Grades are saved after each response and reused on rerun, so an interrupted
 * grading pass resumes where it stopped.
 *
 * Usage:
 *   npm run eval:grade                          # latest run
 *   npm run eval:grade -- --dir eval/results/<timestamp>
 *   npm run eval:grade -- --force               # re-grade everything
 *
 * Env: EVAL_MODEL (default claude-opus-5-5), EVAL_GRADE_CONCURRENCY (default 3)
 */

import * as fs from 'fs';
import * as path from 'path';
import { claudeModelId, providerRoute } from '../src/lib/llm-config';
import { GRADER_SCHEMA, HARNESS_VERSION, RUBRIC, buildGraderPrompt, catalogueSection, type GraderOutput } from './rubric';
import {
  assertWritableRunDir,
  callClaudeJson,
  CRITERIA,
  EVAL_MODEL,
  hasFlag,
  readJson,
  resolveResultsDir,
  runAutomatedChecks,
  writeJson,
  type AutomatedChecks,
  type Criterion,
  type CriterionScore,
  type GradeRecord,
  type GradesFile,
  type RunFile,
  type RunRecord,
} from './lib';

const CONCURRENCY = Number(process.env.EVAL_GRADE_CONCURRENCY || 3);
const HALLUCINATION_THRESHOLD = 2;

async function gradeOne(record: RunRecord): Promise<GradeRecord> {
  const base: GradeRecord = {
    id: record.id,
    grader_model: claudeModelId(EVAL_MODEL),
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

  if (record.status !== 'ok') {
    return { ...base, skipped: `Run failed: ${record.error}` };
  }

  const checks = runAutomatedChecks(record);
  const cat = catalogueSection(record);
  try {
    const output = await callClaudeJson<GraderOutput>({
      // Rubric + concierge prompt is identical for every call, so cache it
      system: [
        { type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } },
        ...(cat ? [{ type: 'text' as const, text: cat, cache_control: { type: 'ephemeral' as const } }] : []),
      ],
      user: buildGraderPrompt(record, checks),
      schema: GRADER_SCHEMA,
      effort: 'high',
    });
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
    return {
      ...base,
      automated_checks: checks,
      grader_error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function gradeDir(dir: string, opts: { force?: boolean } = {}): Promise<void> {
  assertWritableRunDir(dir);
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));

  const gradesPath = path.join(dir, 'grades.json');
  const existing = fs.existsSync(gradesPath) && !opts.force ? readJson<GradesFile>(gradesPath).grades : [];
  // Keep finished grades from this harness version; retry failures and re-grade old-harness grades
  const done = new Map(
    existing.filter(g => !g.grader_error && g.harness_version === HARNESS_VERSION).map(g => [g.id, g]),
  );

  const todo = run.records.filter(r => !done.has(r.id));
  console.log(
    `Grading ${todo.length} responses in ${path.relative(process.cwd(), dir)} with ${EVAL_MODEL} (${done.size} already graded)`,
  );

  const save = () =>
    writeJson(gradesPath, {
      grader_model: claudeModelId(EVAL_MODEL),
      grader_route: providerRoute(),
      harness_version: HARNESS_VERSION,
      grades: run.records.map(r => done.get(r.id)).filter((g): g is GradeRecord => Boolean(g)),
    } satisfies GradesFile);

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const record = todo[next++];
      const grade = await gradeOne(record);
      done.set(record.id, grade);
      save();

      const summary = grade.scores
        ? CRITERIA.map(c => `${c}=${grade.scores![c].score}`).join(' ') + (grade.hallucination ? '  HALLUCINATION' : '')
        : grade.skipped ?? `grader error: ${grade.grader_error}`;
      console.log(`  ${record.id}: ${summary}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  save();

  const graderErrors = [...done.values()].filter(g => g.grader_error).length;
  console.log(`Done. Grades: ${gradesPath}${graderErrors ? ` (${graderErrors} grader errors - rerun to retry)` : ''}`);
}

if (require.main === module) {
  gradeDir(resolveResultsDir(), { force: hasFlag('--force') }).catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
