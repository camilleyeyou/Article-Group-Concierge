import './lib';
import { isHeldOut } from './lib';
/**
 * Read-only latency probes for PERF-01 (embeddings only are paid, fractions of a cent).
 *   a) trivial Supabase REST call RTT vs hybrid_search_v2 RPC time
 *   b) embedding latency OpenRouter vs OpenAI direct (+ vector diff)
 *   c) RPC alone vs RPC with the side fetches (visual assets, taxonomy, metrics) running concurrently
 */
import * as fs from 'fs';
import { supabase, generateEmbedding, hybridSearchV2, searchVisualAssets } from '../src/lib/supabase';
import { embeddingConfig } from '../src/lib/llm-config';

const qs: { queries: { id: string; text: string; held_out?: boolean }[] } = JSON.parse(fs.readFileSync('eval/queries.json', 'utf8'));
const texts = qs.queries.filter(q => !isHeldOut(q)).slice(10, 20).map(q => q.text);
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const ms = async <T,>(f: () => Promise<T>) => { const t = performance.now(); const r = await f(); return [performance.now() - t, r] as const; };

async function embedVia(baseURL: string, apiKey: string, model: string, input: string) {
  const [t, r] = await ms(async () => {
    const res = await fetch(`${baseURL}/embeddings`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input }),
    });
    if (!res.ok) throw new Error(`${baseURL} ${res.status}`);
    return (await res.json()).data[0].embedding as number[];
  });
  return { t, v: r };
}

async function main() {
  // a) trivial RTT
  await supabase.from('documents').select('id').limit(1); // connection warm
  const rtt: number[] = [];
  for (let i = 0; i < 8; i++) rtt.push((await ms(async () => supabase.from('documents').select('id').limit(1)))[0]);
  console.log(`a) trivial supabase select RTT: median ${med(rtt).toFixed(0)} ms  [${rtt.map(x => x.toFixed(0)).join(',')}]`);

  // RPC alone (embedding pre-warmed into the cache so only the RPC is timed)
  const rpcAlone: number[] = [];
  for (const t of texts.slice(0, 5)) {
    await generateEmbedding(t);
    rpcAlone.push((await ms(() => hybridSearchV2({ query: t })))[0]);
  }
  console.log(`c) RPC alone (embedding cached): median ${med(rpcAlone).toFixed(0)} ms  [${rpcAlone.map(x => x.toFixed(0)).join(',')}]`);
  const rpcSide: number[] = [];
  for (const t of texts.slice(5, 10)) {
    await generateEmbedding(t);
    const side = Promise.all([searchVisualAssets({ query: t, matchCount: 5 }), supabase.from('documents').select('id').limit(1)]);
    rpcSide.push((await ms(() => hybridSearchV2({ query: t })))[0]);
    await side;
  }
  console.log(`c) RPC with side fetches concurrent: median ${med(rpcSide).toFixed(0)} ms  [${rpcSide.map(x => x.toFixed(0)).join(',')}]`);

  // b) embeddings
  const cfg = embeddingConfig();
  console.log(`b) current provider baseURL host: ${new URL(cfg.baseURL).host}, model ${cfg.model}`);
  const orT: number[] = [];
  const oaT: number[] = [];
  const diffs: number[] = [];
  const oaKey = process.env.OPENAI_API_KEY;
  for (const t of texts.slice(0, 5).map(x => x + ' ')) {
    const a = await embedVia(cfg.baseURL, cfg.apiKey ?? "", cfg.model, t);
    orT.push(a.t);
    if (oaKey) {
      try {
        const b = await embedVia('https://api.openai.com/v1', oaKey, 'text-embedding-3-small', t);
        oaT.push(b.t);
        diffs.push(Math.max(...a.v.map((x, i) => Math.abs(x - b.v[i]))));
      } catch (e) { console.log('   openai direct failed:', (e as Error).message); break; }
    }
  }
  console.log(`b) embedding via current provider: median ${med(orT).toFixed(0)} ms [${orT.map(x => x.toFixed(0)).join(',')}]`);
  if (oaT.length) console.log(`b) embedding OpenAI direct: median ${med(oaT).toFixed(0)} ms [${oaT.map(x => x.toFixed(0)).join(',')}]; max abs vector diff ${Math.max(...diffs).toExponential(2)}`);
  else console.log('b) OpenAI direct unavailable');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
