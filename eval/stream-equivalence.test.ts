import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from './fixtures/model-raw-samples.json';
import {
  orchestrateStream,
  orchestratorCacheKey,
  parseOrchestratorResponse,
  type OrchestratorStreamEvent,
  type RawModelEvent,
} from '../src/lib/orchestrator';
import { postProcessOutput } from '../src/lib/layout-postprocess';
import { cache, CACHE_PREFIXES, CACHE_TTL } from '../src/lib/cache';
import type { Catalogue } from '../src/lib/catalogue';
import type { OrchestratorInput, OrchestratorOutput } from '../src/types';

const samples = fixture.samples as { id: string; text: string }[];

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function chunks(text: string, seed: number): string[] {
  const r = rng(seed);
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const n = 1 + Math.floor(r() * 60);
    out.push(text.slice(i, i + n));
    i += n;
  }
  return out;
}

function rawEvents(text: string, seed: number, stop = 'end_turn'): RawModelEvent[] {
  const evs: RawModelEvent[] = [
    { type: 'message_start', message: { usage: { input_tokens: 900, cache_read_input_tokens: 12160 } } },
    { type: 'ping' },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'hmm' } },
    { type: 'content_block_stop', index: 0 },
  ];
  if (text) {
    evs.push({ type: 'content_block_start', index: 1, content_block: { type: 'text' } });
    for (const c of chunks(text, seed)) {
      evs.push({ type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: c } });
    }
    evs.push({ type: 'content_block_stop', index: 1 });
  }
  evs.push({ type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 700, cost: 0.03 } });
  evs.push({ type: 'message_stop' });
  return evs;
}

function fake(evs: RawModelEvent[], bodies?: Record<string, unknown>[]) {
  return async (body: Record<string, unknown>) => {
    bodies?.push(body);
    return (async function* () {
      for (const e of evs) yield e;
    })() as AsyncIterable<RawModelEvent>;
  };
}

function teaserSlugs(text: string): string[] {
  const m = text.match(/```json\s*([\s\S]*?)\s*```/)!;
  const layout = JSON.parse(m[1]).layout as { component: string; props: { slug?: string } }[];
  return layout.filter(i => i.component === 'CaseStudyTeaser').map(i => i.props.slug!).filter(Boolean);
}

function catalogueFor(text: string): Catalogue {
  const tagsBySlug = new Map<string, { capabilities: string[]; industries: string[] }>();
  for (const slug of teaserSlugs(text)) {
    tagsBySlug.set(slug, { capabilities: ['db-cap-' + slug], industries: ['db-ind-' + slug] });
  }
  return { text: 'CATALOGUE', version: 'v-test', tagsBySlug, deliverablesBySlug: new Map() } as Catalogue;
}

const input = (over: Partial<OrchestratorInput> = {}): OrchestratorInput => ({
  userQuery: 'tell me about equivalence ' + Math.random(),
  context: { chunks: [], visualAssets: [], relatedMetrics: [] } as any,
  skipCache: true,
  ...over,
});

async function collect(gen: AsyncGenerator<OrchestratorStreamEvent>) {
  const out: OrchestratorStreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

for (const sample of samples) {
  test(`stream final equals postProcessOutput for ${sample.id}`, async () => {
    for (const seed of [1, 7, 42]) {
      const cat = catalogueFor(sample.text);
      const seen: RawModelEvent[] = [];
      const events = await collect(
        orchestrateStream(input(), {
          catalogue: cat,
          createEvents: fake(rawEvents(sample.text, seed)),
          onRawEvent: ev => seen.push(ev),
        }),
      );
      assert.equal(seen.length, rawEvents(sample.text, seed).length);
      assert.deepEqual(seen, rawEvents(sample.text, seed));

      const final = events[events.length - 1];
      assert.equal(final.type, 'final');
      if (final.type !== 'final') return;
      assert.equal(final.cached, false);
      const expected = postProcessOutput(parseOrchestratorResponse(sample.text), sample.text, cat.tagsBySlug);
      for (const k of ['layoutPlan', 'explanation', 'suggestedFollowUps', 'contactCTA', 'rawResponse', 'modelRawResponse'] as const) {
        assert.deepEqual(final.output[k], expected[k], k);
      }
      assert.equal(final.output.usage?.cache_read_input_tokens, 12160);
      assert.equal(final.output.usage?.output_tokens, 700);
      assert.equal(final.output.usage?.cost, 0.03);

      // teaser components carry DB tags only
      for (const e of events) {
        if (e.type === 'component' && e.component === 'CaseStudyTeaser') {
          const slug = (e.props as { slug: string }).slug;
          const t = cat.tagsBySlug.get(slug);
          assert.deepEqual((e.props as any).capabilities, t ? t.capabilities : undefined);
          assert.deepEqual((e.props as any).industries, t ? t.industries : undefined);
        }
      }
      // hero/hero_done precede the first non-hero component
      const firstComp = events.findIndex(e => e.type === 'component');
      const firstHero = events.findIndex(e => e.type === 'hero' || e.type === 'hero_done');
      if (firstComp >= 0) assert.ok(firstHero >= 0 && firstHero < firstComp);
    }
  });
}

test('no text_delta throws No text content; max_tokens named', async () => {
  await assert.rejects(
    collect(orchestrateStream(input(), { catalogue: null, createEvents: fake(rawEvents('', 1)) })),
    /No text content/,
  );
  await assert.rejects(
    collect(orchestrateStream(input(), { catalogue: null, createEvents: fake(rawEvents('', 1, 'max_tokens')) })),
    /max_tokens/,
  );
});

test('raw error event throws its message', async () => {
  const evs: RawModelEvent[] = [{ type: 'message_start', message: {} }, { type: 'error', error: { message: 'overloaded boom' } }];
  await assert.rejects(
    collect(orchestrateStream(input(), { catalogue: null, createEvents: fake(evs) })),
    /overloaded boom/,
  );
});

test('cache hit skips the model and replays events with cached: true', async () => {
  const sample = samples[0];
  const cat = catalogueFor(sample.text);
  const inp = input({ skipCache: false });
  const output: OrchestratorOutput = postProcessOutput(parseOrchestratorResponse(sample.text), sample.text, cat.tagsBySlug);
  cache.set(CACHE_PREFIXES.ORCHESTRATOR, orchestratorCacheKey(inp, cat.version), output, CACHE_TTL.ORCHESTRATOR);
  let called = 0;
  const events = await collect(
    orchestrateStream(inp, {
      catalogue: cat,
      createEvents: async () => {
        called++;
        throw new Error('should not be called');
      },
    }),
  );
  assert.equal(called, 0);
  const types = events.map(e => e.type);
  assert.equal(types[0], 'hero');
  assert.equal(types[1], 'hero_done');
  assert.equal(types.filter(t => t === 'narrative').length, 1);
  assert.equal(types[types.length - 1], 'final');
  const final = events[events.length - 1];
  assert.ok(final.type === 'final' && final.cached === true);
  assert.equal(types.filter(t => t === 'component').length, output.layoutPlan.layout.length - 1);
});

test('generation params: default has no thinking/output_config; between_tools adds thinking', async () => {
  const sample = samples[1];
  const bodies: Record<string, unknown>[] = [];
  await collect(
    orchestrateStream(input(), {
      catalogue: null,
      generation: { mode: 'default', effort: null },
      createEvents: fake(rawEvents(sample.text, 3), bodies),
    }),
  );
  assert.ok(!('thinking' in bodies[0]));
  assert.ok(!('output_config' in bodies[0]));
  await collect(
    orchestrateStream(input(), {
      catalogue: null,
      generation: { mode: 'between_tools', effort: null },
      createEvents: fake(rawEvents(sample.text, 3), bodies),
    }),
  );
  assert.deepEqual(bodies[1].thinking, { type: 'between_tools' });
  assert.ok(!('output_config' in bodies[1]));
});
