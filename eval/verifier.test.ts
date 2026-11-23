import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectSpans,
  parseVerifierResponse,
  applyRewrites,
  verifyOutput,
  buildVerifierPrompt,
} from '../src/lib/verifier';
import type { OrchestratorOutput } from '../src/types';

const teaser = (slug: string, summary: string): any => ({
  component: 'CaseStudyTeaser',
  props: { title: 'T ' + slug, summary, slug },
});
const card: any = { component: 'StrategyCard', props: { title: 'Card', content: 'Card content here.' } };
const hero: any = { component: 'HeroBlock', props: { headline: 'h', subheadline: 's' } };
const video: any = { component: 'VideoPlayer', props: { url: 'https://vimeo.com/1' } };

const explanation = 'First sentence is here. Second sentence is here. Third sentence is here.';
const layoutOf = () => ({ layout: [hero, teaser('a', 'Sum A.'), teaser('b', 'Sum B.'), card, video] });
const makeOutput = (): OrchestratorOutput => ({
  layoutPlan: layoutOf(),
  explanation,
  rawResponse: 'Intro\n```json\n' + JSON.stringify(layoutOf(), null, 2) + '\n```\n' + explanation,
});
const ctx = {
  chunks: [
    { document_type: 'case_study', document_title: 'Study B', client_name: 'Acme', slug: 'b', content: 'We built X for Acme.' },
    { document_type: 'article', document_title: 'Art', client_name: null, slug: 'art', content: 'Thoughts.' },
  ] as any,
  relatedMetrics: [{ label: 'Leads', value: '+40%', context: 'in a year' }] as any,
};
const stub = (fn: () => Promise<unknown>): any => ({ messages: { create: fn } });
const reply = (text: string): any => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1000, output_tokens: 100 } });

test('collectSpans: teasers, card and narrative sentences; hero and video skipped', () => {
  const spans = collectSpans(makeOutput());
  assert.deepEqual(spans.map(s => s.id), ['t0', 't1', 'c0', 'n0', 'n1', 'n2']);
  assert.equal(spans[0].kind, 'teaser_summary');
  assert.equal(spans[0].slug, 'a');
  assert.equal(spans[2].kind, 'strategy_card');
  assert.equal(spans[3].kind, 'narrative_sentence');
});

test('buildVerifierPrompt includes sources, metrics and spans', () => {
  const p = buildVerifierPrompt('q?', ctx, collectSpans(makeOutput()));
  assert.match(p, /QUESTION: q\?/);
  assert.match(p, /\[CASE STUDY\] Study B \| client: Acme \| slug: b/);
  assert.match(p, /\[ARTICLE - our thinking, not client work\] Art/);
  assert.match(p, /- Leads: \+40% \(in a year\)/);
  assert.match(p, /t0 \(teaser_summary, slug: a\): Sum A\./);
});

test('parseVerifierResponse handles fences, bad ids, empty and long text, non-JSON', () => {
  const spans = collectSpans(makeOutput());
  const ok = parseVerifierResponse('```json\n{"rewrites":[{"id":"t1","text":"We built X.","reason":"aim as result"}]}\n```', spans);
  assert.deepEqual(ok, [{ id: 't1', text: 'We built X.', reason: 'aim as result' }]);
  const dropped = parseVerifierResponse(
    JSON.stringify({
      rewrites: [
        { id: 'zz', text: 'x', reason: '' },
        { id: 't0', text: '  ', reason: '' },
        { id: 'c0', text: 'y'.repeat(601), reason: '' },
      ],
    }),
    spans
  );
  assert.deepEqual(dropped, []);
  assert.equal(parseVerifierResponse('not json at all', spans), null);
  assert.deepEqual(parseVerifierResponse('{"rewrites":[]}', spans), []);
});

test('applyRewrites replaces only targeted spans, re-renders raw, does not mutate input', () => {
  const out = makeOutput();
  const before = JSON.stringify(out);
  const spans = collectSpans(out);
  const res = applyRewrites(out, spans, [
    { id: 't1', text: 'We built X.', reason: '' },
    { id: 'c0', text: 'New card.', reason: '' },
    { id: 'n1', text: 'Rewritten second.', reason: '' },
  ]);
  assert.equal(JSON.stringify(out), before);
  const items = res.layoutPlan.layout as any[];
  assert.equal(items[1].props.summary, 'Sum A.');
  assert.equal(items[2].props.summary, 'We built X.');
  assert.equal(items[3].props.content, 'New card.');
  assert.equal(res.explanation, 'First sentence is here. Rewritten second. Third sentence is here.');
  assert.match(res.rawResponse!, /We built X\./);
  assert.match(res.rawResponse!, /Rewritten second\./);
  assert.doesNotMatch(res.rawResponse!, /Second sentence is here/);
  assert.match(res.rawResponse!, /Sum A\./);
});

test('verifyOutput applies rewrites and reports cost', async () => {
  const out = makeOutput();
  const r = await verifyOutput({
    query: 'q',
    context: ctx,
    output: out,
    client: stub(async () => reply('{"rewrites":[{"id":"t0","text":"Supported A.","reason":"r"}]}')),
  });
  assert.equal(r.report.ok, true);
  assert.equal(r.report.spans, 6);
  assert.equal(r.report.rewrites.length, 1);
  assert.ok((r.report.cost ?? 0) > 0);
  assert.equal((r.output.layoutPlan.layout[1].props as any).summary, 'Supported A.');
});

test('verifyOutput keeps the original on throw, timeout and unparseable output', async () => {
  const out = makeOutput();
  const thrown = await verifyOutput({ query: 'q', context: ctx, output: out, client: stub(async () => { throw new Error('boom'); }) });
  assert.equal(thrown.output, out);
  assert.equal(thrown.report.ok, false);
  assert.equal(thrown.report.error, 'boom');
  const timedOut = await verifyOutput({
    query: 'q',
    context: ctx,
    output: out,
    client: stub(async () => { throw new Error('Request timed out.'); }),
  });
  assert.equal(timedOut.output, out);
  assert.equal(timedOut.report.ok, false);
  const bad = await verifyOutput({ query: 'q', context: ctx, output: out, client: stub(async () => reply('sorry')) });
  assert.equal(bad.output, out);
  assert.equal(bad.report.error, 'unparseable');
});

test('verifyOutput makes no call when there are no spans', async () => {
  let called = false;
  const out: OrchestratorOutput = { layoutPlan: { layout: [hero] }, explanation: '' };
  const r = await verifyOutput({ query: 'q', context: ctx, output: out, client: stub(async () => { called = true; return reply('{}'); }) });
  assert.equal(called, false);
  assert.equal(r.report.ok, true);
  assert.equal(r.report.spans, 0);
});
