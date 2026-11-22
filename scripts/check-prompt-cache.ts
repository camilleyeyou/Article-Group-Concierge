/**
 * RETR-04 check: two identical generation calls; the second must read the
 * catalogue prefix from cache. Costs about $0.03.
 * Usage: npx tsx scripts/check-prompt-cache.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { anthropicClientOptions } = await import('../src/lib/llm-config');
  const { getCatalogue } = await import('../src/lib/catalogue');
  const { buildSystemBlocks, GENERATION_MODEL } = await import('../src/lib/orchestrator');

  const t0 = Date.now();
  const cat = await getCatalogue();
  console.log(`cold getCatalogue: ${Date.now() - t0} ms`);
  if (!cat) { console.error('FAIL: catalogue unavailable'); process.exit(1); }
  console.log(`catalogue: ${cat.text.length} chars, ${cat.text.split('\n').filter(l => l.startsWith('- ')).length} studies, version ${cat.version}`);

  const anthropic = new Anthropic(anthropicClientOptions());
  const results: Array<{ write: number | null; read: number | null; uncached: number | null; cost: number | null }> = [];
  for (let i = 1; i <= 2; i++) {
    const res = await anthropic.messages.create({
      model: GENERATION_MODEL,
      max_tokens: 4000,
      system: buildSystemBlocks(cat.text) as any,
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
    });
    const u = res.usage as unknown as Record<string, number | undefined>;
    const r = { write: u.cache_creation_input_tokens ?? null, read: u.cache_read_input_tokens ?? null, uncached: u.input_tokens ?? null, cost: u.cost ?? null };
    console.log(`call ${i}:`, JSON.stringify(r));
    results.push(r);
  }
  const ok = (results[1].read ?? 0) >= 512 && ((results[0].write ?? 0) > 0 || (results[0].read ?? 0) > 0);
  if (ok) { console.log('PASS'); return; }
  console.error('FAIL. Hints: prefix >= 512 tokens? If ttl "1h" is rejected, retry with plain { type: "ephemeral" } and record it. Check OpenRouter /api/v1/generation?id=<id> for provider routing.');
  process.exit(1);
}
main().catch(e => { console.error('FAIL:', e?.message ?? e); process.exit(1); });
