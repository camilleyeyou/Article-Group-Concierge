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
  CLAIM_KINDS,
  CRITERIA,
  FROZEN_BASELINE_ID,
  RESULTS_DIR,
  argValue,
  assertWritableRunDir,
  PERSONAS_PATH,
  QUERIES_PATH,
  QUERY_TYPES,
  readJson,
  resolveResultsDir,
  type AutomatedChecks,
  type ClaimKind,
  type GradeRecord,
  type GradesFile,
  type Persona,
  type QueriesFile,
  type RunFile,
  type RunRecord,
} from './lib';
import type { AgreementResult } from './agreement';
import { METRIC_DEFS, computeRunMetrics, findRegradeDir, formatDelta, formatValue, type RunMetrics } from './metrics';

interface Row {
  record: RunRecord;
  grade: GradeRecord | undefined;
}

function claimText(g: GradeRecord): string {
  return g.claims?.length ? g.claims.map(c => `${c.kind}: ${c.claim}`).join('; ') : g.invented_claims.join('; ');
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

const KIND_LABELS: Record<ClaimKind, string> = {
  goal_as_result: 'Goal stated as result',
  capability_not_shown: 'Capability not shown',
  generated_tags: 'Generated tags',
  other: 'Other',
};

function comparisonSection(dir: string, m: RunMetrics): string[] {
  const baselineDir = process.env.EVAL_BASELINE_DIR
    ? path.resolve(process.env.EVAL_BASELINE_DIR)
    : path.join(RESULTS_DIR, FROZEN_BASELINE_ID);
  const out: string[] = [`## Comparison with baseline`];
  if (!fs.existsSync(path.join(baselineDir, 'responses.json'))) {
    out.push(`Baseline run not found at ${baselineDir}; no comparison.`);
    return out;
  }
  const regradeArg = argValue('--baseline-regrade');
  const regradeDir = regradeArg ? path.resolve(regradeArg) : findRegradeDir(FROZEN_BASELINE_ID);
  const base = computeRunMetrics(baselineDir);
  const regrade = regradeDir && fs.existsSync(path.join(regradeDir, 'responses.json')) ? computeRunMetrics(regradeDir) : null;

  const rows = METRIC_DEFS.map(def => {
    const cur = def.get(m);
    const b = def.get(base);
    const r = regrade ? def.get(regrade) : null;
    return [
      def.label,
      formatValue(def, b),
      regrade ? formatValue(def, r) : '–',
      formatValue(def, cur),
      formatDelta(def, cur, b, base, m),
      regrade ? formatDelta(def, cur, r, regrade, m) : '–',
    ];
  });
  out.push(
    table(
      ['Metric', `Frozen baseline (v${base.harness_version} grades)`, 'Baseline re-graded', 'This run', 'Δ vs frozen', 'Δ vs re-graded'],
      rows,
    ),
  );
  out.push(
    `Δ vs re-graded compares the same harness (like-for-like). Δ vs frozen mixes harness changes with app changes. metrics_not_in_context, strategy-Lead and recall/latency rows are recomputed from responses with the current code, so they are comparable across both.`,
  );
  void dir;
  return out;
}

export function writeReport(dir: string): void {
  assertWritableRunDir(dir);
  const m = computeRunMetrics(dir);
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

  const agreementPath = path.join(dir, 'agreement.json');
  const agreement = fs.existsSync(agreementPath) ? readJson<AgreementResult>(agreementPath) : null;
  const pct0 = (x: number) => `${(x * 100).toFixed(0)}%`;

  const out: string[] = [];
  out.push(`# Concierge eval report`);
  out.push(
    [
      `- **Run:** \`${path.basename(dir)}\` against ${run.base_url} (commit \`${run.git_commit ?? 'unknown'}\`)`,
      `- **Started:** ${run.started_at}${run.finished_at ? `, finished ${run.finished_at}` : ' (did not finish)'}`,
      `- **Queries:** ${run.records.length} run, ${run.records.filter(r => r.status === 'ok').length} succeeded, ${graded.length} graded by \`${grades.grader_model}\``,
      `- **Route:** ${m.models.route ?? 'not recorded'}`,
      `- **Generation model:** \`${m.models.generation ?? 'not recorded'}\` · **Embedding model:** \`${m.models.embedding ?? 'not recorded'}\``,
      `- **Judge:** \`${m.models.judge}\` via ${m.models.judge_route ?? 'not recorded'} (harness v${m.harness_version})`,
      ...(agreement
        ? [`- **Second grader:** \`${agreement.second_model}\` via openrouter on ${agreement.n} responses`]
        : []),
      ...(m.regrade_of ? [`- **Re-grade of:** \`${m.regrade_of}\` (same responses, current harness)`] : []),
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

  out.push(...comparisonSection(dir, m));

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
        claimText(r.grade!) || '(none listed)',
      ]),
    ),
  );

  // Unsupported claims by kind
  out.push(`## Unsupported claims by kind`);
  if (!m.claims_by_kind || !m.responses_by_kind) {
    out.push(
      `Claims were not classified by kind (graded with harness v1). Totals: ${m.unsupported_claims_total} claims in ${m.responses_with_unsupported_claims} responses.`,
    );
  } else {
    out.push(
      table(
        ['Kind', 'Claims', 'Responses'],
        [
          ...CLAIM_KINDS.map(k => [KIND_LABELS[k], String(m.claims_by_kind![k]), String(m.responses_by_kind![k])]),
          ['All', String(m.unsupported_claims_total), String(m.responses_with_unsupported_claims)],
        ],
      ),
    );
    const countKind = (g: GradeRecord, k: ClaimKind) => (g.claims ?? []).filter(c => c.kind === k).length;
    out.push(
      table(
        ['ID', 'Query', 'Goal→result', 'Capability', 'Tags', 'Other', 'Claims'],
        graded
          .filter(r => (r.grade!.claims ?? []).length > 0)
          .map(r => [
            r.record.id,
            truncate(r.record.query, 90),
            String(countKind(r.grade!, 'goal_as_result')),
            String(countKind(r.grade!, 'capability_not_shown')),
            String(countKind(r.grade!, 'generated_tags')),
            String(countKind(r.grade!, 'other')),
            claimText(r.grade!),
          ]),
      ),
    );
  }

  // Agreement with the second grader
  if (agreement) {
    out.push(`## Second grader agreement`);
    out.push(
      `Agreement score: **${pct0(agreement.agreementScore)}** of criterion scores within ±1 of Opus (exact match ${pct0(agreement.overall.exact)}, mean absolute difference ${agreement.overall.mad.toFixed(2)}).`,
    );
    out.push(
      table(
        ['Criterion', 'Exact', 'Within ±1', 'MAD', 'Weighted kappa'],
        CRITERIA.map(c => {
          const a = agreement.perCriterion[c];
          return [c, pct0(a.exact), pct0(a.within1), a.mad.toFixed(2), a.qwk === null ? '–' : a.qwk.toFixed(2)];
        }),
      ),
    );
    out.push(
      `Hallucination flag agreement: ${pct0(agreement.hallucinationAgreement)}. "Any unsupported claim" agreement: ${pct0(agreement.unsupportedClaimFlagAgreement)}.`,
    );
    out.push(
      agreement.disagreements.length
        ? table(
            ['ID', 'Criterion', 'Opus', 'Second'],
            agreement.disagreements.map(d => [d.id, d.criterion, String(d.primary), String(d.second)]),
          )
        : '_None._',
    );
  }

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
    'invented_claims', 'claim_kinds', 'strategy_lead_expected_offered', 'retrieved_case_studies', 'expected_case_studies', 'error',
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
      (grade?.claims ?? []).map(c => c.kind).join('; '),
      grade?.automated_checks && grade.automated_checks.strategy_lead_expected !== undefined
        ? `${grade.automated_checks.strategy_lead_expected}/${grade.automated_checks.strategy_lead_offered}`
        : '',
      [...new Set((record.retrieval?.chunks ?? []).map(c => c.slug))].join('; '),
      (record.expected.case_studies ?? []).join('; '),
      record.error ?? grade?.grader_error ?? grade?.skipped ?? '',
    ].map(csvCell).join(',');
  });
  const csvPath = path.join(dir, 'grades.csv');
  fs.writeFileSync(csvPath, '﻿' + [header.join(','), ...csvRows].join('\n') + '\n');
  console.log(`Wrote ${csvPath}`);
}

if (require.main === module) {
  try {
    writeReport(resolveResultsDir());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
