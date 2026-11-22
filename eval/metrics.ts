/**
 * Single source of truth for run metrics. Reports, aggregates and baseline
 * comparisons all go through computeRunMetrics so a metric means the same
 * thing everywhere.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CLAIM_KINDS,
  CRITERIA,
  RESULTS_DIR,
  readJson,
  runAutomatedChecks,
  type ClaimKind,
  type Criterion,
  type GradeRecord,
  type GradesFile,
  type RunFile,
} from './lib';
import { isDisputed } from './labels';

export interface Summary {
  n: number;
  mean: number | null;
  sd: number | null;
  min: number | null;
  max: number | null;
}

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;

/** Mean, sample SD (n-1; null when n < 2), min and max. Null entries are ignored. */
export function summarize(values: Array<number | null>): Summary {
  const v = values.filter((x): x is number => x !== null && x !== undefined && !Number.isNaN(x));
  if (v.length === 0) return { n: 0, mean: null, sd: null, min: null, max: null };
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = v.length < 2 ? null : Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
  return {
    n: v.length,
    mean,
    sd: sd === null ? null : round(sd, 4),
    min: Math.min(...v),
    max: Math.max(...v),
  };
}

/** Standard median (mean of the two middle values for even counts). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface RunMetrics {
  dir: string;
  run_id: string;
  harness_version: number;
  regrade_of: string | null;
  models: {
    route: string | null;
    generation: string | null;
    embedding: string | null;
    judge: string;
    judge_route: string | null;
  };
  total: number;
  graded: number;
  criteria: Record<Criterion, number | null>;
  hallucinations: number;
  responses_with_unsupported_claims: number;
  unsupported_claims_total: number;
  claims_by_kind: Record<ClaimKind, number> | null;
  responses_by_kind: Record<ClaimKind, number> | null;
  recall: { hit: number; total: number; pct: number | null };
  recall_corrected: { hit: number; total: number; pct: number | null; excluded: number };
  shown_recall: { hit: number; total: number; pct: number | null };
  teasers: { zero_expected_mean: number | null; zero_expected_n: number; all_mean: number | null };
  prompt_cache: { hits: number; of: number };
  latency_s: { median: number | null; min: number | null; max: number | null };
  metrics_not_in_context: number;
  strict_fallback: { pass: number; of: number };
  strategy_lead: { expected: number; offered_when_expected: number };
}

const zeroKinds = () => Object.fromEntries(CLAIM_KINDS.map(k => [k, 0])) as Record<ClaimKind, number>;

export function computeRunMetrics(dir: string): RunMetrics {
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  const gradesPath = path.join(dir, 'grades.json');
  const gradesFile: GradesFile | null = fs.existsSync(gradesPath) ? readJson<GradesFile>(gradesPath) : null;
  const gradeById = new Map<string, GradeRecord>((gradesFile?.grades ?? []).map(g => [g.id, g]));
  const rows = run.records.map(record => ({ record, grade: gradeById.get(record.id) }));
  const graded = rows.filter(r => r.grade?.scores);

  const criteria = Object.fromEntries(
    CRITERIA.map(c => [c, graded.length ? graded.reduce((s, r) => s + r.grade!.scores![c].score, 0) / graded.length : null]),
  ) as Record<Criterion, number | null>;

  // Claims: invented_claims is present for every harness version; `claims` only for the new one
  const responsesWithClaims = graded.filter(r => r.grade!.invented_claims.length > 0).length;
  const allClassified = graded.length > 0 && graded.every(r => Array.isArray(r.grade!.claims));
  let claimsByKind: Record<ClaimKind, number> | null = null;
  let responsesByKind: Record<ClaimKind, number> | null = null;
  if (allClassified) {
    claimsByKind = zeroKinds();
    responsesByKind = zeroKinds();
    for (const r of graded) {
      const kinds = new Set<ClaimKind>();
      for (const c of r.grade!.claims!) {
        claimsByKind[c.kind] += 1;
        kinds.add(c.kind);
      }
      for (const k of kinds) responsesByKind[k] += 1;
    }
  }

  // Recall: same rule as the original report
  let hit = 0;
  let total = 0;
  for (const { record } of rows) {
    if (!record.retrieval || record.expected.case_studies.length === 0) continue;
    const retrieved = new Set(record.retrieval.chunks.map(c => c.slug));
    total += record.expected.case_studies.length;
    hit += record.expected.case_studies.filter(s => retrieved.has(s)).length;
  }

  // Corrected recall (D-301): same rule, minus disputed label pairs
  let cHit = 0;
  let cTotal = 0;
  let excluded = 0;
  // Shown recall (D-302): expected study presented as a CaseStudyTeaser
  let sHit = 0;
  let sTotal = 0;
  const teaserCounts: Array<{ n: number; zeroExpected: boolean }> = [];
  let cacheHits = 0;
  let cacheOf = 0;
  for (const { record } of rows) {
    const teaserSlugs = (record.response?.layoutPlan?.layout ?? [])
      .filter(item => item.component === 'CaseStudyTeaser')
      .map(item => (item.props as { slug?: string } | undefined)?.slug);
    if (record.status === 'ok') {
      teaserCounts.push({ n: teaserSlugs.length, zeroExpected: record.expected.case_studies.length === 0 });
      if (record.usage) {
        cacheOf += 1;
        if ((record.usage.cache_read_input_tokens ?? 0) > 0) cacheHits += 1;
      }
    }
    if (!record.retrieval || record.expected.case_studies.length === 0) continue;
    const retrieved = new Set(record.retrieval.chunks.map(c => c.slug));
    for (const slug of record.expected.case_studies) {
      sTotal += 1;
      if (teaserSlugs.includes(slug)) sHit += 1;
      if (isDisputed(record.id, slug)) {
        excluded += 1;
        continue;
      }
      cTotal += 1;
      if (retrieved.has(slug)) cHit += 1;
    }
  }
  const zeroTeasers = teaserCounts.filter(t => t.zeroExpected);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const latencies = rows
    .filter(r => r.record.status === 'ok' && r.record.latency_ms !== null)
    .map(r => r.record.latency_ms! / 1000);
  const med = median(latencies);

  // Recomputed with the current normalisation / config, independent of stored grades
  let metricsNotInContext = 0;
  let slExpected = 0;
  let slOffered = 0;
  for (const { record } of rows) {
    const checks = runAutomatedChecks(record);
    metricsNotInContext += checks.metrics_not_in_context.length;
    if (checks.strategy_lead_expected) {
      slExpected += 1;
      if (checks.strategy_lead_offered) slOffered += 1;
    }
  }

  const fallbackRows = graded.filter(
    r => r.record.expected.fallback_expected || r.grade!.context_relevant === false || r.record.type === 'invention_bait',
  );

  return {
    dir,
    run_id: path.basename(dir),
    harness_version: gradesFile?.harness_version ?? 1,
    regrade_of: run.regrade_of ?? null,
    models: {
      route: run.models?.route ?? null,
      generation: run.models?.generation ?? null,
      embedding: run.models?.embedding ?? null,
      judge: gradesFile?.grader_model ?? 'not graded',
      judge_route: gradesFile?.grader_route ?? null,
    },
    total: rows.length,
    graded: graded.length,
    criteria,
    hallucinations: graded.filter(r => r.grade!.hallucination).length,
    responses_with_unsupported_claims: responsesWithClaims,
    unsupported_claims_total: graded.reduce((s, r) => s + r.grade!.invented_claims.length, 0),
    claims_by_kind: claimsByKind,
    responses_by_kind: responsesByKind,
    recall: { hit, total, pct: total ? (100 * hit) / total : null },
    recall_corrected: { hit: cHit, total: cTotal, pct: cTotal ? (100 * cHit) / cTotal : null, excluded },
    shown_recall: { hit: sHit, total: sTotal, pct: sTotal ? (100 * sHit) / sTotal : null },
    teasers: {
      zero_expected_mean: mean(zeroTeasers.map(t => t.n)),
      zero_expected_n: zeroTeasers.length,
      all_mean: mean(teaserCounts.map(t => t.n)),
    },
    prompt_cache: { hits: cacheHits, of: cacheOf },
    latency_s: {
      median: med === null ? null : round(med, 1),
      min: latencies.length ? round(Math.min(...latencies), 1) : null,
      max: latencies.length ? round(Math.max(...latencies), 1) : null,
    },
    metrics_not_in_context: metricsNotInContext,
    strict_fallback: { pass: fallbackRows.filter(r => r.grade!.would_strict_pass_fallback).length, of: fallbackRows.length },
    strategy_lead: { expected: slExpected, offered_when_expected: slOffered },
  };
}

export interface MetricDef {
  key: string;
  label: string;
  better: 'higher' | 'lower' | 'none';
  unit: 'score' | 'count' | 'pct' | 'seconds';
  get: (m: RunMetrics) => number | null;
  newHarnessOnly?: boolean;
}

const criterionDef = (c: Criterion): MetricDef => ({
  key: c,
  label: c,
  better: 'higher',
  unit: 'score',
  get: m => m.criteria[c],
});

const kindDef = (kind: ClaimKind): MetricDef => ({
  key: `claims_${kind}`,
  label: `claims: ${kind}`,
  better: 'lower',
  unit: 'count',
  newHarnessOnly: true,
  get: m => (m.claims_by_kind ? m.claims_by_kind[kind] : null),
});

export const METRIC_DEFS: MetricDef[] = [
  ...CRITERIA.map(criterionDef),
  { key: 'hallucinations', label: 'hallucinations', better: 'lower', unit: 'count', get: m => m.hallucinations },
  {
    key: 'responses_with_unsupported_claims',
    label: 'responses_with_unsupported_claims',
    better: 'lower',
    unit: 'count',
    get: m => m.responses_with_unsupported_claims,
  },
  {
    key: 'unsupported_claims_total',
    label: 'unsupported_claims_total',
    better: 'lower',
    unit: 'count',
    get: m => m.unsupported_claims_total,
  },
  ...CLAIM_KINDS.map(kindDef),
  { key: 'recall_pct', label: 'recall_pct', better: 'higher', unit: 'pct', get: m => m.recall.pct },
  { key: 'recall_pct_corrected', label: 'recall_pct_corrected', better: 'higher', unit: 'pct', get: m => m.recall_corrected.pct },
  { key: 'shown_recall_pct', label: 'shown_recall_pct', better: 'higher', unit: 'pct', get: m => m.shown_recall.pct },
  {
    key: 'teasers_zero_expected_mean',
    label: 'teasers_zero_expected_mean',
    better: 'lower',
    unit: 'score',
    get: m => (m.teasers.zero_expected_n ? m.teasers.zero_expected_mean : null),
  },
  {
    key: 'prompt_cache_hits',
    label: 'prompt_cache_hits',
    better: 'higher',
    unit: 'count',
    get: m => (m.prompt_cache.of ? m.prompt_cache.hits : null),
  },
  { key: 'latency_median_s', label: 'latency_median_s', better: 'lower', unit: 'seconds', get: m => m.latency_s.median },
  {
    key: 'metrics_not_in_context',
    label: 'metrics_not_in_context',
    better: 'lower',
    unit: 'count',
    get: m => m.metrics_not_in_context,
  },
  { key: 'strict_fallback_pass', label: 'strict_fallback_pass', better: 'higher', unit: 'count', get: m => m.strict_fallback.pass },
  {
    key: 'strategy_lead_offered_when_expected',
    label: 'strategy_lead_offered_when_expected',
    better: 'higher',
    unit: 'count',
    get: m => m.strategy_lead.offered_when_expected,
  },
];

/** Most recent dir in RESULTS_DIR whose responses.json has regrade_of === baselineId, or null. */
export function findRegradeDir(baselineId: string): string | null {
  if (!fs.existsSync(RESULTS_DIR)) return null;
  const matches = fs
    .readdirSync(RESULTS_DIR)
    .filter(d => fs.existsSync(path.join(RESULTS_DIR, d, 'responses.json')))
    .filter(d => {
      try {
        return readJson<RunFile>(path.join(RESULTS_DIR, d, 'responses.json')).regrade_of === baselineId;
      } catch {
        return false;
      }
    })
    .sort();
  return matches.length ? path.join(RESULTS_DIR, matches[matches.length - 1]) : null;
}

export function formatValue(def: MetricDef, v: number | null): string {
  if (v === null) return 'n/a';
  switch (def.unit) {
    case 'score':
      return v.toFixed(2);
    case 'count':
      return String(Math.round(v));
    case 'pct':
      return `${v.toFixed(0)}%`;
    case 'seconds':
      return `${v.toFixed(1)} s`;
  }
}

/**
 * Signed difference current - base. When both run metrics are given, new-harness-only
 * metrics show n/a unless both runs were graded with harness v2 or later.
 */
export function formatDelta(
  def: MetricDef,
  current: number | null,
  base: number | null,
  baseMetrics?: RunMetrics,
  thisMetrics?: RunMetrics,
): string {
  if (current === null || base === null) return 'n/a';
  if (def.newHarnessOnly && baseMetrics && thisMetrics && (baseMetrics.harness_version < 2 || thisMetrics.harness_version < 2)) {
    return 'n/a';
  }
  const d = current - base;
  const sign = d > 0 ? '+' : d < 0 ? '-' : d === 0 && def.unit === 'score' ? '+' : '';
  const abs = Math.abs(d);
  switch (def.unit) {
    case 'score':
      return `${sign}${abs.toFixed(2)}`;
    case 'count':
      return `${sign}${Math.round(abs)}`;
    case 'pct':
      return `${sign}${abs.toFixed(0)} pp`;
    case 'seconds':
      return `${sign}${abs.toFixed(1)} s`;
  }
}
