import test from 'node:test';
import assert from 'node:assert/strict';
import type { HybridSearchResult } from '../src/types';
import { buildRerankPool, rerankDocuments, applyRerank } from '../src/lib/rerank';

function row(id: string, sim: number, kw: number, type: 'case_study' | 'article' = 'case_study'): HybridSearchResult {
  return {
    chunk_id: `c-${id}`, document_id: id, content: `text ${id}`, chunk_type: 'summary', metadata: {},
    document_title: `Title ${id}`, document_type: type, slug: id, client_name: `Client ${id}`, author: null,
    vimeo_url: null, thumbnail_url: null, similarity_score: sim, keyword_score: kw, combined_score: 0,
  };
}

test('buildRerankPool: semantic top-N first, keyword-only additions after, unique, case studies only', () => {
  const rows = [
    row('a', 0.9, 0), row('a', 0.5, 0.2), row('b', 0.8, 0), row('c', 0.7, 0), row('d', 0.1, 0.9),
    row('e', 0.05, 0.5), row('f', 0.6, 0), row('x', 0.99, 0.99, 'article'),
  ];
  const pool = buildRerankPool(rows, { semanticPool: 3, keywordPool: 2 });
  assert.deepEqual(pool.map(r => r.document_id), ['a', 'b', 'c', 'd', 'e']);
});

test('buildRerankPool: keyword-only docs need score > 0 and keyword pool is capped', () => {
  const rows = [row('a', 0.9, 0), row('b', 0.8, 0), row('c', 0.1, 0), row('d', 0.1, 0.5), row('e', 0.1, 0.4)];
  const pool = buildRerankPool(rows, { semanticPool: 1, keywordPool: 1 });
  assert.deepEqual(pool.map(r => r.document_id), ['a', 'd']);
});

const docs = [row('a', 0, 0), row('b', 0, 0), row('c', 0, 0)];

function withFetch(impl: typeof fetch, fn: () => Promise<void>) {
  const orig = globalThis.fetch;
  const key = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = orig;
    if (key === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = key;
  });
}

test('rerankDocuments orders by relevance and applyRerank keeps unscored docs after', async () => {
  let body: { model: string; top_n: number; documents: string[] } | undefined;
  await withFetch((async (_u: unknown, init: RequestInit) => {
    body = JSON.parse(String(init.body));
    return new Response(JSON.stringify({
      results: [{ index: 0, relevance_score: 0.4 }, { index: 2, relevance_score: 0.9 }],
      usage: { cost: 0.0001 },
    }), { status: 200 });
  }) as typeof fetch, async () => {
    const out = await rerankDocuments('q', docs);
    assert.ok(out);
    assert.deepEqual(out.order, [2, 0]);
    assert.equal(out.cost, 0.0001);
    assert.equal(body!.model, 'cohere/rerank-5-fast');
    assert.equal(body!.top_n, 3);
    const sel = applyRerank(docs, out);
    assert.deepEqual(sel.map(r => r.document_id), ['c', 'a', 'b']);
    assert.equal(sel[0].rerank_score, 0.9);
    assert.equal(sel[2].rerank_score, undefined);
  });
});

test('rerankDocuments returns null on reject, non-2xx, malformed JSON, timeout', async () => {
  await withFetch((async () => { throw new Error('boom'); }) as typeof fetch, async () => {
    assert.equal(await rerankDocuments('q', docs), null);
  });
  await withFetch((async () => new Response('no', { status: 500 })) as typeof fetch, async () => {
    assert.equal(await rerankDocuments('q', docs), null);
  });
  await withFetch((async () => new Response('not json', { status: 200 })) as typeof fetch, async () => {
    assert.equal(await rerankDocuments('q', docs), null);
  });
  await withFetch((async () => new Response(JSON.stringify({ results: [{ index: 9, relevance_score: 1 }] }), { status: 200 })) as typeof fetch, async () => {
    assert.equal(await rerankDocuments('q', docs), null);
  });
  await withFetch(((_u: unknown, init: RequestInit) => new Promise((_res, rej) => {
    init.signal!.addEventListener('abort', () => rej(new Error('aborted')));
  })) as typeof fetch, async () => {
    assert.equal(await rerankDocuments('q', docs), null);
  });
});
