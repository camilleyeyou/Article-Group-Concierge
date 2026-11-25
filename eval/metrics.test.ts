import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { computeRunMetrics, median, summarize, METRIC_DEFS, percentile, phase5Gates, formatDelta, type RunMetrics } from './metrics';

function record(id: string, expectedSlugs: string[], retrievedSlugs: string[], latency = 10000) {
  return {
    id,
    persona_id: 'p1',
    type: 'well_formed',
    query: `query ${id}`,
    expected: { components: [], fallback_expected: false, case_studies: expectedSlugs, site_only_work: [], notes: '' },
    status: 'ok',
    http_status: 200,
    latency_ms: latency,
    error: null,
    response: null,
    raw_response: null,
    orchestrator_error: null,
    retrieval: {
      chunks: retrievedSlugs.map(slug => ({ slug, document_title: slug, content: 'x' })),
      visualAssets: [],
      relatedMetrics: [],
    },
  };
}

function score(n: number) {
  return { score: n, reason: 'r' };
}

function grade(id: string, grounded: number, extra: Record<string, unknown>) {
  return {
    id,
    grader_model: 'claude-opus-5-5',
    graded_at: '2026-01-01T00:00:00Z',
    skipped: null,
    grader_error: null,
    scores: { grounded: score(grounded), components: score(5), fallback: score(5), cta: score(5), voice: score(5) },
    invented_claims: [],
    context_relevant: true,
    would_strict_pass_fallback: null,
    hallucination: grounded <= 2,
    automated_checks: null,
    ...extra,
  };
}

function fixture(grades: unknown[], harness?: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-metrics-'));
  fs.writeFileSync(
    path.join(dir, 'responses.json'),
    JSON.stringify({
      started_at: 'a',
      finished_at: 'b',
      base_url: 'http://x',
      git_commit: null,
      query_count: 2,
      records: [record('A', ['a', 'b'], ['a', 'c'], 12000), record('B', [], [], 20000)],
    }),
  );
  fs.writeFileSync(
    path.join(dir, 'grades.json'),
    JSON.stringify({ grader_model: 'claude-opus-5-5', ...(harness ? { harness_version: harness } : {}), grades }),
  );
  return dir;
}

test('summarize computes mean and sample SD', () => {
  const s = summarize([4, 5]);
  assert.equal(s.n, 2);
  assert.equal(s.mean, 4.5);
  assert.equal(s.sd, 0.7071);
  assert.equal(s.min, 4);
  assert.equal(s.max, 5);
});

test('summarize handles single, empty and null values', () => {
  assert.deepEqual(summarize([3]), { n: 1, mean: 3, sd: null, min: 3, max: 3 });
  assert.deepEqual(summarize([]), { n: 0, mean: null, sd: null, min: null, max: null });
  assert.deepEqual(summarize([null, 3, null]), { n: 1, mean: 3, sd: null, min: 3, max: 3 });
});

test('median handles odd and even counts', () => {
  assert.equal(median([9.7, 20.2, 28.9]), 20.2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('computeRunMetrics with new-harness claims', () => {
  const dir = fixture(
    [
      grade('A', 5, {
        invented_claims: ['c1', 'c2'],
        claims: [
          { claim: 'c1', kind: 'goal_as_result' },
          { claim: 'c2', kind: 'other' },
        ],
      }),
      grade('B', 3, { claims: [] }),
    ],
    2,
  );
  const m = computeRunMetrics(dir);
  assert.equal(m.harness_version, 2);
  assert.equal(m.criteria.grounded, 4);
  assert.equal(m.responses_with_unsupported_claims, 1);
  assert.equal(m.unsupported_claims_total, 2);
  assert.equal(m.claims_by_kind?.goal_as_result, 1);
  assert.equal(m.claims_by_kind?.other, 1);
  assert.equal(m.claims_by_kind?.generated_tags, 0);
  assert.equal(m.responses_by_kind?.goal_as_result, 1);
  assert.deepEqual(m.latency_s, { median: 16, min: 12, max: 20 });
});

test('computeRunMetrics with old-harness grades has no kinds', () => {
  const dir = fixture([grade('A', 5, { invented_claims: ['x', 'y'] }), grade('B', 3, {})]);
  const m = computeRunMetrics(dir);
  assert.equal(m.harness_version, 1);
  assert.equal(m.unsupported_claims_total, 2);
  assert.equal(m.responses_with_unsupported_claims, 1);
  assert.equal(m.claims_by_kind, null);
  assert.equal(m.responses_by_kind, null);
});

test('recall counts expected slugs found in retrieval', () => {
  const m = computeRunMetrics(fixture([grade('A', 5, {}), grade('B', 5, {})]));
  assert.deepEqual(m.recall, { hit: 1, total: 2, pct: 50 });
});

test('METRIC_DEFS getters read RunMetrics', () => {
  const m = computeRunMetrics(fixture([grade('A', 5, {}), grade('B', 3, {})]));
  const grounded = METRIC_DEFS.find(d => d.key === 'grounded')!;
  assert.equal(grounded.get(m), 4);
  assert.equal(METRIC_DEFS.find(d => d.key === 'recall_pct')!.get(m), 50);
  assert.equal(METRIC_DEFS.find(d => d.key === 'claims_other')!.get(m), null);
});

test('computeRunMetrics works without grades.json', () => {
  const dir = fixture([]);
  fs.rmSync(path.join(dir, 'grades.json'));
  const m = computeRunMetrics(dir);
  assert.equal(m.graded, 0);
  assert.equal(m.criteria.grounded, null);
});

function phase3Fixture(records: unknown[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-metrics-p3-'));
  fs.writeFileSync(
    path.join(dir, 'responses.json'),
    JSON.stringify({ started_at: 'a', finished_at: 'b', base_url: 'http://x', git_commit: null, query_count: records.length, records }),
  );
  return dir;
}

function withLayout(rec: ReturnType<typeof record>, teaserSlugs: string[], usage?: unknown) {
  return {
    ...rec,
    usage,
    response: {
      layoutPlan: { layout: teaserSlugs.map(slug => ({ component: 'CaseStudyTeaser', props: { slug, title: slug } })) },
    },
  };
}

test('corrected recall, shown recall, teaser padding and cache hits', () => {
  const chorus = 'chorus-alphabet-x-creating-an-eye-opening-asset-visibility-brand';
  const dir = phase3Fixture([
    withLayout(record('p1-q05', [chorus, 'x'], ['x']), [], { cache_read_input_tokens: 5000 }),
    withLayout(record('p1-q03', ['y'], ['y']), ['y'], { cache_read_input_tokens: 0 }),
    withLayout(record('z1', [], []), ['t1', 't2']),
  ]);
  const m = computeRunMetrics(dir);
  assert.equal(m.recall.hit, 2);
  assert.equal(m.recall.total, 3);
  assert.equal(m.recall_corrected.hit, 2);
  assert.equal(m.recall_corrected.total, 2);
  assert.equal(m.recall_corrected.excluded, 1);
  assert.equal(m.shown_recall.hit, 1);
  assert.equal(m.shown_recall.total, 3);
  assert.equal(m.teasers.zero_expected_mean, 2);
  assert.equal(m.teasers.zero_expected_n, 1);
  assert.deepEqual(m.prompt_cache, { hits: 1, of: 2 });
  assert.equal(METRIC_DEFS.find(d => d.key === 'prompt_cache_hits')!.get(m), 1);
});

test('prompt_cache_hits is null when no usage was recorded', () => {
  const m = computeRunMetrics(fixture([grade('A', 5, {}), grade('B', 5, {})]));
  assert.equal(METRIC_DEFS.find(d => d.key === 'prompt_cache_hits')!.get(m), null);
  assert.equal(METRIC_DEFS.find(d => d.key === 'teasers_zero_expected_mean')!.get(m), 0);
  assert.equal(m.recall.pct, 50);
});

test('Phase 4 metrics: triggers, narrative, video, figures, presupposition', () => {
  const rec = (id: string, type: string, query: string, explanation: string, extra: Record<string, unknown> = {}) => ({
    ...record(id, [], ['a']),
    type,
    query,
    response: { explanation, layoutPlan: { layout: [] } },
    ...extra,
  });
  const recs = [
    { ...rec('n1', 'invention_bait', 'did you build the Acme rebrand?', 'One. Two. Our Strategy Lead can help.'), expected: { components: [], fallback_expected: true, case_studies: [], site_only_work: [], notes: '' } },
    rec('n2', 'well_formed', 'how much do you charge?', 'It is $5k. A. B. C. D.'),
    rec('n3', 'well_formed', 'how long does it take?', 'About 6 weeks. Our Strategy Lead can scope it.'),
    {
      ...rec('n4', 'well_formed', 'we need videos', 'Fine. Good.'),
      // option D: the study with a video is presented (teaser) but no VideoPlayer is shown
      response: { explanation: 'Fine. Good.', layoutPlan: { layout: [{ component: 'CaseStudyTeaser', props: { slug: 'a', title: 'a' } }] } },
      retrieval: { chunks: [{ slug: 'a', document_title: 'a', document_type: 'case_study', vimeo_url: 'https://vimeo.com/1', content: 'x' }], visualAssets: [], relatedMetrics: [] },
    },
  ];
  const dir = phase3Fixture(recs);
  const grades = recs.map(r => grade(r.id, 5, { presupposes_asserted_work: r.id === 'n1' ? true : false }));
  fs.writeFileSync(path.join(dir, 'grades.json'), JSON.stringify({ grader_model: 'x', harness_version: 4, grades }));
  const m = computeRunMetrics(dir);
  assert.deepEqual(m.strategy_lead_by_trigger.invention_bait, { expected: 1, offered: 1 });
  assert.deepEqual(m.strategy_lead_by_trigger.fallback, { expected: 1, offered: 1 });
  assert.deepEqual(m.strategy_lead_by_trigger.pricing, { expected: 1, offered: 0 });
  assert.deepEqual(m.strategy_lead_by_trigger.timeline, { expected: 1, offered: 1 });
  assert.equal(m.strategy_lead.unprompted, 0);
  assert.deepEqual(m.narrative, { in_range: 3, of: 4, median: 2.5 });
  assert.equal(m.pricing_timeline_figures, 2);
  assert.deepEqual(m.video, { queries: 1, with_video_available: 1, missing: 1 });
  assert.equal(m.invention_bait_presupposed, 1);
  for (const key of ['narrative_in_range', 'video_queries_missing_video', 'invention_bait_presupposed', 'teaser_tags_not_from_db']) {
    assert.ok(METRIC_DEFS.some(d => d.key === key), key);
  }
});

// ---- Phase 5 speed / instant / gates ----

function streamRecord(id: string, over: Record<string, unknown>, chunkScores: number[] = [0.6]) {
  const base = record(id, [], []);
  return {
    ...base,
    route: 'stream',
    retrieval: {
      chunks: chunkScores.map((sim, i) => ({ slug: `s${i}`, document_type: 'case_study', similarity_score: sim, document_title: 't', content: 'x' })),
      visualAssets: [],
      relatedMetrics: [],
    },
    ...over,
  };
}

function runDir(records: unknown[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-speed-'));
  fs.writeFileSync(
    path.join(dir, 'responses.json'),
    JSON.stringify({ started_at: 'a', finished_at: 'b', base_url: 'x', git_commit: null, query_count: records.length, records }),
  );
  return dir;
}

const teaserLayout = (slugs: string[]) => ({
  layoutPlan: { layout: slugs.map(slug => ({ component: 'CaseStudyTeaser', props: { slug } })) },
});

test('percentile is nearest-rank', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([5], 90), 5);
  assert.equal(percentile([], 90), null);
});

test('speed excludes suppressed and failed records; instant flash and exactly_four', () => {
  const dir = runDir([
    streamRecord('A', { t_teasers_ms: 1000, t_hero_first_ms: 3000, t_hero_done_ms: 3500, t_complete_ms: 9000, instant_teaser_slugs: ['x', 'y'], suppressed: null, response: teaserLayout(['x', 'z', 'a', 'b']) }),
    streamRecord('B', { t_teasers_ms: 2000, t_hero_first_ms: 5000, t_hero_done_ms: 5500, t_complete_ms: 11000, instant_teaser_slugs: ['x'], suppressed: null, response: teaserLayout(['x']) }),
    streamRecord('C', { t_suppressed_ms: 800, t_hero_first_ms: 4000, t_hero_done_ms: 4500, t_complete_ms: 10000, suppressed: 'score_floor', response: teaserLayout([]) }),
    streamRecord('D', { status: 'error', t_teasers_ms: 99999, t_complete_ms: 99999 }),
  ]);
  const m = computeRunMetrics(dir);
  assert.deepEqual(m.speed!.teasers, { n: 2, median: 1500, p90: 2000, max: 2000 });
  assert.equal(m.speed!.suppressed_n, 1);
  assert.equal(m.speed!.hero_first.median, 4000);
  assert.equal(m.speed!.hero_first.n, 3);
  assert.equal(m.speed!.complete.max, 11000);
  assert.deepEqual(m.instant!.flash, { shown: 3, flashed: 1, flash_rate: 1 / 3 });
  assert.equal(m.teasers.exactly_four, 1);
});

test('old runs have null speed and n/a rows', () => {
  const dir = runDir([record('A', [], []), record('B', [], [])]);
  const m = computeRunMetrics(dir);
  assert.equal(m.speed, null);
  assert.equal(m.instant, null);
  for (const key of ['t_teasers_median_s', 't_hero_first_median_s', 't_hero_done_median_s']) {
    const def = METRIC_DEFS.find(d => d.key === key)!;
    assert.equal(def.get(m), null);
    assert.equal(formatDelta(def, def.get(m), 1.2), 'n/a');
  }
});

test('suppression recomputed at both floors with misses and mismatch count', () => {
  const dir = runDir([
    // fallback, top score 0.42: suppressed at 0.45 only
    streamRecord('F1', { expected: { components: [], fallback_expected: true, case_studies: [], site_only_work: [], notes: '' }, suppressed: null, t_complete_ms: 1 }, [0.42]),
    // fallback, top score 0.30: suppressed at both floors
    streamRecord('F2', { expected: { components: [], fallback_expected: true, case_studies: [], site_only_work: [], notes: '' }, suppressed: 'score_floor', t_complete_ms: 1 }, [0.3]),
    // direct, top score 0.43: false-suppressed at 0.45 only
    streamRecord('D1', { suppressed: null, t_complete_ms: 1 }, [0.43]),
  ]);
  const m = computeRunMetrics(dir);
  const [lo, hi] = m.instant!.suppression;
  assert.equal(lo.floor, 0.4);
  assert.equal(hi.floor, 0.45);
  assert.deepEqual(lo.fallback, { suppressed: 1, of: 2 });
  assert.deepEqual(lo.missed_fallback_ids, ['F1']);
  assert.deepEqual(lo.direct_false, { suppressed: 0, of: 1 });
  assert.deepEqual(hi.fallback, { suppressed: 2, of: 2 });
  assert.deepEqual(hi.false_direct_ids, ['D1']);
  assert.equal(m.instant!.actual_vs_recomputed_mismatches, 0);

  const dir2 = runDir([streamRecord('D1', { suppressed: 'score_floor', t_complete_ms: 1 }, [0.9])]);
  assert.equal(computeRunMetrics(dir2).instant!.actual_vs_recomputed_mismatches, 1);
});

function phase4Metrics(): RunMetrics {
  return {
    speed: {
      teasers: { n: 1, median: 1400, p90: 1400, max: 1400 },
      hero_first: { n: 1, median: 3900, p90: 3900, max: 3900 },
      hero_done: { n: 1, median: 4000, p90: 4000, max: 4000 },
      complete: { n: 1, median: 9000, p90: 9000, max: 9000 },
      suppressed_n: 0,
    },
    claims_by_kind: { goal_as_result: 2, capability_not_shown: 0, generated_tags: 0, other: 1 },
    invention_bait_presupposed: 0,
    graded: 50,
    responses_with_unsupported_claims: 6,
    recall: { hit: 47, total: 52, pct: 90 },
    teasers: { zero_expected_mean: 1.7, zero_expected_n: 10, all_mean: 2, exactly_four: 3 },
    criteria: { grounded: 4.5, components: 5, fallback: 5, cta: 5, voice: 4.3 },
  } as unknown as RunMetrics;
}

test('phase5Gates passes at Phase 4 values and fails on each regression', () => {
  const base = phase4Metrics();
  assert.ok(phase5Gates(base).every(g => g.pass === true));
  assert.equal(phase5Gates(base).length, 11);

  const fail = (patch: (m: RunMetrics) => void, gate: string) => {
    const m = phase4Metrics();
    patch(m);
    const row = phase5Gates(m).find(g => g.gate.includes(gate))!;
    assert.equal(row.pass, false, gate);
  };
  fail(m => (m.claims_by_kind!.goal_as_result = 3), 'goal_as_result');
  fail(m => (m.criteria.voice = 4.27), 'voice');
  fail(m => (m.teasers.exactly_four = 4), 'exactly 4');
  fail(m => (m.speed!.teasers.median = 1501), 'PERF-01');
  fail(m => (m.speed!.hero_first.median = 4001), 'PERF-02');
  fail(m => (m.recall.hit = 46), 'recall');

  const m = phase4Metrics();
  m.speed = null;
  assert.equal(phase5Gates(m)[0].pass, null);
});
