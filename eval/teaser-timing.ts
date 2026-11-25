import './lib';
/**
 * Teaser latency harness (PERF-01). Zero LLM spend: posts { teasersOnly: true } to /api/chat/stream,
 * which stops after the teaser event (needs EVAL_DEBUG=true on the server; --restart sets it for the
 * server it spawns). Embeddings are the only paid call.
 *
 *   npx tsx eval/teaser-timing.ts --restart --runs 3 --label baseline [--baseline snapshot.json] [--out dir] [--port 3100]
 * Without --restart it targets EVAL_BASE_URL (default http://localhost:3000).
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { argValue, hasFlag, isHeldOut } from './lib';
import { SseDecoder, type StreamEvent } from '../src/lib/stream-events';

const SET = ['p1-q01', 'p1-q03', 'p1-q10', 'p2-q01', 'p2-q04', 'p3-q02', 'p4-q01', 'p4-q05', 'p1-q09', 'p2-q08'];
const WARMUP = 'What kinds of work does Article Group do?';

interface Sample {
  id: string;
  run: number;
  cold: boolean;
  t_first_byte: number;
  t_event: number;
  suppressed: string | null;
  marks: Record<string, number>;
  chunkKeys: string[];
  teaserSlugs: string[];
}
type Snap = Record<string, { suppressed: string | null; teaserSlugs: string[]; chunkKeys: string[] }>;

const medianTrue = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return NaN;
  const m = s.length / 2;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[m - 1] + s[m]) / 2;
};
const p90 = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.ceil(s.length * 0.9) - 1)] : NaN;
};

async function post(base: string, query: string) {
  const t0 = performance.now();
  const res = await fetch(`${base}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, teasersOnly: true }),
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new SseDecoder();
  const td = new TextDecoder();
  let tFirst = -1;
  let tEvent = -1;
  let timing: Extract<StreamEvent, { type: 'timing' }> | null = null;
  let evType: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const t = performance.now() - t0;
    if (tFirst < 0) tFirst = t;
    for (const ev of dec.push(td.decode(value, { stream: true }))) {
      if ((ev.type === 'teasers' || ev.type === 'suppressed') && tEvent < 0) {
        tEvent = t;
        evType = ev.type;
      }
      if (ev.type === 'timing') timing = ev;
      if (ev.type === 'error') throw new Error(`stream error ${ev.errorCode}`);
    }
  }
  return { t_first_byte: tFirst, t_event: tEvent, timing, evType };
}

async function startServer(port: number): Promise<ChildProcess> {
  const child = spawn('npx', ['next', 'start', '-p', String(port)], {
    env: { ...process.env, EVAL_DEBUG: 'true', PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr?.on('data', () => {});
  child.stdout?.on('data', () => {});
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://localhost:${port}/`);
      if (r.status < 500) {
        await r.arrayBuffer();
        return child;
      }
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 500));
  }
  child.kill();
  throw new Error('server did not start');
}

const stage = (m: Record<string, number>) => ({
  body: m.body_parsed,
  pre_embed: m.embed_start - m.body_parsed,
  embed: m.embed_end - m.embed_start,
  rpc: m.rpc_end - m.rpc_start,
  post_rpc: m.chunks_ready - m.rpc_end,
  catWait: Math.max(0, m.catalogue_ready - m.chunks_ready),
  decide: m.decided - Math.max(m.chunks_ready, m.catalogue_ready),
  server: m.teasers_sent,
});

async function main() {
  if (hasFlag('--help')) {
    console.log('See header of eval/teaser-timing.ts');
    return;
  }
  const label = argValue('--label') ?? 'run';
  const runs = Number(argValue('--runs') ?? 3);
  const port = Number(argValue('--port') ?? 3100);
  const restart = hasFlag('--restart');
  const baselinePath = argValue('--baseline');
  const outDir =
    argValue('--out') ?? path.join('eval/results', `teaser-timing-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(outDir, { recursive: true });
  const base = restart ? `http://localhost:${port}` : (process.env.EVAL_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const qs: { queries: { id: string; text: string; held_out?: boolean }[] } = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8'));
  const text = new Map(qs.queries.filter(q => !isHeldOut(q)).map(q => [q.id, q.text]));
  const samples: Sample[] = [];

  for (let run = 0; run < runs; run++) {
    const k = run % SET.length;
    const order = [...SET.slice(k), ...SET.slice(0, k)];
    const server = restart ? await startServer(port) : null;
    try {
      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        if (i === 1) await post(base, WARMUP);
        const r = await post(base, text.get(id)!);
        if (!r.timing) throw new Error('no timing event (is EVAL_DEBUG=true on the server?)');
        samples.push({
          id, run, cold: i === 0,
          t_first_byte: r.t_first_byte, t_event: r.t_event, suppressed: r.timing.suppressed,
          marks: r.timing.marks, chunkKeys: r.timing.chunkKeys, teaserSlugs: r.timing.teaserSlugs,
        });
        process.stdout.write(`run ${run} ${id}${i === 0 ? ' (cold)' : ''} t_event=${r.t_event.toFixed(0)}ms ${r.evType}\n`);
      }
    } finally {
      server?.kill();
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const snap: Snap = {};
  const diffs: string[] = [];
  for (const s of samples) {
    const cur = { suppressed: s.suppressed, teaserSlugs: s.teaserSlugs, chunkKeys: s.chunkKeys };
    if (!snap[s.id]) snap[s.id] = cur;
    else if (JSON.stringify(snap[s.id]) !== JSON.stringify(cur)) diffs.push(`${s.id}: differs between runs`);
  }
  fs.writeFileSync(path.join(outDir, 'runs.json'), JSON.stringify(samples, null, 2));
  fs.writeFileSync(path.join(outDir, 'snapshot.json'), JSON.stringify(snap, null, 2));

  const report = (title: string, ss: Sample[]) => {
    console.log(`\n${title} (n=${ss.length})`);
    if (!ss.length) return;
    const st = ss.map(s => ({ s, st: stage(s.marks) }));
    const col = (name: string, f: (x: (typeof st)[number]) => number) => {
      const v = st.map(f).filter(Number.isFinite);
      console.log(`  ${name.padEnd(30)} median ${medianTrue(v).toFixed(0).padStart(5)}  p90 ${p90(v).toFixed(0).padStart(5)}`);
    };
    col('client t_first_byte', x => x.s.t_first_byte);
    col('client t_event (teasers)', x => x.s.t_event);
    col('server total (teasers_sent)', x => x.st.server);
    col('  body parse', x => x.st.body);
    col('  pre-embed gap', x => x.st.pre_embed);
    col('  embedding', x => x.st.embed);
    col('  rpc', x => x.st.rpc);
    col('  post-rpc to chunks_ready', x => x.st.post_rpc);
    col('  catalogue wait', x => x.st.catWait);
    col('  decide', x => x.st.decide);
    col('client minus server', x => x.s.t_event - x.st.server);
  };
  report('WARM non-suppressed', samples.filter(s => !s.cold && !s.suppressed));
  report('WARM suppressed', samples.filter(s => !s.cold && s.suppressed));
  report('COLD (first request after start)', samples.filter(s => s.cold));
  for (const c of samples.filter(s => s.cold)) console.log(`  cold ${c.id}: ${JSON.stringify(c.marks)}`);

  let exit = 0;
  if (diffs.length) {
    console.log(`\nDETERMINISM FAIL within this run set:\n${diffs.join('\n')}`);
    exit = 1;
  }
  if (baselinePath) {
    const b: Snap = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const bad = SET.filter(id => JSON.stringify(b[id]) !== JSON.stringify(snap[id]));
    if (bad.length) {
      console.log(`\nSNAPSHOT DIFF vs baseline: ${bad.join(', ')}`);
      exit = 1;
    } else console.log('\nSnapshot identical to baseline for all queries.');
  }
  console.log(`\nwrote ${outDir}`);
  process.exit(exit);
}
main().catch(e => {
  console.error(e);
  process.exit(2);
});
