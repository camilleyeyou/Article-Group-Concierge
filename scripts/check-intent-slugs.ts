/**
 * DATA-04: verifies every slug in src/lib/intent-keywords.ts exists in the DB (read-only).
 *   npx tsx scripts/check-intent-slugs.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { createClient } from '@supabase/supabase-js';
import { allIntentSlugs } from '../src/lib/intent-keywords';

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const wanted = allIntentSlugs();
  let bad = false;
  for (const [table, key] of [['capabilities', 'capabilities'], ['industries', 'industries']] as const) {
    const { data, error } = await sb.from(table).select('slug');
    if (error) throw new Error(`${table}: ${error.message}`);
    const have = new Set((data ?? []).map((r: any) => r.slug as string));
    const slugs = wanted[key];
    const missing = slugs.filter((s) => !have.has(s));
    console.log(`${table}: ${slugs.length - missing.length}/${slugs.length} exist`);
    for (const m of missing) console.log(`  MISSING ${table} slug: ${m}`);
    if (missing.length) bad = true;
  }
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
