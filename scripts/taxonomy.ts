/**
 * Capability/industry taxonomy tooling (Phase 2, DATA-03).
 *
 *   npx tsx scripts/taxonomy.ts --dump
 *   npx tsx scripts/taxonomy.ts --check [--against-db]
 *   npx tsx scripts/taxonomy.ts --apply --yes
 *   npx tsx scripts/taxonomy.ts --restore <backup file> --yes
 *
 * Never updates or deletes taxonomy rows (capabilities/industries); only inserts new slugs
 * and changes document link rows for case_study documents listed in the proposal.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const PROPOSAL = path.join(ROOT, 'data', 'taxonomy-proposal.json');
const BACKUP = path.join(ROOT, 'data', 'taxonomy-backup.json');
const DUMP = path.join(ROOT, 'data', '.cache', 'taxonomy-dump.json');
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function all(table: string, cols: string, filter?: (q: any) => any) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as any[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const norm = (s: string) =>
  s.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ').toLowerCase().trim();

async function loadState() {
  const docs = await all('documents', 'id, slug, title, client_name, doc_type');
  const caps = await all('capabilities', 'id, slug, name');
  const inds = await all('industries', 'id, slug, name');
  const dc = await all('document_capabilities', 'document_id, capability_id');
  const di = await all('document_industries', 'document_id, industry_id');
  return { docs, caps, inds, dc, di };
}

async function dump() {
  const { docs, caps, inds, dc, di } = await loadState();
  const capSlug = new Map(caps.map((c) => [c.id, c.slug]));
  const indSlug = new Map(inds.map((c) => [c.id, c.slug]));
  const cs = docs.filter((d) => d.doc_type === 'case_study');
  const chunks = await all('content_chunks', 'document_id, content, chunk_index');
  const byDoc = new Map<string, any[]>();
  for (const c of chunks) (byDoc.get(c.document_id) ?? byDoc.set(c.document_id, []).get(c.document_id)!).push(c);
  const out = cs.map((d) => ({
    id: d.id, slug: d.slug, client_name: d.client_name, title: d.title,
    current: {
      capabilities: dc.filter((r) => r.document_id === d.id).map((r) => capSlug.get(r.capability_id)),
      industries: di.filter((r) => r.document_id === d.id).map((r) => indSlug.get(r.industry_id)),
    },
    text: (byDoc.get(d.id) ?? []).sort((a, b) => a.chunk_index - b.chunk_index).map((c) => c.content).join('\n\n'),
  }));
  fs.writeFileSync(DUMP, JSON.stringify({ capabilities: caps.map((c) => c.slug), industries: inds.map((c) => c.slug), documents: out }, null, 2));
  console.log(`dumped ${out.length} case studies -> ${DUMP}`);
}

function dist(lists: string[][]) {
  const m: Record<string, number> = {};
  for (const l of lists) for (const s of l) m[s] = (m[s] ?? 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(', ');
}

async function check(againstDb: boolean): Promise<boolean> {
  const p = JSON.parse(fs.readFileSync(PROPOSAL, 'utf8'));
  const st = await loadState();
  const capSlug = new Map(st.caps.map((c) => [c.id, c.slug]));
  const indSlug = new Map(st.inds.map((c) => [c.id, c.slug]));
  const cs = st.docs.filter((d) => d.doc_type === 'case_study');
  const bySlug = new Map(st.docs.map((d) => [d.slug, d]));
  const errs: string[] = [];
  const existingCaps = new Set(st.caps.map((c) => c.slug));
  const existingInds = new Set(st.inds.map((c) => c.slug));
  const slugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const newCaps = new Set<string>((p.new_capabilities ?? []).map((c: any) => c.slug));
  const newInds = new Set<string>((p.new_industries ?? []).map((c: any) => c.slug));
  if (!againstDb) {
    for (const s of newCaps) { if (!slugRe.test(s)) errs.push(`bad new cap slug ${s}`); if (existingCaps.has(s)) errs.push(`new cap collides ${s}`); }
    for (const s of newInds) { if (!slugRe.test(s)) errs.push(`bad new ind slug ${s}`); if (existingInds.has(s)) errs.push(`new ind collides ${s}`); }
  }
  // (a) coverage
  const seen = new Map<string, number>();
  for (const d of p.documents) {
    seen.set(d.slug, (seen.get(d.slug) ?? 0) + 1);
    const row = bySlug.get(d.slug);
    if (!row) errs.push(`unknown doc ${d.slug}`);
    else if (row.doc_type !== 'case_study') errs.push(`non-case-study in proposal: ${d.slug}`);
  }
  for (const d of cs) { const n = seen.get(d.slug) ?? 0; if (n !== 1) errs.push(`case study ${d.slug} appears ${n}x`); }
  const chunks = againstDb ? [] : await all('content_chunks', 'document_id, content');
  const text = new Map<string, string>();
  for (const c of chunks) text.set(c.document_id, (text.get(c.document_id) ?? '') + '\n' + c.content);
  const validCap = (s: string) => existingCaps.has(s) || newCaps.has(s);
  const validInd = (s: string) => existingInds.has(s) || newInds.has(s);
  const flagged: string[] = [];
  const usedNewCaps = new Set<string>(), usedNewInds = new Set<string>();
  for (const d of p.documents) {
    const row = bySlug.get(d.slug);
    const caps = d.proposed.capabilities, inds = d.proposed.industries;
    if (caps.length > 3) errs.push(`${d.slug}: >3 capabilities`);
    if (inds.length > 2) errs.push(`${d.slug}: >2 industries`);
    if ((caps.length === 0 || inds.length === 0)) {
      if (!d.flag) errs.push(`${d.slug}: empty list without flag`); else flagged.push(`${d.slug}: ${d.flag}`);
    }
    if (!againstDb) {
      for (const [kind, list, ok] of [['cap', caps, validCap], ['ind', inds, validInd]] as const) {
        for (const l of list as any[]) {
          if (!ok(l.slug)) errs.push(`${d.slug}: unknown ${kind} slug ${l.slug}`);
          if (kind === 'cap' && newCaps.has(l.slug)) usedNewCaps.add(l.slug);
          if (kind === 'ind' && newInds.has(l.slug)) usedNewInds.add(l.slug);
          if (!l.user_asserted) {
            if (!l.quote) errs.push(`${d.slug}: ${l.slug} missing quote`);
            else if (!norm(text.get(row?.id) ?? '').includes(norm(l.quote))) errs.push(`${d.slug}: ${l.slug} quote not verbatim: "${l.quote}"`);
          }
        }
      }
    } else if (row) {
      const curC = st.dc.filter((r) => r.document_id === row.id).map((r) => capSlug.get(r.capability_id)).sort().join(',');
      const curI = st.di.filter((r) => r.document_id === row.id).map((r) => indSlug.get(r.industry_id)).sort().join(',');
      if (curC !== caps.map((x: any) => x.slug).sort().join(',')) errs.push(`${d.slug}: DB caps [${curC}] != proposal`);
      if (curI !== inds.map((x: any) => x.slug).sort().join(',')) errs.push(`${d.slug}: DB inds [${curI}] != proposal`);
    }
  }
  if (!againstDb) {
    for (const s of newCaps) if (!usedNewCaps.has(s)) errs.push(`new cap ${s} unused`);
    for (const s of newInds) if (!usedNewInds.has(s)) errs.push(`new ind ${s} unused`);
    const techN = p.documents.filter((d: any) => d.proposed.industries.some((i: any) => i.slug === 'technology')).length;
    if (techN > 5) errs.push(`technology proposed for ${techN} docs (>5)`);
  }
  // articles untouched
  const art = new Set(st.docs.filter((d) => d.doc_type !== 'case_study').map((d) => d.id));
  const artLinks = st.dc.filter((r) => art.has(r.document_id)).length + st.di.filter((r) => art.has(r.document_id)).length;
  if (againstDb && artLinks) errs.push(`${artLinks} article capability/industry links in DB`);
  console.log('before caps:', dist(cs.map((d) => st.dc.filter((r) => r.document_id === d.id).map((r) => capSlug.get(r.capability_id)!))));
  console.log('before inds:', dist(cs.map((d) => st.di.filter((r) => r.document_id === d.id).map((r) => indSlug.get(r.industry_id)!))));
  console.log('after caps:', dist(p.documents.map((d: any) => d.proposed.capabilities.map((x: any) => x.slug))));
  console.log('after inds:', dist(p.documents.map((d: any) => d.proposed.industries.map((x: any) => x.slug))));
  console.log(`flagged (${flagged.length}):`); flagged.forEach((f) => console.log('  ' + f));
  if (errs.length) { console.log(`FAIL (${errs.length}):`); errs.forEach((e) => console.log('  ' + e)); return false; }
  console.log(againstDb ? 'CHECK --against-db OK' : 'CHECK OK');
  return true;
}

async function replaceLinks(docId: string, capIds: string[], indIds: string[]) {
  const curC = await all('document_capabilities', 'capability_id', (q) => q.eq('document_id', docId));
  const curI = await all('document_industries', 'industry_id', (q) => q.eq('document_id', docId));
  const cs = new Set(curC.map((r) => r.capability_id)), is = new Set(curI.map((r) => r.industry_id));
  let ins = 0, del = 0;
  for (const id of cs) if (!capIds.includes(id)) { const { error } = await sb.from('document_capabilities').delete().eq('document_id', docId).eq('capability_id', id); if (error) throw error; del++; }
  for (const id of capIds) if (!cs.has(id)) { const { error } = await sb.from('document_capabilities').insert({ document_id: docId, capability_id: id }); if (error) throw error; ins++; }
  for (const id of is) if (!indIds.includes(id)) { const { error } = await sb.from('document_industries').delete().eq('document_id', docId).eq('industry_id', id); if (error) throw error; del++; }
  for (const id of indIds) if (!is.has(id)) { const { error } = await sb.from('document_industries').insert({ document_id: docId, industry_id: id }); if (error) throw error; ins++; }
  return { ins, del };
}

async function apply() {
  if (!has('--yes')) { console.error('refusing without --yes'); process.exit(1); }
  const p = JSON.parse(fs.readFileSync(PROPOSAL, 'utf8'));
  const st = await loadState();
  const capSlug = new Map(st.caps.map((c) => [c.id, c.slug]));
  const indSlug = new Map(st.inds.map((c) => [c.id, c.slug]));
  fs.writeFileSync(BACKUP, JSON.stringify({
    timestamp: new Date().toISOString(),
    capabilities: st.caps, industries: st.inds,
    document_capabilities: st.dc.map((r) => ({ ...r, slug: capSlug.get(r.capability_id) })),
    document_industries: st.di.map((r) => ({ ...r, slug: indSlug.get(r.industry_id) })),
  }, null, 2));
  if (!fs.existsSync(BACKUP) || fs.statSync(BACKUP).size < 10) throw new Error('backup failed');
  console.log('backup written', BACKUP);
  for (const c of p.new_capabilities ?? []) if (!st.caps.some((x) => x.slug === c.slug)) {
    const { error } = await sb.from('capabilities').insert({ slug: c.slug, name: c.name, description: c.description }); if (error) throw error; console.log('new capability', c.slug);
  }
  for (const c of p.new_industries ?? []) if (!st.inds.some((x) => x.slug === c.slug)) {
    const { error } = await sb.from('industries').insert({ slug: c.slug, name: c.name, description: c.description }); if (error) throw error; console.log('new industry', c.slug);
  }
  const caps = await all('capabilities', 'id, slug'), inds = await all('industries', 'id, slug');
  const cid = new Map(caps.map((c) => [c.slug, c.id])), iid = new Map(inds.map((c) => [c.slug, c.id]));
  const dbySlug = new Map(st.docs.map((d) => [d.slug, d]));
  let ins = 0, del = 0;
  for (const d of p.documents) {
    const r = await replaceLinks(dbySlug.get(d.slug)!.id, d.proposed.capabilities.map((x: any) => cid.get(x.slug)!), d.proposed.industries.map((x: any) => iid.get(x.slug)!));
    ins += r.ins; del += r.del;
  }
  console.log(`links inserted ${ins}, deleted ${del}`);
  if (!(await check(true))) process.exit(1);
}

async function restore() {
  if (!has('--yes')) { console.error('refusing without --yes'); process.exit(1); }
  const file = argv[argv.indexOf('--restore') + 1];
  const b = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const st = await loadState();
  const cs = st.docs.filter((d) => d.doc_type === 'case_study');
  const ids = new Set<string>([...b.document_capabilities.map((r: any) => r.document_id), ...b.document_industries.map((r: any) => r.document_id)]);
  // documents with links in backup, plus case studies with none in backup (links must be cleared)
  for (const d of cs) ids.add(d.id);
  let ins = 0, del = 0;
  for (const id of ids) {
    const r = await replaceLinks(id,
      b.document_capabilities.filter((x: any) => x.document_id === id).map((x: any) => x.capability_id),
      b.document_industries.filter((x: any) => x.document_id === id).map((x: any) => x.industry_id));
    ins += r.ins; del += r.del;
  }
  console.log(`restored: inserted ${ins}, deleted ${del}`);
}

(async () => {
  if (has('--dump')) await dump();
  else if (has('--check')) process.exit((await check(has('--against-db'))) ? 0 : 1);
  else if (has('--apply')) await apply();
  else if (has('--restore')) await restore();
  else console.log('modes: --dump | --check [--against-db] | --apply --yes | --restore <file> --yes');
})().catch((e) => { console.error(e); process.exit(1); });
