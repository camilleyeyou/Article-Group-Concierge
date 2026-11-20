/**
 * Eval step 4: write report.md for a graded run.
 *
 * Averages per criterion / persona / query type, hallucination flags, fallback
 * behaviour, retrieval gaps (expected case study not retrieved), content gaps
 * (work on the website that isn't indexed), automated check failures, and the
 * lowest-scoring responses.
 *
 * Usage:
 *   npm run eval:report                          # latest run
 *   npm run eval:report -- --dir eval/results/<timestamp>
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CRITERIA,
  PERSONAS_PATH,
  QUERIES_PATH,
  QUERY_TYPES,
  readJson,
  resolveResultsDir,
  type AutomatedChecks,
  type GradeRecord,
  type GradesFile,
  type Persona,
  type QueriesFile,
  type RunFile,
  type RunRecord,
} from './lib';

interface Row {
  record: RunRecord;
  grade: GradeRecord | undefined;
}

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const truncate = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function mean(values: number[]): string {
  if (values.length === 0) return '–';
  return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '_None._';
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(r => `| ${r.map(esc).join(' | ')} |`),
  ].join('\n');
}

/** One row of criterion averages + hallucination count for a group of results. */
function scoreRow(label: string, rows: Row[]): string[] {
  const graded = rows.filter(r => r.grade?.scores);
  return [
    label,
    `${graded.length}/${rows.length}`,
    ...CRITERIA.map(c => mean(graded.map(r => r.grade!.scores![c].score))),
    String(graded.filter(r => r.grade!.hallucination).length),
  ];
}

const SCORE_HEADERS = ['Group', 'Graded', ...CRITERIA, 'Hallucinations'];

function main() {
  const dir = resolveResultsDir();
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  const gradesPath = path.join(dir, 'grades.json');
  if (!fs.existsSync(gradesPath)) {
    throw new Error(`No grades.json in ${dir}. Run \`npm run eval:grade\` first.`);
  }
  const grades = readJson<GradesFile>(gradesPath);
  const { personas } = readJson<{ personas: Persona[] }>(PERSONAS_PATH);
  const index = fs.existsSync(QUERIES_PATH) ? readJson<QueriesFile>(QUERIES_PATH).indexed_documents : [];

  const titleBySlug = new Map(index.map(d => [d.slug, d.title]));
  const docTitle = (slug: string) => titleBySlug.get(slug) ?? slug;
  const gradeById = new Map(grades.grades.map(g => [g.id, g]));
  const rows: Row[] = run.records.map(record => ({ record, grade: gradeById.get(record.id) }));
  const graded = rows.filter(r => r.grade?.scores);

  const out: string[] = [];
  out.push(`# Concierge eval report`);
  out.push(
    [
      `- **Run:** \`${path.basename(dir)}\` against ${run.base_url} (commit \`${run.git_commit ?? 'unknown'}\`)`,
      `- **Started:** ${run.started_at}${run.finished_at ? `, finished ${run.finished_at}` : ' (did not finish)'}`,
      `- **Queries:** ${run.records.length} run, ${run.records.filter(r => r.status === 'ok').length} succeeded, ${graded.length} graded by \`${grades.grader_model}\``,
      `- **Hallucination rule:** grounded score ≤ 2`,
    ].join('\n'),
  );

  // Summary
  out.push(`## Summary`);
  out.push(table(SCORE_HEADERS, [scoreRow('All', rows)]));
  const hallucinations = graded.filter(r => r.grade!.hallucination);
  out.push(
    `Hallucination rate: **${hallucinations.length}/${graded.length}** (${graded.length ? ((100 * hallucinations.length) / graded.length).toFixed(0) : 0}%).`,
  );

  // By persona / type
  out.push(`## By persona`);
  out.push(
    table(
      SCORE_HEADERS,
      personas.map(p => scoreRow(`${p.id} ${p.label}`, rows.filter(r => r.record.persona_id === p.id))),
    ),
  );
  out.push(`## By query type`);
  out.push(
    table(
      SCORE_HEADERS,
      QUERY_TYPES.map(t => scoreRow(t, rows.filter(r => r.record.type === t))).filter(r => r[1] !== '0/0'),
    ),
  );

  // Hallucinations
  out.push(`## Hallucination flags`);
  out.push(
    table(
      ['ID', 'Type', 'Query', 'Grounded', 'Invented claims'],
      hallucinations.map(r => [
        r.record.id,
        r.record.type,
        truncate(r.record.query, 100),
        `${r.grade!.scores!.grounded.score}: ${r.grade!.scores!.grounded.reason}`,
        r.grade!.invented_claims.join('; ') || '(none listed)',
      ]),
    ),
  );

  // Fallback behaviour
  out.push(`## Fallback behaviour`);
  out.push(
    `Queries where a fallback was expected, the grader judged the retrieved context not relevant, or the query was invention bait. "Strict" shows whether the response explicitly said it lacked directly relevant work (the current prompt tells it never to).`,
  );
  const fallbackRows = graded.filter(
    r => r.record.expected.fallback_expected || r.grade!.context_relevant === false || r.record.type === 'invention_bait',
  );
  out.push(
    table(
      ['ID', 'Type', 'Query', 'Context relevant', 'Fallback', 'Strict', 'Reason'],
      fallbackRows.map(r => [
        r.record.id,
        r.record.type,
        truncate(r.record.query, 80),
        r.grade!.context_relevant ? 'yes' : 'no',
        String(r.grade!.scores!.fallback.score),
        r.grade!.would_strict_pass_fallback ? 'pass' : 'fail',
        r.grade!.scores!.fallback.reason,
      ]),
    ),
  );
  if (fallbackRows.length > 0) {
    out.push(
      `Average fallback score on these: **${mean(fallbackRows.map(r => r.grade!.scores!.fallback.score))}**; strict pass: **${fallbackRows.filter(r => r.grade!.would_strict_pass_fallback).length}/${fallbackRows.length}**.`,
    );
  }

  // Retrieval gaps (deterministic - doesn't need grades)
  out.push(`## Retrieval gaps`);
  out.push(`Queries where an expected case study was not in the retrieved context.`);
  const withExpectations = rows.filter(r => r.record.retrieval && r.record.expected.case_studies.length > 0);
  let expectedTotal = 0;
  let expectedHit = 0;
  const gapRows: string[][] = [];
  for (const r of withExpectations) {
    const retrieved = new Set(r.record.retrieval!.chunks.map(c => c.slug));
    const missing = r.record.expected.case_studies.filter(s => !retrieved.has(s));
    expectedTotal += r.record.expected.case_studies.length;
    expectedHit += r.record.expected.case_studies.length - missing.length;
    if (missing.length > 0) {
      gapRows.push([
        r.record.id,
        truncate(r.record.query, 90),
        missing.map(docTitle).join('; '),
        r.record.retrieval!.chunks.map(c => c.document_title).join('; ') || '(nothing)',
      ]);
    }
  }
  out.push(
    `Expected case-study recall: **${expectedHit}/${expectedTotal}**${expectedTotal ? ` (${((100 * expectedHit) / expectedTotal).toFixed(0)}%)` : ''} across ${withExpectations.length} queries.`,
  );
  out.push(table(['ID', 'Query', 'Expected but missing', 'Retrieved instead'], gapRows));

  // Content gaps
  out.push(`## Content gaps`);
  out.push(
    `Queries targeting work that appears on articlegroup.com/work but is not in the index. Reingesting this content is the fix, not retrieval tuning.`,
  );
  out.push(
    table(
      ['ID', 'Query', 'Site-only work'],
      rows
        .filter(r => r.record.expected.site_only_work.length > 0)
        .map(r => [r.record.id, truncate(r.record.query, 100), r.record.expected.site_only_work.join('; ')]),
    ),
  );

  // Automated checks
  out.push(`## Automated check failures`);
  const checkKeys: Array<keyof AutomatedChecks> = [
    'unknown_components',
    'missing_props',
    'media_not_in_context',
    'unknown_slugs',
    'non_verbatim_titles',
    'metrics_not_in_context',
    'videos_available_not_used',
  ];
  const checkRows: string[][] = [];
  for (const r of rows) {
    const checks = r.grade?.automated_checks;
    if (!checks) continue;
    if (!checks.layout_parsed) checkRows.push([r.record.id, 'layout_parsed', 'no valid json layout block']);
    for (const key of checkKeys) {
      const values = checks[key] as string[];
      if (values.length > 0) checkRows.push([r.record.id, key, values.join('; ')]);
    }
  }
  out.push(table(['ID', 'Check', 'Details'], checkRows));

  // Lowest scoring
  out.push(`## Lowest-scoring responses`);
  const avg = (g: GradeRecord) => CRITERIA.reduce((sum, c) => sum + g.scores![c].score, 0) / CRITERIA.length;
  out.push(
    table(
      ['ID', 'Type', 'Query', 'Mean', 'Weakest criterion'],
      [...graded]
        .sort((a, b) => avg(a.grade!) - avg(b.grade!))
        .slice(0, 10)
        .map(r => {
          const weakest = [...CRITERIA].sort((a, b) => r.grade!.scores![a].score - r.grade!.scores![b].score)[0];
          return [
            r.record.id,
            r.record.type,
            truncate(r.record.query, 90),
            avg(r.grade!).toFixed(2),
            `${weakest} ${r.grade!.scores![weakest].score}: ${r.grade!.scores![weakest].reason}`,
          ];
        }),
    ),
  );

  // Errors
  out.push(`## Errors`);
  out.push(
    table(
      ['ID', 'Stage', 'Error'],
      rows
        .map(r =>
          r.record.status === 'error'
            ? [r.record.id, 'run', r.record.error ?? 'unknown']
            : r.grade?.grader_error
              ? [r.record.id, 'grade', r.grade.grader_error]
              : !r.grade
                ? [r.record.id, 'grade', 'not graded yet']
                : null,
        )
        .filter((r): r is string[] => r !== null),
    ),
  );

  const reportPath = path.join(dir, 'report.md');
  fs.writeFileSync(reportPath, out.join('\n\n') + '\n');
  console.log(`Wrote ${reportPath}`);

  // Raw per-query grades, one row per query, for spreadsheets
  const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    'id', 'persona', 'type', 'query', 'status', 'latency_ms',
    ...CRITERIA.flatMap(c => [c, `${c}_reason`]),
    'average', 'hallucination', 'context_relevant', 'would_strict_pass_fallback',
    'invented_claims', 'retrieved_case_studies', 'expected_case_studies', 'error',
  ];
  const csvRows = rows.map(({ record, grade }) => {
    const scores = grade?.scores;
    const nums = scores ? CRITERIA.map(c => scores[c].score) : [];
    return [
      record.id, record.persona_id, record.type, record.query, record.status, record.latency_ms,
      ...CRITERIA.flatMap(c => (scores ? [scores[c].score, scores[c].reason] : ['', ''])),
      nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : '',
      grade?.hallucination ?? '', grade?.context_relevant ?? '', grade?.would_strict_pass_fallback ?? '',
      (grade?.invented_claims ?? []).join('; '),
      [...new Set((record.retrieval?.chunks ?? []).map(c => c.slug))].join('; '),
      (record.expected.case_studies ?? []).join('; '),
      record.error ?? grade?.grader_error ?? grade?.skipped ?? '',
    ].map(csvCell).join(',');
  });
  const csvPath = path.join(dir, 'grades.csv');
  fs.writeFileSync(csvPath, '﻿' + [header.join(','), ...csvRows].join('\n') + '\n');
  console.log(`Wrote ${csvPath}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
