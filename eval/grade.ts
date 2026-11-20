/**
 * Eval step 3: grade each response with Claude as judge.
 *
 * Sends (query, persona, expected, retrieved context, automated checks, raw
 * response) to Claude with a rubric and stores 1-5 scores plus a one-line
 * reason for grounded / components / fallback / cta / voice. A grounded score
 * of 2 or less is flagged as a hallucination.
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
import { SYSTEM_PROMPT as CONCIERGE_PROMPT } from '../src/lib/orchestrator';
import {
  callClaudeJson,
  CRITERIA,
  EVAL_MODEL,
  hasFlag,
  PERSONAS_PATH,
  readJson,
  resolveResultsDir,
  runAutomatedChecks,
  writeJson,
  type AutomatedChecks,
  type Criterion,
  type CriterionScore,
  type GradeRecord,
  type GradesFile,
  type Persona,
  type RunFile,
  type RunRecord,
} from './lib';

const CONCURRENCY = Number(process.env.EVAL_GRADE_CONCURRENCY || 3);
const HALLUCINATION_THRESHOLD = 2;

const RUBRIC = `You are a strict, fair evaluator of the Article Group AI Concierge: a RAG chatbot that answers prospective clients by retrieving AG case studies (client work) and articles (AG's thinking) and assembling a JSON "pitch deck" layout plus a short narrative.

Below is the concierge's own system prompt. Use it as the reference for the component registry, its rules, and the intended brand voice. Its NeoBank example is FICTIONAL - if a response mentions NeoBank or "+340% brand awareness", that is an invention.

<concierge_system_prompt>
${CONCIERGE_PROMPT}
</concierge_system_prompt>

Score each criterion from 1 (bad) to 5 (excellent) with a one-line reason that cites the specific evidence.

## grounded
Every factual claim about AG and its work must be supported by the RETRIEVED CONTEXT: client names, case study titles, deliverables, outcomes, metrics, awards, and claims of having done a kind of work. General strategic advice and opinion are not factual claims. Brands mentioned inside ARTICLES are not AG clients - presenting them as AG work is unsupported. A response that confirms or describes a client/project/result the user asked about that is not in context is an invention.
5 = everything supported. 4 = minor stretch in paraphrase, no invented specifics. 3 = one unsupported specific detail (e.g. a deliverable) but no invented client, case study, metric or outcome. 2 = an invented metric, client, case study, outcome, or non-AG work attributed to AG. 1 = several inventions or largely fabricated.
List every unsupported claim in invented_claims (short quote or paraphrase). Empty list if none.

## components
Valid JSON layout block; only registry component names; required props present; slugs, thumbnailUrl, VideoPlayer url and VisualAsset src taken from context; CaseStudyTeaser titles verbatim; follows the prompt's mandatory rules (HeroBlock first, VideoPlayer when a retrieved case study has a Vimeo URL, a CaseStudyTeaser for retrieved case studies, 4-10 components). The AUTOMATED CHECKS section lists deterministic findings - trust them, but judge severity yourself (e.g. a slightly reworded title is minor; a made-up slug or image URL is serious).

## fallback (honest reframing standard)
First decide context_relevant: does the retrieved context contain work genuinely relevant to what this user needs?
- If relevant: 5 when the response uses it directly without needless hedging or deflection; lower if it deflects or under-uses relevant work.
- If NOT relevant (or only loosely adjacent): the prompt tells the concierge to reframe positively and still show case studies, so showing adjacent work is allowed. What matters is honesty. 5 = it is clear the work shown is adjacent/transferable rather than a direct match, it does not imply AG has done this specific kind of work, and it offers a sensible route (e.g. a conversation with the Strategy Lead). 3 = vague but not misleading. 1-2 = presents unrelated work as directly relevant, implies experience AG does not have, or invents to fill the gap.
For invention-bait queries (asking about a client/result not in the index): a good answer does not confirm it and redirects to real work.
Also set would_strict_pass_fallback: true only if the response explicitly says it lacks directly relevant work/case studies for this request (or context was relevant and no fallback was needed).

## cta
The response ends with a sensible next step for THIS user: specific follow-up questions and/or an invitation to talk to the Strategy Lead. 5 = specific, useful and fitted to the persona's goal. 3 = generic. 1 = none.

## voice
Matches the concierge prompt's tone: premium, confident but not arrogant, a trusted strategic advisor, active and specific language, a synthesized 2-4 sentence narrative rather than a list, no repetition across HeroBlock / StrategyCard / explanation. Adapts register to the persona (e.g. plain language for a non-marketer) without losing the brand voice.`;

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'reason'],
  properties: {
    score: { type: 'integer', enum: [1, 2, 3, 4, 5] },
    reason: { type: 'string' },
  },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['context_relevant', 'would_strict_pass_fallback', 'invented_claims', ...CRITERIA],
  properties: {
    context_relevant: { type: 'boolean' },
    would_strict_pass_fallback: { type: 'boolean' },
    invented_claims: { type: 'array', items: { type: 'string' } },
    ...Object.fromEntries(CRITERIA.map(c => [c, scoreSchema])),
  },
};

type GraderOutput = Record<Criterion, CriterionScore> & {
  context_relevant: boolean;
  would_strict_pass_fallback: boolean;
  invented_claims: string[];
};

function formatContext(record: RunRecord): string {
  const retrieval = record.retrieval;
  if (!retrieval) return '(no retrieval captured)';

  const chunks = retrieval.chunks.map(
    (c, i) => `[${i + 1}] ${c.document_type === 'case_study' ? 'CASE STUDY' : 'ARTICLE'} (score ${c.combined_score.toFixed(3)})
Title: ${c.document_title}
Client: ${c.client_name ?? 'N/A'}
Slug: ${c.slug}
Vimeo URL: ${c.vimeo_url ?? 'None'}
Thumbnail URL: ${c.thumbnail_url ?? 'None'}
Content: ${c.content}`,
  );
  // Signed URL tokens are long and irrelevant to grading; the storage path identifies the asset
  const assets = retrieval.visualAssets.map(
    (a, i) => `[Asset ${i + 1}] path: ${a.bucket_name}/${a.storage_path} | caption: ${a.caption ?? 'N/A'} | alt: ${a.alt_text ?? 'N/A'} | description: ${a.description ?? 'N/A'} | score ${a.similarity_score.toFixed(3)}`,
  );
  const metrics = retrieval.relatedMetrics.map(m => `- ${m.label}: ${m.value}${m.context ? ` (${m.context})` : ''}`);

  return [
    `### Chunks (${chunks.length})\n${chunks.join('\n\n') || '(none)'}`,
    `### Visual assets (${assets.length})\n${assets.join('\n') || '(none)'}`,
    `### Metrics (${metrics.length})\n${metrics.join('\n') || '(none)'}`,
  ].join('\n\n');
}

function formatChecks(checks: AutomatedChecks): string {
  return Object.entries(checks)
    .map(([key, value]) =>
      Array.isArray(value) ? `- ${key}: ${value.length ? value.join(' | ') : 'none'}` : `- ${key}: ${value}`,
    )
    .join('\n');
}

function buildPrompt(record: RunRecord, persona: Persona | undefined, checks: AutomatedChecks): string {
  const response =
    record.raw_response ?? `(raw text unavailable - parsed output)\n${JSON.stringify(record.response, null, 2)}`;

  return `## PERSONA
${persona ? `${persona.label}: ${persona.role}, ${persona.company_type} (${persona.industry}). Problem: ${persona.marketing_problem}` : record.persona_id}

## QUERY (type: ${record.type})
${record.query}

## EXPECTED (written before the run; a guide, not ground truth)
${JSON.stringify(record.expected, null, 2)}

## RETRIEVED CONTEXT (the only source of truth for grounding)
${formatContext(record)}

## AUTOMATED CHECKS
${formatChecks(checks)}

## CONCIERGE RESPONSE (raw model output)
${response}`;
}

async function gradeOne(record: RunRecord, persona: Persona | undefined): Promise<GradeRecord> {
  const base: GradeRecord = {
    id: record.id,
    grader_model: EVAL_MODEL,
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
  try {
    const output = await callClaudeJson<GraderOutput>({
      // Rubric + concierge prompt is identical for every call, so cache it
      system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
      user: buildPrompt(record, persona, checks),
      schema: SCHEMA,
      effort: 'high',
    });
    const scores = Object.fromEntries(CRITERIA.map(c => [c, output[c]])) as Record<Criterion, CriterionScore>;
    return {
      ...base,
      scores,
      invented_claims: output.invented_claims,
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

async function main() {
  const dir = resolveResultsDir();
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  const { personas } = readJson<{ personas: Persona[] }>(PERSONAS_PATH);
  const personaById = new Map(personas.map(p => [p.id, p]));

  const gradesPath = path.join(dir, 'grades.json');
  const existing = fs.existsSync(gradesPath) && !hasFlag('--force') ? readJson<GradesFile>(gradesPath).grades : [];
  // Keep finished grades; retry anything the grader failed on
  const done = new Map(existing.filter(g => !g.grader_error).map(g => [g.id, g]));

  const todo = run.records.filter(r => !done.has(r.id));
  console.log(
    `Grading ${todo.length} responses in ${path.relative(process.cwd(), dir)} with ${EVAL_MODEL} (${done.size} already graded)`,
  );

  const save = () =>
    writeJson(gradesPath, {
      grader_model: EVAL_MODEL,
      grades: run.records.map(r => done.get(r.id)).filter((g): g is GradeRecord => Boolean(g)),
    } satisfies GradesFile);

  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const record = todo[next++];
      const grade = await gradeOne(record, personaById.get(record.persona_id));
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

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
