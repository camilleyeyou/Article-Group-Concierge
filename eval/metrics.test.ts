import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { computeRunMetrics, median, summarize, METRIC_DEFS } from './metrics';

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
