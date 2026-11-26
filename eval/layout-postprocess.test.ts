import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyServerTeaserTags, renderRawResponse, postProcessOutput } from '../src/lib/layout-postprocess';
import type { LayoutPlan } from '../src/types';
import type { CatalogueTags } from '../src/lib/catalogue';

const tags = new Map<string, CatalogueTags>([
  ['b-study', { capabilities: ['Brand', 'Video'], industries: ['Tech'] }],
  ['empty', { capabilities: [], industries: [] }],
]);
const teaser = (slug: string, extra: object = {}): any => ({
  component: 'CaseStudyTeaser',
  props: { title: 't', summary: 's', slug, ...extra },
});
const hero: any = { component: 'HeroBlock', props: { headline: 'h', subheadline: 's' } };

test('model tags are replaced by DB tags', () => {
  const layout: LayoutPlan = { layout: [teaser('b-study', { capabilities: ['Made Up'] })] };
  const r = applyServerTeaserTags(layout, tags);
  assert.deepEqual((r.layout.layout[0].props as any).capabilities, ['Brand', 'Video']);
  assert.deepEqual((r.layout.layout[0].props as any).industries, ['Tech']);
  assert.equal(r.overwritten, 1);
});

test('empty links, unknown slug and missing catalogue yield no tag props', () => {
  const mk = (): LayoutPlan => ({
    layout: [teaser('empty', { capabilities: ['x'], industries: ['y'] }), teaser('nope', { capabilities: ['x'] })],
  });
  for (const t of [tags, null]) {
    const r = applyServerTeaserTags(mk(), t);
    for (const c of r.layout.layout) {
      assert.ok(!('capabilities' in c.props));
      assert.ok(!('industries' in c.props));
    }
    assert.equal(r.overwritten, 2);
  }
});

test('non-teasers unchanged and input not mutated', () => {
  const layout: LayoutPlan = { layout: [hero, teaser('b-study', { capabilities: ['Made Up'] })] };
  const snapshot = structuredClone(layout);
  const r = applyServerTeaserTags(layout, tags);
  assert.deepEqual(r.layout.layout[0], hero);
  assert.deepEqual(layout, snapshot);
});

test('renderRawResponse replaces only the first json fence', () => {
  const raw = 'before\n```json\n{"layout":[]}\n```\nafter ```json\n{"x":1}\n```';
  const layout: LayoutPlan = { layout: [hero] };
  const out = renderRawResponse(raw, layout);
  assert.ok(out.startsWith('before\n```json\n' + JSON.stringify(layout, null, 2) + '\n```\nafter '));
  assert.ok(out.endsWith('```json\n{"x":1}\n```'));
  assert.equal(renderRawResponse('no fence', layout), 'no fence');
  assert.equal(renderRawResponse('a foo b', layout, { from: 'foo', to: 'bar' }), 'a bar b');
});

test('postProcessOutput keeps the model text and re-renders raw', () => {
  const layout: LayoutPlan = { layout: [teaser('b-study', { capabilities: ['Made Up'] })] };
  const raw = '```json\n' + JSON.stringify(layout) + '\n```';
  const out = postProcessOutput({ layoutPlan: layout, explanation: 'e' }, raw, tags);
  assert.equal(out.modelRawResponse, raw);
  assert.ok(!out.rawResponse!.includes('Made Up'));
  assert.ok(out.rawResponse!.includes('"Brand"'));
});

// Phase 06.1 guard wiring
import { orchestratorCacheKey } from '../src/lib/orchestrator';
import { OUTPUT_GUARD_VERSION } from '../src/lib/output-guard';

const LEAK = "Nothing we retrieved speaks to pricing, so we haven't shown client work.";
function withGuardEnv<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.OUTPUT_GUARD_ENABLED;
  if (value === undefined) delete process.env.OUTPUT_GUARD_ENABLED;
  else process.env.OUTPUT_GUARD_ENABLED = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.OUTPUT_GUARD_ENABLED;
    else process.env.OUTPUT_GUARD_ENABLED = prev;
  }
}
const card = (content: string): any => ({ component: 'StrategyCard', props: { title: 'Next step', content } });
const rawOf = (layout: LayoutPlan, narrative: string) =>
  narrative + '\n```json\n' + JSON.stringify(layout) + '\n```';

test('guard drops a leak sentence from the narrative and the raw response', () => {
  const layout: LayoutPlan = { layout: [hero] };
  const explanation = `${LEAK} Price depends on scope.`;
  const raw = rawOf(layout, explanation);
  const out = withGuardEnv(undefined, () => postProcessOutput({ layoutPlan: layout, explanation }, raw, tags));
  assert.equal(out.explanation, 'Price depends on scope.');
  assert.ok(!out.rawResponse!.includes('retrieved'));
  assert.ok(out.modelRawResponse!.includes('retrieved'));
  const changes = out.guard!.changes.filter(c => c.rule === 'retrieval_leak');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].action, 'drop_sentence');
  assert.equal(changes[0].field, 'explanation');
});

test('guard rewrites a count claim in layout and raw json block', () => {
  const layout: LayoutPlan = { layout: [card('Our two Salesforce engagements are the closest match.')] };
  const raw = rawOf(layout, 'Hello.');
  const out = withGuardEnv(undefined, () => postProcessOutput({ layoutPlan: layout, explanation: 'Hello.' }, raw, tags));
  assert.equal((out.layoutPlan.layout[0].props as any).content, 'Two of our Salesforce engagements are the closest match.');
  assert.ok(out.rawResponse!.includes('Two of our Salesforce engagements are the closest match.'));
});

test('OUTPUT_GUARD_ENABLED=false leaves text unchanged and guard null', () => {
  const layout: LayoutPlan = { layout: [hero] };
  const explanation = `${LEAK} Price depends on scope.`;
  const raw = rawOf(layout, explanation);
  const out = withGuardEnv('false', () => postProcessOutput({ layoutPlan: layout, explanation }, raw, tags));
  assert.equal(out.explanation, explanation);
  assert.ok(out.rawResponse!.includes('retrieved'));
  assert.equal(out.guard, null);
});

test('undefined explanation stays undefined under the guard', () => {
  const layout: LayoutPlan = { layout: [hero] };
  const out = withGuardEnv(undefined, () => postProcessOutput({ layoutPlan: layout } as any, rawOf(layout, ''), tags));
  assert.equal(out.explanation, undefined);
});

test('cache key carries the guard version, 0 when disabled', () => {
  const input: any = { userQuery: 'q', context: { chunks: [] }, conversationHistory: [] };
  assert.equal(withGuardEnv(undefined, () => orchestratorCacheKey(input, null)).outputGuard, OUTPUT_GUARD_VERSION);
  assert.equal(withGuardEnv('false', () => orchestratorCacheKey(input, null)).outputGuard, 0);
});
