import test from 'node:test';
import assert from 'node:assert/strict';
import {
  streamViewReducer,
  deriveLayout,
  reconcileTeasers,
  initialStreamView,
  NETWORK_ERROR_MESSAGE,
  type StreamViewAction,
  type StreamViewState,
} from '../src/lib/stream-view';
import type { InstantTeaser, PublicOrchestratorOutput } from '../src/lib/stream-events';
import type { CaseStudyTeaserProps, HeroBlockProps } from '../src/types';

const inst = (slug: string, summary?: string): InstantTeaser => ({
  title: `T-${slug}`,
  slug,
  clientName: `C-${slug}`,
  ...(summary !== undefined ? { summary } : {}),
});
const tp = (slug: string, summary = 'model line'): CaseStudyTeaserProps => ({ title: `T-${slug}`, slug, summary });

const run = (actions: StreamViewAction[], from: StreamViewState = initialStreamView) =>
  actions.reduce(streamViewReducer, from);

const finalOutput = (layout: PublicOrchestratorOutput['layoutPlan']['layout']): PublicOrchestratorOutput =>
  ({ layoutPlan: { layout }, explanation: 'done', suggestedFollowUps: ['q'] }) as PublicOrchestratorOutput;

test('teasers event gives pending hero and 3 teaser items with instant props', () => {
  const s = run([{ type: 'teasers', items: [inst('a', 'db line'), inst('b'), inst('c')] }]);
  assert.equal(s.phase, 'teasers');
  assert.equal(s.instantTeasers.length, 3);
  const d = deriveLayout(s);
  assert.equal(d.pendingHero, true);
  assert.equal(d.layout.length, 3);
  assert.ok(d.layout.every(c => c.component === 'CaseStudyTeaser'));
  assert.equal((d.layout[0].props as CaseStudyTeaserProps).summary, 'db line');
  assert.equal((d.layout[1].props as CaseStudyTeaserProps).summary, '');
});

test('suppressed shows no teasers but pending hero', () => {
  const s = run([{ type: 'suppressed', reason: 'claim_pattern' }]);
  const d = deriveLayout(s);
  assert.equal(s.suppressed, 'claim_pattern');
  assert.equal(d.layout.length, 0);
  assert.equal(d.pendingHero, true);
});

test('hero events: cumulative, dark default until hero_done', () => {
  let s = run([
    { type: 'teasers', items: [inst('a')] },
    { type: 'hero', title: 'Hel' },
  ]);
  let d = deriveLayout(s);
  assert.equal(d.pendingHero, false);
  assert.equal(d.layout[0].component, 'HeroBlock');
  assert.equal((d.layout[0].props as HeroBlockProps).title, 'Hel');
  assert.equal((d.layout[0].props as HeroBlockProps).backgroundVariant, 'dark');
  s = run([{ type: 'hero', title: 'Hello', subtitle: 'Sub' }], s);
  d = deriveLayout(s);
  assert.equal((d.layout[0].props as HeroBlockProps).title, 'Hello');
  assert.equal((d.layout[0].props as HeroBlockProps).subtitle, 'Sub');
  s = run([{ type: 'hero_done', props: { title: 'Hello', backgroundVariant: 'light' } }], s);
  d = deriveLayout(s);
  assert.equal((d.layout[0].props as HeroBlockProps).backgroundVariant, 'light');
});

test('non-teaser components ordered by index after hero, before teasers', () => {
  const s = run([
    { type: 'teasers', items: [inst('a')] },
    { type: 'hero', title: 'H' },
    { type: 'component', index: 3, component: 'StrategyCard', props: { title: 's', content: 'c' } },
    { type: 'component', index: 2, component: 'VideoPlayer', props: { url: 'u' } },
  ]);
  const d = deriveLayout(s);
  assert.deepEqual(
    d.layout.map(c => c.component),
    ['HeroBlock', 'VideoPlayer', 'StrategyCard', 'CaseStudyTeaser'],
  );
});

test('component teaser replaces instant in place; new slug appended', () => {
  const s = run([
    { type: 'teasers', items: [inst('a', 'db'), inst('b', 'db')] },
    { type: 'component', index: 1, component: 'CaseStudyTeaser', props: tp('b', 'tailored') as unknown as Record<string, unknown> },
    { type: 'component', index: 2, component: 'CaseStudyTeaser', props: tp('z', 'new') as unknown as Record<string, unknown> },
  ]);
  const t = deriveLayout(s).layout.map(c => c.props as CaseStudyTeaserProps);
  assert.deepEqual(t.map(x => x.slug), ['a', 'b', 'z']);
  assert.equal(t[0].summary, 'db');
  assert.equal(t[1].summary, 'tailored');
  assert.equal(t[2].summary, 'new');
});

test('narrative deltas concatenate', () => {
  const s = run([
    { type: 'narrative', text: 'Hello ' },
    { type: 'narrative', text: 'world' },
  ]);
  assert.equal(s.narrative, 'Hello world');
});

test('final reconciles to the model layout exactly; unchosen exit separately', () => {
  const modelLayout = [
    { component: 'HeroBlock' as const, props: { title: 'H' } },
    { component: 'CaseStudyTeaser' as const, props: tp('b') },
    { component: 'CaseStudyTeaser' as const, props: tp('d') },
  ];
  const s = run([
    { type: 'teasers', items: [inst('a'), inst('b'), inst('c')] },
    { type: 'final', output: finalOutput(modelLayout) },
  ]);
  const d = deriveLayout(s);
  assert.deepEqual(d.layout, modelLayout);
  assert.deepEqual(d.exitingSlugs, ['a', 'c']);
  assert.deepEqual(d.exiting.map(c => (c.props as CaseStudyTeaserProps).slug), ['a', 'c']);
  assert.equal(d.pendingHero, false);
  const cleared = deriveLayout(run([{ type: 'exit_done' }], s));
  assert.deepEqual(cleared.exitingSlugs, []);
  assert.deepEqual(cleared.exiting, []);
  assert.deepEqual(cleared.layout, modelLayout);
});

test('reconcileTeasers', () => {
  const r = reconcileTeasers([inst('A'), inst('B'), inst('C')], [tp('B'), tp('D')]);
  assert.deepEqual(r.ordered.map(t => t.slug), ['B', 'D']);
  assert.deepEqual(r.removed, ['A', 'C']);
});

test('error after hero keeps partial deck without skeleton', () => {
  const s = run([
    { type: 'teasers', items: [inst('a')] },
    { type: 'hero', title: 'H' },
    { type: 'error', explanation: 'boom', errorCode: 'UNKNOWN' as never, retryable: false, contactCTA: true },
  ]);
  assert.equal(s.phase, 'error');
  assert.deepEqual(s.error, { message: 'boom', retryable: false, contactCTA: true });
  const d = deriveLayout(s);
  assert.equal(d.pendingHero, false);
  assert.deepEqual(d.layout.map(c => c.component), ['HeroBlock', 'CaseStudyTeaser']);
});

test('closed without final or error becomes retryable network error', () => {
  const s = run([{ type: 'teasers', items: [inst('a')] }, { type: 'closed' }]);
  assert.equal(s.phase, 'error');
  assert.equal(s.error?.retryable, true);
  assert.equal(s.error?.message, NETWORK_ERROR_MESSAGE);
  assert.equal(deriveLayout(s).pendingHero, false);
});

test('closed after final is a no-op; debug ignored', () => {
  const s = run([{ type: 'final', output: finalOutput([]) }, { type: 'closed' }, { type: 'debug', debug: {} }]);
  assert.equal(s.phase, 'done');
  assert.equal(s.error, null);
});
