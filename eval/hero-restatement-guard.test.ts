/** Phase 7 HERO-03: hero restatement guard wiring on the stream route and both kill switches. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateStream, type OrchestratorStreamEvent, type RawModelEvent } from '../src/lib/orchestrator';
import { OUTPUT_GUARD_VERSION } from '../src/lib/output-guard';
import type { OrchestratorInput } from '../src/types';

const MAIN_HERO = { title: 'Main hero', subtitle: 'Main sub', challengeSummary: 'Main summary', backgroundVariant: 'dark' };
const RESTATING = "You're asking about pricing.";
const fastHero = (challengeSummary: string) => ({ title: 'Fast hero', subtitle: 'Fast sub', challengeSummary, backgroundVariant: 'dark' });

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

function source(evs: RawModelEvent[], delayMs: number) {
  return async (_body: Record<string, unknown>, signal?: AbortSignal) =>
    (async function* () {
      await sleep(delayMs);
      for (const e of evs) {
        if (signal?.aborted) return;
        yield e;
        await sleep(1);
      }
    })() as AsyncIterable<RawModelEvent>;
}

const input = (): OrchestratorInput => ({
  userQuery: 'how much do u charge',
  context: { chunks: [], visualAssets: [], relatedMetrics: [] } as any,
  skipCache: true,
});

async function run(summary: string) {
  const out: OrchestratorStreamEvent[] = [];
  for await (const e of orchestrateStream(input(), {
    catalogue: null,
    heroPass: true,
    createEvents: source(textEvents(layoutText(MAIN_HERO)), 60),
    createHeroEvents: source(textEvents(layoutText(fastHero(summary))), 5),
  })) out.push(e);
  return out;
}

const finalOf = (out: OrchestratorStreamEvent[]) =>
  (out.find(e => e.type === 'final') as Extract<OrchestratorStreamEvent, { type: 'final' }>).output;

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const k of ['HERO_RESTATEMENT_GUARD_ENABLED', 'OUTPUT_GUARD_ENABLED']) saved[k] = process.env[k];
  try {
    for (const k of Object.keys(saved)) {
      if (vars[k] === undefined) delete process.env[k];
      else process.env[k] = vars[k];
    }
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('stream: restating fast hero summary is removed from layout and rawResponse, guard v2 records it', async () => {
  await withEnv({}, async () => {
    const out = finalOf(await run(RESTATING));
    const props = out.layoutPlan.layout[0].props as any;
    assert.equal(props.title, 'Fast hero');
    assert.ok(!('challengeSummary' in props));
    assert.ok(!(out.rawResponse ?? '').includes(RESTATING));
    assert.ok((out.rawResponse ?? '').includes('Fast hero'));
    assert.equal(out.guard?.version, 2);
    assert.equal(OUTPUT_GUARD_VERSION, 2);
    const hr = out.guard!.changes.filter(c => c.rule === 'hero_restatement');
    assert.equal(hr.length, 1);
    assert.equal(hr[0].action, 'drop_field');
    assert.equal(hr[0].before, RESTATING);
  });
});

test('stream: HERO_RESTATEMENT_GUARD_ENABLED=false keeps the summary', async () => {
  await withEnv({ HERO_RESTATEMENT_GUARD_ENABLED: 'false' }, async () => {
    const out = finalOf(await run(RESTATING));
    assert.equal((out.layoutPlan.layout[0].props as any).challengeSummary, RESTATING);
    assert.ok((out.rawResponse ?? '').includes(RESTATING));
    assert.ok(!(out.guard?.changes ?? []).some(c => c.rule === 'hero_restatement'));
  });
});

test('stream: OUTPUT_GUARD_ENABLED=false keeps the summary', async () => {
  await withEnv({ OUTPUT_GUARD_ENABLED: 'false' }, async () => {
    const out = finalOf(await run(RESTATING));
    assert.equal((out.layoutPlan.layout[0].props as any).challengeSummary, RESTATING);
    assert.ok((out.rawResponse ?? '').includes(RESTATING));
    assert.ok(!(out.guard?.changes ?? []).some(c => c.rule === 'hero_restatement'));
  });
});

test('stream: non-restating fast hero unchanged, rawResponse carries it', async () => {
  await withEnv({}, async () => {
    const out = finalOf(await run('Fast summary'));
    assert.equal((out.layoutPlan.layout[0].props as any).challengeSummary, 'Fast summary');
    assert.ok((out.rawResponse ?? '').includes('Fast summary'));
    assert.ok(!(out.guard?.changes ?? []).some(c => c.rule === 'hero_restatement'));
  });
});

test('stream: hero preview events still yielded before final, unchanged (no buffering)', async () => {
  await withEnv({}, async () => {
    const out = await run(RESTATING);
    const doneIdx = out.findIndex(e => e.type === 'hero_done');
    const finalIdx = out.findIndex(e => e.type === 'final');
    assert.ok(doneIdx >= 0 && doneIdx < finalIdx);
    const done = out[doneIdx] as Extract<OrchestratorStreamEvent, { type: 'hero_done' }>;
    assert.equal(done.props.title, 'Fast hero');
    assert.equal(done.props.challengeSummary, RESTATING);
    assert.ok(out.findIndex(e => e.type === 'hero') < doneIdx);
  });
});
