import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeRuns, type RunWithGrades } from './merge-runs';
import type { GradeRecord, RunRecord } from './lib';

const rec = (id: string, status: 'ok' | 'error', tag = ''): RunRecord =>
  ({ id, status, query: `${id}${tag}` }) as unknown as RunRecord;
const grade = (id: string, tag = ''): GradeRecord => ({ id, grader_model: 'j', skipped: tag || null }) as unknown as GradeRecord;

const make = (dir: string, records: RunRecord[], grades: GradeRecord[], commit = 'abc'): RunWithGrades => ({
  dir: `/x/${dir}`,
  run: {
    started_at: `${dir}-start`,
    finished_at: `${dir}-end`,
    base_url: 'http://localhost:3000',
    git_commit: commit,
    query_count: records.length,
    records,
    models: { route: 'openrouter', generation: 'g', embedding: 'e' },
  },
  grades: { grader_model: 'j', harness_version: 4, grades },
});

test('mergeRuns replaces failed base records with patch records, keeping base order', () => {
  const base = make('base', [rec('a', 'ok'), rec('b', 'error'), rec('c', 'ok')], [grade('a'), grade('b', 'failed'), grade('c')]);
  const patch = make('patch', [rec('b', 'ok', '-new')], [grade('b')]);
  const { run, grades } = mergeRuns(base, patch);
  assert.deepEqual(run.records.map(r => [r.id, r.status]), [['a', 'ok'], ['b', 'ok'], ['c', 'ok']]);
  assert.equal(run.records[1].query, 'b-new');
  assert.deepEqual(grades.grades.map(g => [g.id, g.skipped]), [['a', null], ['b', null], ['c', null]]);
  assert.equal(run.query_count, 3);
  assert.equal(run.started_at, 'base-start');
  assert.equal(run.finished_at, 'patch-end');
  assert.deepEqual(run.merged_from?.map(m => [m.dir, m.ids]), [['base', ['a', 'c']], ['patch', ['b']]]);
  assert.equal(grades.harness_version, 4);
});

test('mergeRuns does not mutate the inputs', () => {
  const base = make('base', [rec('a', 'error')], [grade('a', 'failed')]);
  const patch = make('patch', [rec('a', 'ok')], [grade('a')]);
  mergeRuns(base, patch);
  assert.equal(base.run.records[0].status, 'error');
  assert.equal(base.run.merged_from, undefined);
});

test('mergeRuns refuses mismatched commits, unknown ids and replacing ok records', () => {
  const base = make('base', [rec('a', 'ok'), rec('b', 'error')], [grade('a'), grade('b')]);
  assert.throws(() => mergeRuns(base, make('p', [rec('b', 'ok')], [grade('b')], 'zzz')), /git_commit/);
  assert.throws(() => mergeRuns(base, make('p', [rec('q', 'ok')], [grade('q')])), /not in base/);
  assert.throws(() => mergeRuns(base, make('p', [rec('a', 'ok')], [grade('a')])), /only failed/);
  assert.throws(() => mergeRuns(base, make('p', [rec('b', 'ok')], [])), /no grade/);
});
