/**
 * Snapshot every indexed case study (title, client, tags, video status, full chunk text)
 * into .planning/phases/06-proof/06-CATALOGUE.md (Phase 6, D-603 label evidence).
 *
 * Usage: npx tsx scripts/catalogue-snapshot.ts
 * Read-only against the DB.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { isPlayableVideoUrl } from '../src/lib/concierge-config';

const OUT = path.resolve('.planning/phases/06-proof/06-CATALOGUE.md');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: docs, error } = await sb
    .from('documents')
    .select('id, title, slug, client_name, vimeo_url, hero_video_url')
    .eq('doc_type', 'case_study')
    .order('slug');
  if (error) throw error;

  const chunks: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e } = await sb
      .from('content_chunks')
      .select('document_id, chunk_index, content')
      .not('embedding', 'is', null)
      .order('document_id')
      .order('chunk_index')
      .range(from, from + 999);
    if (e) throw e;
    chunks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const byDoc = new Map<string, string[]>();
  for (const c of chunks) {
    const a = byDoc.get(c.document_id) ?? [];
    a.push(c.content ?? '');
    byDoc.set(c.document_id, a);
  }
  const tags = async (table: string, rel: string) => {
    const { data, error: e } = await sb.from(table).select(`document_id, ${rel}(name)`);
    if (e) throw e;
    const m = new Map<string, string[]>();
    for (const r of (data ?? []) as any[]) {
      const n = r[rel]?.name;
      if (!n) continue;
      m.set(r.document_id, [...(m.get(r.document_id) ?? []), n]);
    }
    return m;
  };
  const caps = await tags('document_capabilities', 'capabilities');
  const inds = await tags('document_industries', 'industries');

  const out: string[] = [`# Phase 6 catalogue snapshot`, '', `Generated ${new Date().toISOString()} from the DB (read-only). ${docs!.length} case studies.`, ''];
  for (const d of docs as any[]) {
    const url = d.hero_video_url || d.vimeo_url;
    const video = !url ? 'none' : isPlayableVideoUrl(url) ? 'playable' : 'unplayable';
    out.push(`## ${d.slug}`, '', `- title: ${d.title}`, `- client: ${d.client_name ?? ''}`,
      `- tags: capabilities=[${(caps.get(d.id) ?? []).join(', ')}] industries=[${(inds.get(d.id) ?? []).join(', ')}]`,
      `- video: ${video}`, '', (byDoc.get(d.id) ?? []).join('\n\n'), '');
  }
  fs.writeFileSync(OUT, out.join('\n'));
  console.log(`Wrote ${OUT} (${docs!.length} studies)`);
}
main().catch(e => { console.error(e); process.exit(1); });
