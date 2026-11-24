import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/model-raw-samples.json';
import { StreamLayoutParser, type ParserEvent } from '../src/lib/stream-layout-parser';

const samples = fixture.samples as { id: string; text: string }[];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function splitRandom(text: string, seed: number): string[] {
  const r = rng(seed);
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const n = 1 + Math.floor(r() * 40);
    out.push(text.slice(i, i + n));
    i += n;
  }
  return out;
}

const splitSingle = (text: string) => text.split('');

function run(chunks: string[]): { events: ParserEvent[]; parser: StreamLayoutParser } {
  const parser = new StreamLayoutParser();
  const events: ParserEvent[] = [];
  for (const c of chunks) events.push(...parser.push(c));
  events.push(...parser.end());
  return { events, parser };
}

function reference(text: string) {
  const m = text.match(/```json\s*([\s\S]*?)\s*```/)!;
  const layout = JSON.parse(m[1]).layout as { component: string; props: Record<string, unknown> }[];
  const explanation = text
    .replace(/```json[\s\S]*?```/, '')
    .trim()
    .split(/\*\*Want to explore/)[0]
    .trim();
  return { layout, explanation };
}

function allSplits(text: string): string[][] {
  const v: string[][] = [splitSingle(text), [text]];
  for (let seed = 1; seed <= 25; seed++) v.push(splitRandom(text, seed));
  return v;
}

function checkSample(text: string, chunks: string[], label: string) {
  const { layout, explanation } = reference(text);
  const { events, parser } = run(chunks);
  assert.equal(parser.fullText, text, label);
  assert.ok(!events.some((e) => e.type === 'abandoned'), `${label}: unexpected abandon`);

  const comps = events.filter((e): e is Extract<ParserEvent, { type: 'component' }> => e.type === 'component');
  const heroFirst = layout[0].component === 'HeroBlock';
  const expected = layout.map((c, i) => ({ c, i })).filter(({ i }) => !(heroFirst && i === 0));
  assert.equal(comps.length, expected.length, `${label}: component count`);
  comps.forEach((e, k) => {
    assert.equal(e.index, expected[k].i, label);
    assert.equal(e.component, expected[k].c.component, label);
    assert.deepEqual(e.props, expected[k].c.props, label);
  });

  if (heroFirst) {
    const done = events.filter((e) => e.type === 'hero_done');
    assert.equal(done.length, 1, `${label}: hero_done count`);
    assert.deepEqual((done[0] as Extract<ParserEvent, { type: 'hero_done' }>).props, layout[0].props, label);
    const doneIdx = events.findIndex((e) => e.type === 'hero_done');
    const firstComp = events.findIndex((e) => e.type === 'component');
    if (firstComp >= 0) assert.ok(doneIdx < firstComp, `${label}: hero_done before components`);
    const finalTitle = layout[0].props.title as string;
    const heroes = events.slice(0, doneIdx).filter((e): e is Extract<ParserEvent, { type: 'hero' }> => e.type === 'hero');
    for (const h of heroes) {
      if (h.title !== undefined) assert.ok(finalTitle.startsWith(h.title), `${label}: title prefix`);
    }
    const lastTitle = [...heroes].reverse().find((h) => h.title !== undefined)?.title;
    assert.equal(lastTitle ?? finalTitle, finalTitle, `${label}: full title`);
  }

  const narrative = events
    .filter((e): e is Extract<ParserEvent, { type: 'narrative' }> => e.type === 'narrative')
    .map((e) => e.text)
    .join('');
  assert.ok(!narrative.includes('**Want to explore'), `${label}: marker leaked`);
  assert.ok(!narrative.includes('Want to ex'), `${label}: partial marker leaked`);
  assert.equal(narrative.trim(), explanation, `${label}: narrative`);
}

for (const s of samples) {
  test(`sample ${s.id}: all split strategies`, () => {
    allSplits(s.text).forEach((chunks, i) => checkSample(s.text, chunks, `${s.id}#${i}`));
  });
}

function synth(title: string, extra = '', tail = 'Narrative here.\n\n**Want to explore further?**\n- Q1\n') {
  const json = JSON.stringify(
    {
      layout: [
        { component: 'HeroBlock', props: { title, subtitle: 'Sub', challengeSummary: 'Chal', backgroundVariant: 'dark' } },
        { component: 'StrategyCard', props: { title: 'S', content: 'C', icon: 'lightbulb' } },
      ],
    },
    null,
    2
  );
  return '```json\n' + json + '\n```\n\n' + tail + extra;
}

function heroTitles(events: ParserEvent[]) {
  return events.filter((e) => e.type === 'hero' && e.title !== undefined).map((e) => (e as { title: string }).title);
}

test('marker split across chunks never leaks', () => {
  const text = synth('T');
  const cut = text.indexOf('**Want to ex') + '**Want to ex'.length;
  const { events } = run([text.slice(0, cut), text.slice(cut)]);
  const n = events.filter((e) => e.type === 'narrative').map((e) => (e as { text: string }).text).join('');
  assert.equal(n.trim(), 'Narrative here.');
  const { events: e2 } = run([text.slice(0, cut - 4), text.slice(cut - 4, cut + 3), text.slice(cut + 3)]);
  const n2 = e2.filter((e) => e.type === 'narrative').map((e) => (e as { text: string }).text).join('');
  assert.equal(n2.trim(), 'Narrative here.');
});

test('escapes split across chunks decode correctly', () => {
  const titles = ['Say "hi"', 'back\\slash', 'line\nbreak', 'café au lait'];
  for (const t of titles) {
    const text = synth(t);
    const json = JSON.stringify(t);
    const at = text.indexOf(json) + 1;
    for (let i = at; i < at + json.length; i++) {
      const { events } = run([text.slice(0, i), text.slice(i)]);
      const done = events.find((e) => e.type === 'hero_done') as unknown as { props: { title: string } };
      assert.equal(done.props.title, t);
      for (const p of heroTitles(events)) assert.ok(t.startsWith(p), `partial ${JSON.stringify(p)} of ${JSON.stringify(t)}`);
    }
  }
});

test('unicode escape split after backslash, \\u and \\u00', () => {
  const body = '```json\n{"layout":[{"component":"HeroBlock","props":{"title":"caf\\u00e9!","subtitle":"s","challengeSummary":"c","backgroundVariant":"dark"}}]}\n```\n\nN.\n';
  const base = body.indexOf('caf') + 3;
  for (const cut of [base + 1, base + 2, base + 4]) {
    const { events } = run([body.slice(0, cut), body.slice(cut)]);
    for (const p of heroTitles(events)) assert.ok('café!'.startsWith(p), JSON.stringify(p));
    const done = events.find((e) => e.type === 'hero_done') as unknown as { props: { title: string } };
    assert.equal(done.props.title, 'café!');
  }
});

test('braces and brackets inside strings do not end items early', () => {
  const t = 'A } B ] C { D [';
  const text = synth(t);
  for (const chunks of allSplits(text)) {
    const { events } = run(chunks);
    assert.ok(!events.some((e) => e.type === 'abandoned'));
    const done = events.find((e) => e.type === 'hero_done') as unknown as { props: { title: string } };
    assert.equal(done.props.title, t);
    assert.equal(events.filter((e) => e.type === 'component').length, 1);
  }
});

test('backgroundVariant appears only once its value is complete', () => {
  const text = synth('T');
  const { events } = run(splitSingle(text));
  for (const e of events) {
    if (e.type === 'hero' && e.backgroundVariant !== undefined) {
      assert.ok(['dark', 'light', 'gradient'].includes(e.backgroundVariant));
    }
  }
});

test('malformed item abandons without throwing and emits no narrative', () => {
  const text =
    '```json\n{"layout":[{"component":"HeroBlock","props":{"title":"T","subtitle":"s","challengeSummary":"c","backgroundVariant":"dark"}},' +
    '{ "component": "StrategyCard", "props": { "title": "x", } },\n{"component":"StrategyCard","props":{"title":"y"}}]}\n```\n\nNarrative.\n';
  for (const chunks of [splitSingle(text), [text], ...[1, 2, 3].map((s) => splitRandom(text, s))]) {
    const { events, parser } = run(chunks);
    assert.equal(events.filter((e) => e.type === 'abandoned').length, 1);
    assert.equal(events.filter((e) => e.type === 'component').length, 0);
    assert.equal(events.filter((e) => e.type === 'narrative').length, 0);
    assert.equal(parser.fullText, text);
    const abandonedAt = events.findIndex((e) => e.type === 'abandoned');
    assert.ok(!events.slice(abandonedAt + 1).some((e) => e.type === 'component' || e.type === 'hero' || e.type === 'hero_done'));
  }
});

test('leading prose before the fence is tolerated', () => {
  const text = 'Sure, here you go.\n\n' + synth('T');
  const { events } = run(splitRandom(text, 7));
  assert.ok(!events.some((e) => e.type === 'abandoned'));
  assert.ok(events.some((e) => e.type === 'hero_done'));
});

test('no fence within first 400 non-whitespace chars abandons', () => {
  const text = 'x'.repeat(500) + '\n```json\n{"layout":[]}\n```\n';
  const { events } = run(splitRandom(text, 3));
  assert.equal(events.filter((e) => e.type === 'abandoned').length, 1);
});

test('plain text without fence: end() does not throw', () => {
  const p = new StreamLayoutParser();
  p.push('Just a short answer.');
  assert.doesNotThrow(() => p.end());
});

test('non-hero first component is emitted with index 0', () => {
  const text =
    '```json\n{"layout":[{"component":"StrategyCard","props":{"title":"a","content":"b","icon":"lightbulb"}}]}\n```\n\nN.\n';
  const { events } = run(splitRandom(text, 5));
  const c = events.filter((e) => e.type === 'component') as { index: number }[];
  assert.equal(c.length, 1);
  assert.equal(c[0].index, 0);
  assert.ok(!events.some((e) => e.type === 'hero_done'));
});
