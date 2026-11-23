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
