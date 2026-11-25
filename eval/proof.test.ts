import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { computeRunMetrics, phase6Gates, summarizeTiming, timingGates } from './metrics';
import type { ProdTimingFile, ProdTimingRecord } from './prod-timing-types';

const HELD = /^p[1-5]-h\d{2}$/;

function rec(id: string, opts: { slugs?: string[]; got?: string[]; status?: string } = {}) {
  const slugs = opts.slugs ?? ['a'];
  return {
    id, persona_id: 'p1', type: 'well_formed', query: `q ${id}`,
    expected: { components: [], fallback_expected: false, case_studies: slugs, site_only_work: [], notes: '' },
    status: opts.status ?? 'ok', http_status: 200, latency_ms: 1000, error: null, response: null, raw_response: null,
    orchestrator_error: null,
    retrieval: { chunks: (opts.got ?? slugs).map(slug => ({ slug, document_title: slug, content: 'x' })), visualAssets: [], relatedMetrics: [] },
  };
}

function gradeRec(id: string, o: { voice?: number; claims?: string[]; bait?: boolean } = {}) {
  const sc = (n: number) => ({ score: n, reason: 'r' });
  const claims = (o.claims ?? []).map(kind => ({ text: 't', kind }));
  return {
    id, grader_model: 'claude-opus-5-5', graded_at: 'x', skipped: null, grader_error: null,
    scores: { grounded: sc(5), components: sc(5), fallback: sc(5), cta: sc(5), voice: sc(o.voice ?? 5) },
    invented_claims: claims.map(c => c.text), claims, context_relevant: true, would_strict_pass_fallback: null,
    hallucination: false, automated_checks: null, presupposes_asserted_work: o.bait === undefined ? false : o.bait,
  };
}

function fixture(records: unknown[], grades: unknown[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'proof-'));
  fs.writeFileSync(path.join(dir, 'responses.json'), JSON.stringify({
    started_at: 'a', finished_at: 'b', base_url: 'x', git_commit: null, query_count: records.length, records,
  }));
  fs.writeFileSync(path.join(dir, 'grades.json'), JSON.stringify({ grader_model: 'claude-opus-5-5', harness_version: 2, grades }));
  return dir;
}

const gate = (rows: ReturnType<typeof phase6Gates>, name: string) => rows.find(r => r.gate === name)!;

/** 75 graded responses, `unsupported` of them carrying one claim. */
function run75(unsupported: number, voice = 5) {
  const ids = Array.from({ length: 75 }, (_, i) => `p1-q${i}`);
  return fixture(
    ids.map(id => rec(id)),
    ids.map((id, i) => gradeRec(id, { voice, claims: i < unsupported ? ['generated_tags'] : [] })),
  );
}

test('filter keeps only held-out records', () => {
  const ids = ['p1-q01', 'p1-h01', 'p2-h02'];
  const dir = fixture(ids.map(id => rec(id)), ids.map(id => gradeRec(id)));
  const m = computeRunMetrics(dir, { filter: r => HELD.test(r.id) });
  assert.equal(m.total, 2);
  assert.equal(m.graded, 2);
  assert.equal(m.recall.total, 2);
  assert.equal(computeRunMetrics(dir).total, 3);
});

test('unsupported-claim share: 7 of 75 passes, 8 fails', () => {
  const ok = gate(phase6Gates(computeRunMetrics(run75(7))), 'responses with any unsupported claim < 10%');
  assert.equal(ok.pass, true);
  assert.equal(ok.limit, '< 10% (<= 7 of 75)');
  assert.equal(gate(phase6Gates(computeRunMetrics(run75(8))), 'responses with any unsupported claim < 10%').pass, false);
});

test('recall bar is 90% over frozen labels', () => {
  const mk = (hits: number) => {
    const ids = Array.from({ length: 75 }, (_, i) => `p1-q${i}`);
    const dir = fixture(ids.map((id, i) => rec(id, { slugs: ['a'], got: i < hits ? ['a'] : [] })), ids.map(id => gradeRec(id)));
    return gate(phase6Gates(computeRunMetrics(dir)), 'recall >= 90% (frozen labels)');
  };
  assert.equal(mk(68).pass, true);
  assert.equal(mk(67).pass, false);
});

test('zero bars: goal_as_result and capability_not_shown', () => {
  const ids = ['x1', 'x2'];
  const dir = fixture(ids.map(id => rec(id)), [gradeRec('x1', { claims: ['goal_as_result'] }), gradeRec('x2')]);
  const g = phase6Gates(computeRunMetrics(dir));
  assert.equal(gate(g, 'goals stated as results = 0').pass, false);
  assert.equal(gate(g, 'capabilities not shown = 0').pass, true);
});

test('invention-bait not graded gives null pass', () => {
  const r = { ...rec('b1'), type: 'invention_bait' };
  const g = { ...gradeRec('b1'), presupposes_asserted_work: null };
  const gates = phase6Gates(computeRunMetrics(fixture([r], [g])));
  assert.equal(gate(gates, 'invention-bait presupposed = 0').pass, null);
});

test('voice boundary 4.50 passes, 4.49 fails', () => {
  assert.equal(gate(phase6Gates(computeRunMetrics(run75(0, 4.5))), 'voice >= 4.5').pass, true);
  assert.equal(gate(phase6Gates(computeRunMetrics(run75(0, 4.49))), 'voice >= 4.5').pass, false);
});

test('error record or ungraded response fails the answered-and-graded row', () => {
  const errDir = fixture([rec('a'), rec('b', { status: 'error' })], [gradeRec('a'), gradeRec('b')]);
  assert.equal(gate(phase6Gates(computeRunMetrics(errDir)), 'all queries answered and graded').pass, false);
  const ungraded = fixture([rec('a'), rec('b')], [gradeRec('a')]);
  assert.equal(gate(phase6Gates(computeRunMetrics(ungraded)), 'all queries answered and graded').pass, false);
  const good = fixture([rec('a')], [gradeRec('a')]);
  assert.equal(gate(phase6Gates(computeRunMetrics(good)), 'all queries answered and graded').pass, true);
});

function trec(id: string, o: Partial<ProdTimingRecord> & { req?: number | null; hit?: boolean } = {}): ProdTimingRecord {
  const { req = 5, hit = false, ...rest } = o;
  return {
    id, type: 'well_formed', warmup: false, t_teasers_ms: 1000, t_suppressed_ms: null, t_hero_first_ms: 3000,
    t_hero_done_ms: 4000, t_complete_ms: 9000, aborted_after_hero: false, http_status: 200,
    perf: { rag_cache_hit: hit ? 1 : 0, embed_cache_hit: 0, orch_cached: false, instance_req: req, instance_age_s: 100 },
    error: null, started_at: 'x', ...rest,
  };
}

function tfile(records: ProdTimingRecord[]): ProdTimingFile {
  return {
    batch: 1, base_url: 'x', git_commit_expected: null,
    runner: { country: null, region: null, city: null, org: null, github_run_id: null },
    started_at: 'a', finished_at: 'b', ids: records.map(r => r.id), records,
  };
}

test('timing: warm/cold split, warm-up and suppressed excluded, cold never gates', () => {
  const s = summarizeTiming(tfile([
    trec('w0', { warmup: true, req: 1, t_teasers_ms: 99999 }),
    trec('c1', { req: 1, t_teasers_ms: 6000, t_hero_first_ms: 20000 }),
    trec('a', { t_teasers_ms: 1000 }),
    trec('b', { t_teasers_ms: 1400 }),
    trec('c', { t_teasers_ms: 1800 }),
    trec('sup', { t_teasers_ms: null, t_suppressed_ms: 300 }),
  ]));
  assert.equal(s.warm_n, 4);
  assert.equal(s.cold_n, 1);
  assert.equal(s.teasers_warm_n, 3);
  assert.equal(s.teasers_warm_median, 1400);
  assert.equal(s.teasers_cold_median, 6000);
  assert.equal(s.hero_first_cold_median, 20000);
  const g = timingGates(s);
  assert.deepEqual(g.map(r => r.pass), [true, true, true]);
});

test('timing: cache hit or missing perf fails the cache-safe row; slow median fails', () => {
  const hit = timingGates(summarizeTiming(tfile([trec('a'), trec('b', { hit: true })])));
  assert.equal(hit[0].pass, false);
  const orch = trec('o');
  orch.perf!.orch_cached = true;
  assert.equal(timingGates(summarizeTiming(tfile([orch])))[0].pass, false);
  const noPerf = timingGates(summarizeTiming(tfile([trec('a'), trec('b', { perf: null })])));
  assert.equal(noPerf[0].pass, false);
  const slow = timingGates(summarizeTiming(tfile([trec('a', { t_teasers_ms: 2000, t_hero_first_ms: 5000 })])));
  assert.equal(slow[1].pass, false);
  assert.equal(slow[2].pass, false);
});
