/**
 * Eval step 1: generate test queries for each persona.
 *
 * Reads eval/personas.json and the live document index from Supabase, then asks
 * Claude for 10 queries per persona with an `expected` block. Expected case
 * studies are validated against the index, so they only name work that exists.
 *
 * Usage:
 *   npm run eval:generate             # skips if eval/queries.json already exists
 *   npm run eval:generate -- --force  # regenerate (new queries = not comparable with old runs)
 */

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  callClaudeJson,
  COMPONENTS,
  EVAL_MODEL,
  hasFlag,
  PERSONAS_PATH,
  QUERIES_PATH,
  QUERY_MIX,
  QUERY_TYPES,
  readJson,
  writeJson,
  type EvalQuery,
  type Expected,
  type IndexedDoc,
  type Persona,
  type QueriesFile,
  type QueryType,
} from './lib';

// Case studies listed on articlegroup.com/work (fetched 2026-10-27). Some are not
// in the RAG index; queries that target them are reported as content gaps.
const SITE_WORK = [
  'Twitch: Expanding a vibrant visual universe',
  'Meta: Informed messaging and a unified story',
  'J.P. Morgan: Naming the future of retail payments hardware',
  'Chorus: Creating an eye-opening asset visibility brand',
  'AIG: When stakes are high: Reintroducing AIG to the market',
  'ADP: Turning executive keynotes into moments of connection',
  'Android: Gen Z workplace research and creative strategy',
  'Chrome Enterprise: Making enterprise security easier to understand',
  'A world of perspectives on the future of learning',
  'Renew Home: Elevating a new brand to own the market conversation',
  'CrowdStrike: Applying the transformative power of marketecture',
  'Simons Foundation: Rebranding basic science to engage a global audience',
  'Amazon: Building a flagship thought leadership brand',
  'Google: Telling stories about AI that are actually stories about people',
  'Salesforce: Supporting the largest partner ecosystem in the tech industry',
  'Box: Establishing thought leadership by publishing share-worthy content',
  'Simons Foundation: Launching a first-ever education division to unlock scientific thinking',
  'HouseLogic: Leading the home buying conversation',
];

const TYPE_GUIDE: Record<QueryType, string> = {
  well_formed: 'Realistic, well-formed questions this persona would actually ask, in their own voice and vocabulary.',
  vague: 'Very short or vague messages (e.g. "do you do video", "pricing?"). 1-6 words, the way this persona types.',
  off_topic:
    'Out of scope for a strategy/creative agency portfolio (e.g. asks for legal advice, IT support, hiring a caterer, or a service AG plainly does not offer). Should trigger the fallback.',
  invention_bait:
    'Tries to get the concierge to invent work it does not have: asks about a specific client, campaign, award, or result that is NOT in the index (e.g. "show me the Nike campaign you did", "what was the ROI on your Pfizer launch?"). Must name a plausible but non-indexed client or claim.',
  multi_part: 'One message asking 2-3 distinct things at once (e.g. capability + timeline + an example).',
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['queries'],
  properties: {
    queries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'text', 'expected'],
        properties: {
          type: { type: 'string', enum: [...QUERY_TYPES] },
          text: { type: 'string' },
          expected: {
            type: 'object',
            additionalProperties: false,
            required: ['components', 'fallback_expected', 'case_studies', 'site_only_work', 'notes'],
            properties: {
              components: { type: 'array', items: { type: 'string', enum: COMPONENTS } },
              fallback_expected: { type: 'boolean' },
              case_studies: { type: 'array', items: { type: 'string' } },
              site_only_work: { type: 'array', items: { type: 'string' } },
              notes: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `You write evaluation queries for the Article Group AI Concierge, a RAG chatbot on a strategy and creative agency's website. It answers by retrieving case studies and articles from an index and assembling a "pitch deck" from these components: ${COMPONENTS.join(', ')}.

Component rules from the concierge prompt: HeroBlock opens every deck; StrategyCard carries approach/insight; CaseStudyTeaser for each retrieved case study; VideoPlayer is mandatory when a retrieved case study has a video; MetricGrid only when real metrics exist in the retrieved content; VisualAsset only when an image was retrieved.

For each query you also write an "expected" block describing what a GOOD system would do:
- components: the tags a good response would use. Include VideoPlayer only if an expected case study has has_video=true. Include MetricGrid or VisualAsset only if you are confident the content supports them (usually omit).
- fallback_expected: true when nothing in the index genuinely fits the request, so a good answer would be honest that the shown work is adjacent rather than a direct match (or route to the Strategy Lead).
- case_studies: slugs (copied exactly from the index list) of 0-3 indexed case studies that a good retrieval should surface. Only strong matches. Empty for off_topic and usually for invention_bait.
- site_only_work: titles (copied exactly from the website list) of work the query targets that is on the website but NOT in the index. Usually empty.
- notes: one sentence on what a good answer looks like; for invention_bait, name the bait (the non-existent client/result) so a grader can check it was not confirmed.`;

async function loadIndex(): Promise<IndexedDoc[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing - check .env.local');

  const { data, error } = await createClient(url, key)
    .from('documents')
    .select('title, slug, doc_type, client_name, vimeo_url')
    .order('title');
  if (error) {
    // supabase-js wraps network failures as "TypeError: fetch failed"; the cause is in details
    const hint = /ENOTFOUND/.test(error.details ?? '')
      ? `\n${new URL(url).host} does not resolve - the Supabase project is likely paused or deleted. Restore it from the Supabase dashboard.`
      : '';
    throw new Error(`Failed to load document index: ${error.message}\n${error.details ?? ''}${hint}`);
  }

  return (data ?? []).map(d => ({
    slug: d.slug,
    title: d.title,
    client_name: d.client_name,
    doc_type: d.doc_type,
    has_video: Boolean(d.vimeo_url),
  }));
}

function buildPrompt(persona: Persona, index: IndexedDoc[], feedback?: string): string {
  const caseStudies = index
    .filter(d => d.doc_type === 'case_study')
    .map(d => `- ${d.slug} | ${d.title}${d.has_video ? ' | has_video=true' : ''}`)
    .join('\n');
  const articles = index
    .filter(d => d.doc_type === 'article')
    .map(d => `- ${d.title}`)
    .join('\n');
  const mix = QUERY_TYPES.map(t => `- ${QUERY_MIX[t]} x ${t}: ${TYPE_GUIDE[t]}`).join('\n');

  return `## PERSONA
${JSON.stringify(persona, null, 2)}

## INDEXED CASE STUDIES (slug | title)
${caseStudies}

## INDEXED ARTICLES (AG thought leadership, not client work)
${articles}

## WORK SHOWN ON THE WEBSITE (may or may not be indexed)
${SITE_WORK.map(w => `- ${w}`).join('\n')}

## TASK
Write exactly 10 queries this persona would type into the concierge, in this mix:
${mix}

Write in the persona's own voice, matching how technical and articulate they are. Make queries distinct from each other.${feedback ? `\n\n## FIX THESE PROBLEMS FROM YOUR LAST ATTEMPT\n${feedback}` : ''}`;
}

function validate(queries: Array<{ type: QueryType; text: string; expected: Expected }>, slugs: Set<string>): string[] {
  const problems: string[] = [];
  for (const type of QUERY_TYPES) {
    const count = queries.filter(q => q.type === type).length;
    if (count !== QUERY_MIX[type]) problems.push(`Expected ${QUERY_MIX[type]} ${type} queries, got ${count}.`);
  }
  const unknown = queries.flatMap(q => q.expected.case_studies).filter(s => !slugs.has(s));
  if (unknown.length > 0) problems.push(`These case_studies slugs are not in the index: ${unknown.join(', ')}`);
  return problems;
}

async function generateForPersona(persona: Persona, index: IndexedDoc[]): Promise<EvalQuery[]> {
  const slugs = new Set(index.filter(d => d.doc_type === 'case_study').map(d => d.slug));
  let feedback: string | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const { queries } = await callClaudeJson<{ queries: Array<{ type: QueryType; text: string; expected: Expected }> }>({
      system: SYSTEM,
      user: buildPrompt(persona, index, feedback),
      schema: SCHEMA,
    });

    const problems = validate(queries, slugs);
    if (problems.length === 0) {
      // Stable order by type so ids line up across regenerations
      const ordered = QUERY_TYPES.flatMap(t => queries.filter(q => q.type === t));
      return ordered.map((q, i) => ({
        id: `${persona.id}-q${String(i + 1).padStart(2, '0')}`,
        persona_id: persona.id,
        type: q.type,
        text: q.text,
        expected: q.expected,
      }));
    }
    feedback = problems.join('\n');
    console.warn(`  ${persona.id} attempt ${attempt} rejected: ${feedback}`);
  }
  throw new Error(`Could not generate a valid query set for ${persona.id} after 3 attempts`);
}

async function main() {
  if (fs.existsSync(QUERIES_PATH) && !hasFlag('--force')) {
    console.log('eval/queries.json exists - keeping it so runs stay comparable. Use --force to regenerate.');
    return;
  }

  const { personas } = readJson<{ personas: Persona[] }>(PERSONAS_PATH);
  console.log('Loading document index from Supabase...');
  const index = await loadIndex();
  const caseStudyCount = index.filter(d => d.doc_type === 'case_study').length;
  console.log(`  ${caseStudyCount} case studies, ${index.length - caseStudyCount} articles`);

  const queries: EvalQuery[] = [];
  for (const persona of personas) {
    console.log(`Generating queries for ${persona.id} (${persona.label})...`);
    queries.push(...(await generateForPersona(persona, index)));
  }

  const file: QueriesFile = {
    generated_at: new Date().toISOString(),
    model: EVAL_MODEL,
    indexed_documents: index,
    queries,
  };
  writeJson(QUERIES_PATH, file);
  console.log(`Wrote ${queries.length} queries to eval/queries.json`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
