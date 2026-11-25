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
import { CONCIERGE_CONFIG, type StrategyLeadTrigger } from '../src/lib/concierge-config';
import { isDisputed } from './labels';
import { suppressionReason } from '../src/lib/instant-teasers';
import type { ProdTimingFile } from './prod-timing-types';

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

/** Nearest-rank percentile (p in 0-100); null for an empty list. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  return s[Math.min(rank, s.length) - 1];
}

export interface TimingStats {
  n: number;
  median: number | null;
  p90: number | null;
  max: number | null;
}

export interface SpeedMetrics {
  teasers: TimingStats; // non-suppressed ok records only
  hero_first: TimingStats;
  hero_done: TimingStats;
  complete: TimingStats;
  suppressed_n: number;
}

export interface SuppressionStats {
  floor: number;
  fallback: { suppressed: number; of: number };
  bait: { suppressed: number; of: number };
  direct_false: { suppressed: number; of: number };
  missed_fallback_ids: string[];
  false_direct_ids: string[];
}

export interface InstantMetrics {
  flash: { shown: number; flashed: number; flash_rate: number | null };
  suppression: SuppressionStats[];
  actual_vs_recomputed_mismatches: number;
}

/** D-304 / D-513 no-regression limits. Phase 4 run values plus two noise SDs (STATE.md). */
export const PHASE5_NO_REGRESSION = {
  // D-513: Phase 4 run 2026-11-22T22-48-20; D-307 caps responses with exactly 4 teasers; grounded/voice are Phase 4 means minus 2 SD (0.16, 0.04)
  run: '2026-11-22T22-48-20',
  goalAsResultMax: 2,
  inventionBaitMax: 0,
  capabilityNotShownMax: 0,
  unsupportedResponsesMax: 6,
  recallHitMin: 47,
  zeroExpectedTeasersMax: 1.70,
  exactlyFourMax: 3,
  groundedMin: 4.46,
  voiceMin: 4.28,
} as const;

/** D-511 speed gates. */
export const PHASE5_SPEED = { teasersMedianMaxMs: 1500, heroFirstMedianMaxMs: 4000 } as const;

export interface GateRow {
  gate: string;
  value: number | null;
  limit: string;
  pass: boolean | null;
}

export function phase5Gates(m: RunMetrics): GateRow[] {
  const R = PHASE5_NO_REGRESSION;
  const le = (gate: string, value: number | null, max: number): GateRow => ({
    gate,
    value,
    limit: `<= ${max}`,
    pass: value === null ? null : value <= max,
  });
  const ge = (gate: string, value: number | null, min: number): GateRow => ({
    gate,
    value,
    limit: `>= ${min}`,
    pass: value === null ? null : value >= min,
  });
  return [
    le('PERF-01 median t_teasers_ms (non-suppressed)', m.speed?.teasers.median ?? null, PHASE5_SPEED.teasersMedianMaxMs),
    le('PERF-02 median t_hero_first_ms', m.speed?.hero_first.median ?? null, PHASE5_SPEED.heroFirstMedianMaxMs),
    le('D-513 goal_as_result claims', m.claims_by_kind ? m.claims_by_kind.goal_as_result : null, R.goalAsResultMax),
    le('D-513 invention_bait_presupposed', m.invention_bait_presupposed, R.inventionBaitMax),
    le('D-513 capability_not_shown claims', m.claims_by_kind ? m.claims_by_kind.capability_not_shown : null, R.capabilityNotShownMax),
    le('D-513 responses_with_unsupported_claims', m.graded ? m.responses_with_unsupported_claims : null, R.unsupportedResponsesMax),
    ge('D-513 recall hit (frozen set)', m.recall.total ? m.recall.hit : null, R.recallHitMin),
    le('D-513 teasers_zero_expected_mean', m.teasers.zero_expected_n ? m.teasers.zero_expected_mean : null, R.zeroExpectedTeasersMax),
    le('D-307 responses with exactly 4 CaseStudyTeasers', m.teasers.exactly_four, R.exactlyFourMax),
    ge('D-513 grounded', m.criteria.grounded, R.groundedMin),
    ge('D-513 voice', m.criteria.voice, R.voiceMin),
  ];
}

/**
 * Phase 6 ready bar (D-604 proportional limits, D-605 speed on warm cache-miss
 * production timings). Unsupported-claim share is a proportion because proof runs
 * have 75 queries against the 50-query baseline.
 */
export const PROOF_BAR = {
  recallPctMin: 90,
  unsupportedShareMax: 0.10,
  goalAsResultMax: 0,
  capabilityNotShownMax: 0,
  inventionBaitMax: 0,
  voiceMin: 4.5,
  teasersMedianMaxMs: 1500,
  heroFirstMedianMaxMs: 4000,
} as const;

export function phase6Gates(m: RunMetrics): GateRow[] {
  const B = PROOF_BAR;
  const eq0 = (gate: string, value: number | null): GateRow => ({ gate, value, limit: '= 0', pass: value === null ? null : value === 0 });
  const unsupportedMax = Math.ceil(B.unsupportedShareMax * m.graded) - 1;
  return [
    {
      gate: 'all queries answered and graded',
      value: m.graded,
      limit: `= ${m.total}`,
      pass: m.total > 0 && m.graded === m.total && m.errors === 0,
    },
    {
      gate: 'recall >= 90% (frozen labels)',
      value: m.recall.pct,
      limit: `>= ${B.recallPctMin}%`,
      pass: m.recall.pct === null ? null : m.recall.pct >= B.recallPctMin,
    },
    eq0('goals stated as results = 0', m.claims_by_kind ? m.claims_by_kind.goal_as_result : null),
    eq0('invention-bait presupposed = 0', m.invention_bait_presupposed),
    eq0('capabilities not shown = 0', m.claims_by_kind ? m.claims_by_kind.capability_not_shown : null),
    {
      gate: 'responses with any unsupported claim < 10%',
      value: m.graded ? m.responses_with_unsupported_claims : null,
      limit: `< 10% (<= ${unsupportedMax} of ${m.graded})`,
      pass: m.graded ? m.responses_with_unsupported_claims < B.unsupportedShareMax * m.graded : null,
    },
    {
      gate: 'voice >= 4.5',
      value: m.criteria.voice,
      limit: `>= ${B.voiceMin}`,
      pass: m.criteria.voice === null ? null : round(m.criteria.voice, 2) >= B.voiceMin,
    },
  ];
}

export interface TimingSummary {
  n: number;
  warm_n: number;
  cold_n: number;
  cache_hits: number;
  missing_perf: number;
  teasers_warm_median: number | null;
  teasers_warm_n: number;
  hero_first_warm_median: number | null;
  teasers_cold_median: number | null;
  hero_first_cold_median: number | null;
  p90_teasers_warm: number | null;
  p90_hero_first_warm: number | null;
}

/** Warm = perf present, instance_req > 1, not the warm-up request, no error. */
export function summarizeTiming(f: ProdTimingFile): TimingSummary {
  const recs = f.records.filter(r => !r.warmup);
  const clean = recs.filter(r => !r.error);
  const missing = clean.filter(r => !r.perf).length;
  const isWarm = (r: ProdTimingFile['records'][number]) => !!r.perf && (r.perf.instance_req ?? 0) > 1;
  const warm = clean.filter(isWarm);
  const cold = clean.filter(r => !!r.perf && !isWarm(r));
  const hits = clean.filter(r => r.perf && (r.perf.rag_cache_hit === 1 || r.perf.orch_cached === true)).length;
  const num = (xs: Array<number | null>) => xs.filter((x): x is number => typeof x === 'number');
  const tw = num(warm.filter(r => r.t_teasers_ms != null).map(r => r.t_teasers_ms));
  const hw = num(warm.map(r => r.t_hero_first_ms));
  return {
    n: recs.length,
    warm_n: warm.length,
    cold_n: cold.length,
    cache_hits: hits,
    missing_perf: missing,
    teasers_warm_median: median(tw),
    teasers_warm_n: tw.length,
    hero_first_warm_median: median(hw),
    teasers_cold_median: median(num(cold.filter(r => r.t_teasers_ms != null).map(r => r.t_teasers_ms))),
    hero_first_cold_median: median(num(cold.map(r => r.t_hero_first_ms))),
    p90_teasers_warm: percentile(tw, 90),
    p90_hero_first_warm: percentile(hw, 90),
  };
}

export function timingGates(s: TimingSummary): GateRow[] {
  const le = (gate: string, value: number | null, max: number): GateRow => ({
    gate,
    value,
    limit: `<= ${max} ms`,
    pass: value === null ? null : value <= max,
  });
  return [
    {
      gate: 'cache-safe batch (0 cache hits, perf flags on every request)',
      value: s.cache_hits + s.missing_perf,
      limit: '= 0',
      pass: s.n === 0 ? null : s.cache_hits === 0 && s.missing_perf === 0,
    },
    le('median t_teasers (warm, non-suppressed) <= 1500 ms', s.teasers_warm_median, PROOF_BAR.teasersMedianMaxMs),
    le('median t_hero_first (warm) <= 4000 ms', s.hero_first_warm_median, PROOF_BAR.heroFirstMedianMaxMs),
  ];
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
  errors: number;
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
  teasers: { zero_expected_mean: number | null; zero_expected_n: number; all_mean: number | null; exactly_four: number };
  speed: SpeedMetrics | null;
  instant: InstantMetrics | null;
  prompt_cache: { hits: number; of: number };
  latency_s: { median: number | null; min: number | null; max: number | null };
  metrics_not_in_context: number;
  strict_fallback: { pass: number; of: number };
  strategy_lead: { expected: number; offered_when_expected: number; unprompted: number };
  strategy_lead_by_trigger: Record<StrategyLeadTrigger, { expected: number; offered: number }>;
  narrative: { in_range: number; of: number; median: number | null };
  teaser_tags_not_from_db: number;
  video: { queries: number; with_video_available: number; missing: number };
  pricing_timeline_figures: number;
  invention_bait_presupposed: number | null;
}

const TRIGGERS: StrategyLeadTrigger[] = ['no_context', 'fallback', 'pricing', 'timeline', 'invention_bait'];

const zeroKinds = () => Object.fromEntries(CLAIM_KINDS.map(k => [k, 0])) as Record<ClaimKind, number>;

function timingStats(values: number[]): TimingStats {
  return { n: values.length, median: median(values), p90: percentile(values, 90), max: values.length ? Math.max(...values) : null };
}

/** Per-query arrival times (D-510). Null for runs without any t_complete_ms (old or JSON-route runs). */
function computeSpeed(run: RunFile): SpeedMetrics | null {
  const ok = run.records.filter(r => r.status === 'ok');
  if (!ok.some(r => r.t_complete_ms != null)) return null;
  const num = (xs: Array<number | null | undefined>) => xs.filter((x): x is number => typeof x === 'number');
  return {
    teasers: timingStats(num(ok.filter(r => !r.suppressed).map(r => r.t_teasers_ms))),
    hero_first: timingStats(num(ok.map(r => r.t_hero_first_ms))),
    hero_done: timingStats(num(ok.map(r => r.t_hero_done_ms))),
    complete: timingStats(num(ok.map(r => r.t_complete_ms))),
    suppressed_n: ok.filter(r => r.suppressed).length,
  };
}

/** Flash rate and D-504 suppression decisions recomputed from stored retrieval. Null without stream records. */
function computeInstant(run: RunFile): InstantMetrics | null {
  const stream = run.records.filter(r => r.status === 'ok' && r.route === 'stream');
  if (stream.length === 0) return null;

  let shown = 0;
  let flashed = 0;
  for (const r of stream) {
    const slugs = r.instant_teaser_slugs ?? [];
    if (slugs.length === 0) continue;
    const final = new Set(
      (r.response?.layoutPlan?.layout ?? [])
        .filter(i => i.component === 'CaseStudyTeaser')
        .map(i => (i.props as { slug?: string } | undefined)?.slug),
    );
    shown += slugs.length;
    flashed += slugs.filter(s => !final.has(s)).length;
  }

  const withRetrieval = stream.filter(r => r.retrieval);
  const decide = (r: RunFile['records'][number], floor: number) =>
    suppressionReason(r.query, r.retrieval!.chunks, { floor }) !== null;
  const floors = [CONCIERGE_CONFIG.instantTeasers.semanticFloor, 0.45];
  const suppression = floors.map<SuppressionStats>(floor => {
    const fallback = withRetrieval.filter(r => r.expected.fallback_expected);
    const bait = withRetrieval.filter(r => r.type === 'invention_bait');
    const direct = withRetrieval.filter(r => !r.expected.fallback_expected);
    const missed = fallback.filter(r => !decide(r, floor));
    const falseDirect = direct.filter(r => decide(r, floor));
    return {
      floor,
      fallback: { suppressed: fallback.length - missed.length, of: fallback.length },
      bait: { suppressed: bait.filter(r => decide(r, floor)).length, of: bait.length },
      direct_false: { suppressed: falseDirect.length, of: direct.length },
      missed_fallback_ids: missed.map(r => r.id).sort(),
      false_direct_ids: falseDirect.map(r => r.id).sort(),
    };
  });

  const mismatches = withRetrieval.filter(r => (r.suppressed != null) !== decide(r, floors[0])).length;
  return {
    flash: { shown, flashed, flash_rate: shown ? flashed / shown : null },
    suppression,
    actual_vs_recomputed_mismatches: mismatches,
  };
}

export function computeRunMetrics(dir: string, opts: { filter?: (r: RunFile['records'][number]) => boolean } = {}): RunMetrics {
  const run = readJson<RunFile>(path.join(dir, 'responses.json'));
  if (opts.filter) run.records = run.records.filter(opts.filter);
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
  let exactlyFour = 0;
  for (const { record } of rows) {
    const teaserSlugs = (record.response?.layoutPlan?.layout ?? [])
      .filter(item => item.component === 'CaseStudyTeaser')
      .map(item => (item.props as { slug?: string } | undefined)?.slug);
    if (record.status === 'ok') {
      if (teaserSlugs.length === 4) exactlyFour += 1;
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
  let slUnprompted = 0;
  const byTrigger = Object.fromEntries(TRIGGERS.map(t => [t, { expected: 0, offered: 0 }])) as Record<
    StrategyLeadTrigger,
    { expected: number; offered: number }
  >;
  const sentenceCounts: number[] = [];
  let narrativeInRange = 0;
  let tagsNotFromDb = 0;
  let figures = 0;
  const video = { queries: 0, with_video_available: 0, missing: 0 };
  for (const { record } of rows) {
    if (record.status !== 'ok') continue;
    const checks = runAutomatedChecks(record);
    metricsNotInContext += checks.metrics_not_in_context.length;
    if (checks.strategy_lead_expected) {
      slExpected += 1;
      if (checks.strategy_lead_offered) slOffered += 1;
    } else if (checks.strategy_lead_offered) {
      slUnprompted += 1;
    }
    for (const t of checks.strategy_lead_triggers ?? []) {
      byTrigger[t].expected += 1;
      if (checks.strategy_lead_offered) byTrigger[t].offered += 1;
    }
    if (checks.narrative_sentences != null) {
      sentenceCounts.push(checks.narrative_sentences);
      if (checks.narrative_in_range) narrativeInRange += 1;
    }
    tagsNotFromDb += checks.teaser_tags_not_from_db.length;
    figures += checks.pricing_timeline_figures.length;
    if (checks.video_query) {
      video.queries += 1;
      if ((record.retrieval?.chunks ?? []).some(c => c.document_type === 'case_study' && c.vimeo_url)) {
        video.with_video_available += 1;
      }
      if (checks.video_query_missing_video) video.missing += 1;
    }
  }
  const baitGrades = graded.filter(r => r.record.type === 'invention_bait');
  const baitPresupposed = baitGrades.some(r => r.grade!.presupposes_asserted_work == null)
    ? null
    : baitGrades.filter(r => r.grade!.presupposes_asserted_work === true).length;

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
    errors: rows.filter(r => r.record.status === 'error').length,
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
      exactly_four: exactlyFour,
    },
    speed: computeSpeed(run),
    instant: computeInstant(run),
    prompt_cache: { hits: cacheHits, of: cacheOf },
    latency_s: {
      median: med === null ? null : round(med, 1),
      min: latencies.length ? round(Math.min(...latencies), 1) : null,
      max: latencies.length ? round(Math.max(...latencies), 1) : null,
    },
    metrics_not_in_context: metricsNotInContext,
    strict_fallback: { pass: fallbackRows.filter(r => r.grade!.would_strict_pass_fallback).length, of: fallbackRows.length },
    strategy_lead: { expected: slExpected, offered_when_expected: slOffered, unprompted: slUnprompted },
    strategy_lead_by_trigger: byTrigger,
    narrative: {
      in_range: narrativeInRange,
      of: sentenceCounts.length,
      median: sentenceCounts.length ? median(sentenceCounts) : null,
    },
    teaser_tags_not_from_db: tagsNotFromDb,
    video,
    pricing_timeline_figures: figures,
    invention_bait_presupposed: baitPresupposed,
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

const speedDef = (key: string, field: 'teasers' | 'hero_first' | 'hero_done'): MetricDef => ({
  key,
  label: key,
  better: 'lower',
  unit: 'seconds',
  get: m => {
    const v = m.speed?.[field].median;
    return v == null ? null : round(v / 1000, 1);
  },
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
  speedDef('t_teasers_median_s', 'teasers'),
  speedDef('t_hero_first_median_s', 'hero_first'),
  speedDef('t_hero_done_median_s', 'hero_done'),
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
  { key: 'strategy_lead_expected', label: 'strategy_lead_expected', better: 'none', unit: 'count', get: m => m.strategy_lead.expected },
  {
    key: 'strategy_lead_offered_unprompted',
    label: 'strategy_lead_offered_unprompted',
    better: 'lower',
    unit: 'count',
    get: m => m.strategy_lead.unprompted,
  },
  {
    key: 'narrative_in_range',
    label: `narrative_in_range (${CONCIERGE_CONFIG.narrative.minSentences}-${CONCIERGE_CONFIG.narrative.maxSentences} sentences)`,
    better: 'higher',
    unit: 'count',
    get: m => (m.narrative.of ? m.narrative.in_range : null),
  },
  { key: 'narrative_sentences_median', label: 'narrative_sentences_median', better: 'none', unit: 'score', get: m => m.narrative.median },
  { key: 'teaser_tags_not_from_db', label: 'teaser_tags_not_from_db', better: 'lower', unit: 'count', get: m => m.teaser_tags_not_from_db },
  { key: 'video_queries_missing_video', label: 'video_queries_missing_video', better: 'lower', unit: 'count', get: m => m.video.missing },
  { key: 'pricing_timeline_figures', label: 'pricing_timeline_figures', better: 'lower', unit: 'count', get: m => m.pricing_timeline_figures },
  {
    key: 'invention_bait_presupposed',
    label: 'invention_bait_presupposed',
    better: 'lower',
    unit: 'count',
    newHarnessOnly: true,
    get: m => m.invention_bait_presupposed,
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
