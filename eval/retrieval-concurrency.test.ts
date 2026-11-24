import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * PERF-01/02 retrieval fixes (debug session retrieval-latency): retrieval output must stay identical
 * while the work overlaps. Supabase (PostgREST) and the embedding API are faked at the fetch layer,
 * so no network, no cost.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://fake-supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.OPENROUTER_API_KEY = 'or-key';
process.env.OPENAI_API_KEY = 'oa-key';
process.env.RERANK_ENABLED = 'false';

import { retrieveContext, __resetRetrievalMemos } from '../src/lib/supabase';
import { formatCatalogue, catalogueVersion, getCatalogue, type CatalogueRow } from '../src/lib/catalogue';

type Row = Record<string, any>;
interface Call { key: string; start: number; end: number }

const t0 = Date.now();
const calls: Call[] = [];
const delays: Record<string, number> = {};
let tables: Record<string, Row[]> = {};
let rpcRows: Row[] = [];
let visualCount = 0;
let embeddingCounter = 0;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

function resetFake(): void {
  calls.length = 0;
  for (const k of Object.keys(delays)) delete delays[k];
  embeddingCounter = 0;
  visualCount = 0;
  rpcRows = [];
  tables = { capabilities: [], industries: [], topics: [], document_metrics: [] };
  __resetRetrievalMemos();
}

function applyIn(rows: Row[], url: URL): Row[] {
  let out = rows;
  for (const [col, val] of url.searchParams) {
    const m = /^in\.\((.*)\)$/.exec(val);
    if (m && col !== 'select') {
      const set = new Set(m[1].split(',').map(x => x.replace(/^"|"$/g, '')));
      out = out.filter(r => set.has(String(r[col])));
    }
  }
  const order = url.searchParams.get('order');
  if (order) {
    const [col, dir] = order.split('.');
    out = [...out].sort((a, b) => (dir === 'desc' ? -1 : 1) * (a[col] - b[col])); // Array.sort is stable
  }
  return out;
}

globalThis.fetch = (async (input: any, init?: any) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const key = url.pathname.endsWith('/embeddings')
    ? 'embedding'
    : url.pathname.startsWith('/rest/v1/rpc/')
      ? `rpc:${url.pathname.slice('/rest/v1/rpc/'.length)}`
      : `table:${url.pathname.slice('/rest/v1/'.length)}${method === 'HEAD' ? ':head' : ''}`;
  const call: Call = { key, start: Date.now() - t0, end: 0 };
  calls.push(call);
  await sleep(delays[key] ?? 20);
  try {
    if (key === 'embedding') {
      embeddingCounter++;
      return json({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
    }
    if (key === 'rpc:hybrid_search_v2') return json(rpcRows);
    if (key === 'rpc:search_visual_assets') return json([]);
    if (key === 'table:visual_assets:head') return new Response(null, { status: 200, headers: { 'content-range': `*/${visualCount}` } });
    const table = key.replace('table:', '');
    return json(applyIn(tables[table] ?? [], url));
  } finally {
    call.end = Date.now() - t0;
  }
}) as typeof fetch;

const chunk = (doc: string, type: string, score: number, extra: Row = {}): Row => ({
  chunk_id: `c-${doc}-${score}`,
  document_id: doc,
  document_type: type,
  content: `content ${doc}`,
  combined_score: score,
  semantic_score: score,
  keyword_score: 0,
  semantic_rank: 1,
  keyword_rank: null,
  intent_match: false,
  metadata: {},
  ...extra,
});

const ctxArgs = (query: string, extra: Record<string, unknown> = {}) => ({ query, maxChunks: 10, maxAssets: 5, skipCache: true, ...extra });

test('relatedMetrics: all-documents fetch filtered in memory equals the old per-document query', async () => {
  resetFake();
  rpcRows = [chunk('d1', 'case_study', 0.9), chunk('d2', 'case_study', 0.8), chunk('d3', 'article', 0.7), chunk('d9', 'case_study', 0.1, { chunk_id: 'dup' })];
  // d4 is not retrieved; ties on display_order must keep table order
  tables.document_metrics = [
    { id: 'm1', document_id: 'd2', label: 'a', value: '1', display_order: 2 },
    { id: 'm2', document_id: 'd4', label: 'b', value: '2', display_order: 0 },
    { id: 'm3', document_id: 'd1', label: 'c', value: '3', display_order: 1 },
    { id: 'm4', document_id: 'd3', label: 'd', value: '4', display_order: 1 },
    { id: 'm5', document_id: 'd1', label: 'e', value: '5', display_order: 2 },
  ];
  const ctx = await retrieveContext(ctxArgs('metrics equivalence query'));
  const retrieved = new Set(ctx.chunks.map(c => c.document_id));
  const expected = applyIn(tables.document_metrics, new URL(`http://x/?document_id=in.(${[...retrieved].join(',')})&order=display_order.asc`));
  assert.deepEqual(ctx.relatedMetrics.map(m => m.id), expected.map(m => m.id));
  assert.deepEqual(ctx.relatedMetrics.map(m => m.id), ['m3', 'm4', 'm1', 'm5']);
  assert.equal(calls.filter(c => c.key === 'table:document_metrics').length, 1);
});

test('no retrieved documents: metrics result is empty', async () => {
  resetFake();
  tables.document_metrics = [{ id: 'm1', document_id: 'd1', label: 'a', value: '1', display_order: 0 }];
  const ctx = await retrieveContext(ctxArgs('nothing retrieved query'));
  assert.deepEqual(ctx.chunks, []);
  assert.deepEqual(ctx.relatedMetrics, []);
});

test('metrics fetch starts concurrently with the search RPC', async () => {
  resetFake();
  rpcRows = [chunk('d1', 'case_study', 0.9)];
  delays['rpc:hybrid_search_v2'] = 150;
  delays['table:document_metrics'] = 100;
  await retrieveContext(ctxArgs('concurrent metrics query'));
  const rpc = calls.find(c => c.key === 'rpc:hybrid_search_v2')!;
  const met = calls.find(c => c.key === 'table:document_metrics')!;
  assert.ok(met.start < rpc.end, `metrics started ${met.start}, rpc ended ${rpc.end}`);
});

test('onChunks fires after the search, before metrics, taxonomy and assets finish', async () => {
  resetFake();
  rpcRows = [chunk('d1', 'case_study', 0.9), chunk('d2', 'article', 0.5)];
  delays['table:document_metrics'] = 300;
  delays['table:capabilities'] = 300;
  let seen: string[] = [];
  let at = 0;
  const started = Date.now();
  const ctx = await retrieveContext(ctxArgs('early chunks query', { onChunks: (c: any[]) => { seen = c.map(x => x.chunk_id); at = Date.now() - started; } }));
  const total = Date.now() - started;
  assert.deepEqual(seen, ctx.chunks.map(c => c.chunk_id));
  assert.ok(at < 200 && total >= 300, `onChunks at ${at}ms, total ${total}ms`);
});

test('onChunks also fires on a RAG cache hit', async () => {
  resetFake();
  rpcRows = [chunk('d1', 'case_study', 0.9)];
  const args = { query: 'cache hit query', maxChunks: 10, maxAssets: 5 };
  const first = await retrieveContext(args);
  let seen = 0;
  const second = await retrieveContext({ ...args, onChunks: c => { seen = c.length; } });
  assert.equal(seen, 1);
  assert.deepEqual(second.chunks, first.chunks);
});

test('same-text embedding is requested once per retrieval (shared in-flight promise)', async () => {
  resetFake();
  visualCount = 3; // visual search active so both callers want the embedding
  rpcRows = [chunk('d1', 'case_study', 0.9)];
  await retrieveContext(ctxArgs('dedupe embedding query'));
  assert.equal(embeddingCounter, 1);
  assert.equal(calls.filter(c => c.key === 'rpc:search_visual_assets').length, 1);
});

test('visual assets: empty table short-circuits, non-empty searches, and an empty table self-heals', async () => {
  resetFake();
  rpcRows = [chunk('d1', 'case_study', 0.9)];
  const a = await retrieveContext(ctxArgs('visual empty one'));
  assert.deepEqual(a.visualAssets, []);
  assert.equal(calls.filter(c => c.key === 'rpc:search_visual_assets').length, 0);
  assert.equal(calls.filter(c => c.key === 'table:visual_assets:head').length, 1);

  // Memoised: a second request does not recount
  await retrieveContext(ctxArgs('visual empty two'));
  assert.equal(calls.filter(c => c.key === 'table:visual_assets:head').length, 1);

  // Assets get added; after the 5 minute recheck window the search runs again
  visualCount = 2;
  const realNow = Date.now;
  Date.now = () => realNow() + 6 * 60 * 1000;
  try {
    await retrieveContext(ctxArgs('visual empty three'));
  } finally {
    Date.now = realNow;
  }
  assert.equal(calls.filter(c => c.key === 'table:visual_assets:head').length, 2);
  assert.equal(calls.filter(c => c.key === 'rpc:search_visual_assets').length, 1);
});

test('taxonomy is memoised across requests and returned unchanged', async () => {
  resetFake();
  rpcRows = [chunk('d1', 'case_study', 0.9)];
  tables.capabilities = [{ id: 'c1', name: 'Video', slug: 'video' }];
  tables.industries = [{ id: 'i1', name: 'Finance', slug: 'finance' }];
  tables.topics = [{ id: 't1', name: 'Trust', slug: 'trust' }];
  const a = await retrieveContext(ctxArgs('taxonomy one'));
  const b = await retrieveContext(ctxArgs('taxonomy two'));
  for (const t of ['capabilities', 'industries', 'topics']) {
    assert.equal(calls.filter(c => c.key === `table:${t}`).length, 1, t);
  }
  assert.deepEqual(a.capabilities, tables.capabilities);
  assert.deepEqual(b.industries, tables.industries);
  assert.deepEqual(b.topics, tables.topics);
});

test('chunk selection and order are untouched: case studies first, RRF order, best chunk per document', async () => {
  resetFake();
  rpcRows = [
    chunk('a1', 'article', 0.95),
    chunk('cs1', 'case_study', 0.3, { chunk_id: 'cs1-low' }),
    chunk('cs2', 'case_study', 0.8),
    chunk('cs1', 'case_study', 0.9, { chunk_id: 'cs1-high' }),
  ];
  const ctx = await retrieveContext(ctxArgs('selection order query'));
  assert.deepEqual(ctx.chunks.map(c => c.chunk_id), ['cs1-high', 'c-cs2-0.8', 'c-a1-0.95']);
});

test('search failure propagates and leaves no unhandled rejection from the side fetches', async () => {
  resetFake();
  const unhandled: unknown[] = [];
  const h = (e: unknown) => unhandled.push(e);
  process.on('unhandledRejection', h);
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const u = String(typeof input === 'string' ? input : input.url);
    if (u.includes('/rpc/hybrid_search_v2')) return new Response(JSON.stringify({ code: 'XX000', message: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } });
    if (u.includes('/document_metrics') || u.includes('/capabilities')) {
      await sleep(30);
      return new Response(JSON.stringify({ code: 'XX000', message: 'side boom' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    return real(input, init);
  }) as typeof fetch;
  try {
    await assert.rejects(retrieveContext(ctxArgs('failing search query')));
    await sleep(150);
  } finally {
    globalThis.fetch = real;
    process.off('unhandledRejection', h);
  }
  assert.deepEqual(unhandled, []);
});

test('getCatalogue: concurrent loading yields the same text and version as the sequential format', async () => {
  resetFake();
  const docs = [
    { id: 'd2', title: 'Beta', slug: 'beta', client_name: 'Acme', vimeo_url: 'https://v/1' },
    { id: 'd1', title: 'Alpha', slug: 'alpha', client_name: null, vimeo_url: null },
  ];
  tables = {
    documents: docs,
    content_chunks: [
      { document_id: 'd1', chunk_index: 0, content: 'Intro. Solution included an explainer film and a toolkit.' },
      { document_id: 'd2', chunk_index: 0, content: 'Solution included 3 films.' },
    ],
    document_capabilities: [
      { document_id: 'd1', capabilities: { name: 'Video' } },
      { document_id: 'd1', capabilities: { name: 'Animation' } },
      { document_id: 'd2', capabilities: { name: 'Video' } },
    ],
    document_industries: [{ document_id: 'd1', industries: { name: 'Finance' } }],
  };
  for (const k of ['table:documents', 'table:content_chunks', 'table:document_capabilities', 'table:document_industries']) delays[k] = 100;
  const started = Date.now();
  const cat = await getCatalogue();
  const elapsed = Date.now() - started;
  const rows: CatalogueRow[] = [
    { slug: 'beta', title: 'Beta', client: 'Acme', capabilities: ['Video'], industries: [], hasVideo: true, deliverables: 'Solution included 3 films.' },
    { slug: 'alpha', title: 'Alpha', client: null, capabilities: ['Video', 'Animation'], industries: ['Finance'], hasVideo: false, deliverables: 'Solution included an explainer film and a toolkit.' },
  ];
  const text = formatCatalogue(rows);
  assert.equal(cat?.text, text);
  assert.equal(cat?.version, catalogueVersion(text));
  assert.ok(elapsed < 300, `4 reads at 100 ms each took ${elapsed} ms (sequential would be >=400)`);
});
