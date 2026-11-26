import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateStream, type OrchestratorStreamEvent, type RawModelEvent } from '../src/lib/orchestrator';
import { heroPassInstruction } from '../src/lib/concierge-config';
import type { OrchestratorInput } from '../src/types';

const MAIN_HERO = { title: 'Main hero', subtitle: 'Main sub', challengeSummary: 'Main summary', backgroundVariant: 'dark' };
const FAST_HERO = { title: 'Fast hero', subtitle: 'Fast sub', challengeSummary: 'Fast summary', backgroundVariant: 'dark' };

const layoutText = (hero: object) =>
  '```json\n' +
  JSON.stringify({ layout: [{ component: 'HeroBlock', props: hero }, { component: 'StrategyCard', props: { title: 'S', content: 'c', icon: 'target' } }] }) +
  '\n```\n\nOne sentence. Two sentences.\n\n**Want to explore further?**\n- Is this a question one?\n- Is this a question two?';

function textEvents(text: string): RawModelEvent[] {
  const evs: RawModelEvent[] = [{ type: 'message_start', message: { usage: { input_tokens: 10 } } }];
  for (let i = 0; i < text.length; i += 25) evs.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(i, i + 25) } });
  evs.push({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } });
  return evs;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function source(evs: RawModelEvent[], delayMs: number, bodies?: Record<string, unknown>[], failAfter?: number) {
  return async (body: Record<string, unknown>, signal?: AbortSignal) => {
    bodies?.push(body);
    return (async function* () {
      await sleep(delayMs);
      let n = 0;
      for (const e of evs) {
        if (signal?.aborted) return;
        if (failAfter !== undefined && n++ >= failAfter) throw new Error('boom');
        yield e;
        await sleep(1);
      }
    })() as AsyncIterable<RawModelEvent>;
  };
}

const input = (): OrchestratorInput => ({
  userQuery: 'hero pass ' + Math.random(),
  context: { chunks: [], visualAssets: [], relatedMetrics: [] } as any,
  skipCache: true,
});

async function run(opts: Parameters<typeof orchestrateStream>[1]) {
  const out: OrchestratorStreamEvent[] = [];
  for await (const e of orchestrateStream(input(), { catalogue: null, ...opts })) out.push(e);
  return out;
}

test('fast hero is shown first, main hero is dropped, final carries the fast hero', async () => {
  const mainBodies: Record<string, unknown>[] = [];
  const heroBodies: Record<string, unknown>[] = [];
  const out = await run({
    heroPass: true,
    createEvents: source(textEvents(layoutText(MAIN_HERO)), 60, mainBodies),
    createHeroEvents: source(textEvents(layoutText(FAST_HERO)), 5, heroBodies),
  });
  const heroDone = out.filter(e => e.type === 'hero_done') as Extract<OrchestratorStreamEvent, { type: 'hero_done' }>[];
  assert.equal(heroDone.length, 1);
  assert.equal(heroDone[0].props.title, 'Fast hero');
  assert.ok(out.every(e => e.type !== 'hero' || e.title !== 'Main hero'));
  assert.ok(out.findIndex(e => e.type === 'hero_done') < out.findIndex(e => e.type === 'component'));
  const final = out.find(e => e.type === 'final') as Extract<OrchestratorStreamEvent, { type: 'final' }>;
  assert.equal((final.output.layoutPlan.layout[0].props as any).title, 'Fast hero');
  assert.equal(final.output.layoutPlan.layout[1].component, 'StrategyCard');
  // main body untouched (no effort params, default mode); hero body low effort, capped, with the instruction
  assert.equal(mainBodies[0].output_config, undefined);
  assert.deepEqual(heroBodies[0].output_config, { effort: 'low' });
  assert.equal(heroBodies[0].max_tokens, 700);
  const msgs = heroBodies[0].messages as { content: string }[];
  assert.ok(msgs[msgs.length - 1].content.endsWith(heroPassInstruction()));
  assert.deepEqual(heroBodies[0].system, mainBodies[0].system);
});

test('hero pass failure falls back to the main hero', async () => {
  const out = await run({
    heroPass: true,
    createEvents: source(textEvents(layoutText(MAIN_HERO)), 40),
    createHeroEvents: async () => {
      throw new Error('hero pass down');
    },
  });
  const heroDone = out.filter(e => e.type === 'hero_done') as Extract<OrchestratorStreamEvent, { type: 'hero_done' }>[];
  assert.equal(heroDone.length, 1);
  assert.equal(heroDone[0].props.title, 'Main hero');
  const final = out.find(e => e.type === 'final') as Extract<OrchestratorStreamEvent, { type: 'final' }>;
  assert.equal((final.output.layoutPlan.layout[0].props as any).title, 'Main hero');
});

test('hero pass off, or createEvents injected alone: behaviour is the plain stream', async () => {
  for (const heroPass of [false, undefined]) {
    const out = await run({ heroPass, createEvents: source(textEvents(layoutText(MAIN_HERO)), 1) });
    const heroDone = out.filter(e => e.type === 'hero_done') as Extract<OrchestratorStreamEvent, { type: 'hero_done' }>[];
    assert.equal(heroDone.length, 1);
    assert.equal(heroDone[0].props.title, 'Main hero');
  }
});

test('main error propagates and aborts the hero pass', async () => {
  await assert.rejects(
    run({
      heroPass: true,
      createEvents: source(textEvents(layoutText(MAIN_HERO)), 1, undefined, 2),
      createHeroEvents: source(textEvents(layoutText(FAST_HERO)), 200),
    }),
    /boom/
  );
});

const finalOf = (out: OrchestratorStreamEvent[]) =>
  (out.find(e => e.type === 'final') as Extract<OrchestratorStreamEvent, { type: 'final' }>).output;

test('fast hero is the hero in rawResponse (grader view)', async () => {
  const out = await run({
    heroPass: true,
    createEvents: source(textEvents(layoutText(MAIN_HERO)), 60),
    createHeroEvents: source(textEvents(layoutText(FAST_HERO)), 5),
  });
  const f = finalOf(out);
  assert.ok(f.rawResponse!.includes('"challengeSummary": "Fast summary"'));
  assert.ok(!f.rawResponse!.includes('Main summary'));
});

test('a leak sentence in the fast hero is guarded in layout and rawResponse', async () => {
  const leaky = { ...FAST_HERO, challengeSummary: 'Nothing we retrieved fits your question. Here is our closest work.' };
  const out = await run({
    heroPass: true,
    createEvents: source(textEvents(layoutText(MAIN_HERO)), 60),
    createHeroEvents: source(textEvents(layoutText(leaky)), 5),
  });
  const f = finalOf(out);
  assert.equal((f.layoutPlan.layout[0].props as any).challengeSummary, 'Here is our closest work.');
  assert.ok(f.rawResponse!.includes('"challengeSummary": "Here is our closest work."'));
  assert.ok(f.guard!.changes.some(c => c.field === 'layout[0].HeroBlock.challengeSummary'));
});

test('guarded narrative stays guarded in rawResponse after the fast hero swap', async () => {
  const text =
    '```json\n' +
    JSON.stringify({ layout: [{ component: 'HeroBlock', props: MAIN_HERO }, { component: 'StrategyCard', props: { title: 'S', content: 'c', icon: 'target' } }] }) +
    "\n```\n\nNothing we retrieved speaks to pricing, so we haven't shown client work. Price depends on scope. Our Strategy Lead can scope it with you.\n\n**Want to explore further?**\n- Is this a question one?\n- Is this a question two?";
  const out = await run({
    heroPass: true,
    createEvents: source(textEvents(text), 60),
    createHeroEvents: source(textEvents(layoutText(FAST_HERO)), 5),
  });
  const f = finalOf(out);
  assert.ok(!f.rawResponse!.includes('retrieved'));
  assert.ok(f.rawResponse!.includes('Price depends on scope.'));
  assert.ok(f.rawResponse!.includes('Fast summary'));
  assert.ok(!f.rawResponse!.includes('Main summary'));
  assert.ok(!f.explanation!.includes('retrieved'));
  assert.ok(f.explanation!.includes('Price depends on scope.'));
  assert.ok(f.modelRawResponse!.includes('retrieved'));
});
