/**
 * Builds eval/fixtures/phase4-retrieval-scores.json from saved eval responses (no network, no cost).
 * Usage: npx tsx eval/make-suppression-fixture.ts [--run <run-id>]
 */
import './lib';
import * as fs from 'fs';
import * as path from 'path';
import { EVAL_DIR, RESULTS_DIR, QUERIES_PATH } from './lib';

const argIdx = process.argv.indexOf('--run');
const run = argIdx > -1 ? process.argv[argIdx + 1] : '2026-11-22T22-48-20';

const responses = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, run, 'responses.json'), 'utf8'));
const queries = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8')) as {
  queries: { id: string; type: string; text: string; expected: { fallback_expected: boolean } }[];
};
const byId = new Map(queries.queries.map(q => [q.id, q]));

const records = (responses.records as any[]).map(r => {
  const q = byId.get(r.id);
  return {
    id: r.id as string,
    type: r.type as string,
    query: (q?.text ?? r.query) as string,
    fallback_expected: Boolean(q?.expected.fallback_expected ?? r.expected?.fallback_expected),
    case_studies: ((r.retrieval?.chunks ?? []) as any[])
      .filter(c => c.document_type === 'case_study')
      .map(c => ({ slug: c.slug as string, similarity_score: Math.round(c.similarity_score * 1e4) / 1e4 })),
  };
});

const outDir = path.join(EVAL_DIR, 'fixtures');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'phase4-retrieval-scores.json');
fs.writeFileSync(out, JSON.stringify({ source_run: run, generated_at: new Date().toISOString(), records }, null, 1) + '\n');
console.log(`wrote ${records.length} records to ${out}`);
