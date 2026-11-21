/**
 * Diff articlegroup.com/work against the indexed case studies and articles (Phase 2, DATA-02).
 *
 * Usage: npx tsx scripts/site-work-diff.ts
 * Read-only against the DB. Writes data/site-work.json (preserving hand-edited fields on re-run).
 * Note: www.articlegroup.com/work 301-redirects to https://articlegroup.com/work/ (canonical); we follow it.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import { execFileSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'data', 'site-work.json');
const PDF = path.join(ROOT, 'AG Website RAG case studies.pdf');
const PDF_CACHE = path.join(ROOT, 'data', '.cache', 'pdf-pages.json');
const START = 'https://www.articlegroup.com/work';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Accept: 'text/html',
  'Accept-Language': 'en-US',
};

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  if (res.status !== 200) {
    console.error(`Non-200 for ${url}: ${res.status}`);
    process.exit(1);
  }
  await sleep(1000);
  return res.text();
}

function unescapeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—').replace(/&hellip;/g, '…');
}

const NAV = new Set(['menu', 'agency', 'work', 'ideas', 'staff musings', 'agency updates', 'resources', 'careers', 'contact', 'privacy policy', 'article group']);

function extract(html: string): { title: string; text: string; vimeo: string[] } {
  const t = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  const title = unescapeEntities(t).replace(/\s*[-–|]\s*Article Group\s*$/i, '').replace(/\.\s*$/, '').trim();
  const vimeo = [...new Set([...html.matchAll(/(?:player\.)?vimeo\.com\/video\/(\d+)/g)].map(m => `https://vimeo.com/${m[1]}`))];
  const body = /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;
  let text = body
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '\n');
  text = unescapeEntities(text);
  let lines = text.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length >= 3);
  lines = lines.filter(l => !NAV.has(l.toLowerCase()) && !/^©\s*\d{4}\s*Article Group/i.test(l));
  if (lines.length && lines[0].toLowerCase().replace(/\.$/, '') === title.toLowerCase()) lines.shift();
  return { title, text: lines.join('\n'), vimeo };
}

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the their this to was were will with our we you your us not but how what who why can more most into out over than then these those there they them which while when where about after all also any been being both each during each every just like make many much new one only other some such very'.split(' '));
function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
}
const jaccard = (a: Set<string>, b: Set<string>) => {
  const inter = [...a].filter(x => b.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni ? inter / uni : 0;
};

async function main() {
  const indexHtml = await get(START);
  const hrefs = [...indexHtml.matchAll(/https:\/\/(?:www\.)?articlegroup\.com\/work\/[^/"'\s]+\//g)].map(m => m[0].replace('://www.', '://'));
  const urls = [...new Set(hrefs)];
  if (/page\/2|load more|paged=/i.test(indexHtml)) console.warn('WARNING: pagination markers found on /work; check manually');
  console.log(`Found ${urls.length} work items`);

  // Index
  const docs: { id: string; slug: string; title: string; client_name: string | null; doc_type: string }[] = [];
  const { data: d, error } = await supabase.from('documents').select('id, slug, title, client_name, doc_type').in('doc_type', ['case_study', 'article']);
  if (error) { console.error(error); process.exit(1); }
  docs.push(...(d as any));
  const chunkText: Record<string, string> = {};
  for (let from = 0; ; from += 1000) {
    const { data: cs, error: e2 } = await supabase.from('content_chunks').select('document_id, content').range(from, from + 999);
    if (e2) { console.error(e2); process.exit(1); }
    for (const c of cs!) chunkText[c.document_id] = (chunkText[c.document_id] ?? '') + '\n' + c.content;
    if (cs!.length < 1000) break;
  }

  // PDF
  if (!fs.existsSync(PDF_CACHE)) {
    execFileSync('python3', ['-I', path.join(ROOT, 'data', '.cache', 'pdf_pages.py'), PDF, PDF_CACHE]);
  }
  const pdfPages: string[] = JSON.parse(fs.readFileSync(PDF_CACHE, 'utf8'));
  const pdfTok = pdfPages.map(p => new Set(tokens(p)));

  const prev: Record<string, any> = fs.existsSync(OUT)
    ? Object.fromEntries(JSON.parse(fs.readFileSync(OUT, 'utf8')).items.map((i: any) => [i.url, i]))
    : {};

  const items: any[] = [];
  for (const url of urls) {
    const { title, text, vimeo } = extract(await get(url));
    const slug = url.split('/').filter(Boolean).pop()!;
    const pageTok = new Set(tokens(text));
    const siteTitleTok = new Set(tokens(title));
    const head = (text.slice(0, 600) + ' ' + slug.replace(/-/g, ' ')).toLowerCase();

    let best: any = { slug: '', title_score: 0, client_hit: false, content_overlap: 0, rank: -1 };
    for (const doc of docs) {
      const idxTitle = doc.title.includes(':') ? doc.title.split(':').slice(1).join(':') : doc.title;
      const title_score = jaccard(siteTitleTok, new Set(tokens(idxTitle)));
      const clients = (doc.client_name ?? '').split(/[\/(]/).map(s => s.replace(/[^a-z0-9 ]/gi, '').trim().toLowerCase()).filter(s => s.length > 2);
      const client_hit = clients.some(c => head.includes(c));
      const idxTok = new Set(tokens(chunkText[doc.id] ?? ''));
      const content_overlap = idxTok.size ? [...idxTok].filter(w => pageTok.has(w)).length / idxTok.size : 0;
      const rank = content_overlap + title_score + (client_hit ? 0.3 : 0);
      if (rank > best.rank) best = { slug: doc.slug, title_score, client_hit, content_overlap, rank, doc_type: doc.doc_type };
    }
    const { title_score: ts, client_hit: ch, content_overlap: co } = best;
    const status = co >= 0.6 || (ts >= 0.6 && ch) ? 'indexed' : ch && (co >= 0.25 || ts >= 0.3) ? 'near-match' : 'missing';

    const pdf_pages = pdfTok.map((s, i) => ({ i: i + 1, o: s.size ? [...s].filter(w => pageTok.has(w)).length / s.size : 0 })).filter(p => p.o >= 0.3).map(p => p.i);

    const old = prev[url] ?? {};
    items.push({
      url, site_title: title, client: old.client ?? '', status, match_slug: best.slug,
      title_score: +ts.toFixed(2), client_hit: ch, content_overlap: +co.toFixed(2), pdf_pages,
      vimeo_urls: vimeo, text, preview: text.slice(0, 300).replace(/\n/g, ' '),
      risk_notes: old.risk_notes ?? '', proposed_capabilities: old.proposed_capabilities ?? [],
      proposed_industries: old.proposed_industries ?? [], recommended: old.recommended ?? '',
      decision: old.decision ?? 'pending', decision_note: old.decision_note ?? '',
    });
    console.log(`${status.padEnd(10)} ${slug}  -> ${best.slug} (title ${ts.toFixed(2)}, client ${ch}, overlap ${co.toFixed(2)}) pdf:${pdf_pages.join(',')}`);
  }
  fs.writeFileSync(OUT, JSON.stringify({ scraped_at: new Date().toISOString(), source: START, items }, null, 2));
  console.log(`Wrote ${OUT}`);
}
main();
