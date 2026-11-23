import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import { SYSTEM_PROMPT, formatContext } from '../src/lib/orchestrator';
import {
  CONCIERGE_CONFIG,
  STRATEGY_LEAD_TRIGGER_DESCRIPTIONS,
  componentCountRule,
  teaserPromptRule,
  noDirectMatchPrompt,
  FICTIONAL_EXAMPLE,
  fallbackRubricText,
  teaserRubricText,
} from '../src/lib/concierge-config';
import { CLAIM_KINDS, PERSONAS_PATH, runAutomatedChecks, type Persona, type RunRecord } from './lib';
import { GRADER_SCHEMA, HARNESS_VERSION, RUBRIC, buildGraderPrompt, catalogueSection, formatGraderContext, strategyLeadRubricText } from './rubric';

const record: RunRecord = {
  id: 'p1-q01',
  persona_id: 'p1',
  type: 'invention_bait',
  query: 'FIXTURE-QUERY-TEXT: did you build the Acme rebrand?',
  expected: {
    components: ['HeroBlock'],
    fallback_expected: true,
    case_studies: [],
    site_only_work: [],
    notes: 'SENTINEL-EXPECTED-NOTES',
  },
  status: 'ok',
  http_status: 200,
  latency_ms: 1000,
  error: null,
  response: null,
  raw_response: 'Some text\n```json\n{"layout":[{"component":"HeroBlock","props":{"title":"Hi"}}]}\n```',
  orchestrator_error: null,
  retrieval: {
    chunks: [
      {
        slug: 'salt',
        document_title: 'Salt',
        client_name: 'Salt',
        document_type: 'case_study',
        combined_score: 0.5,
        vimeo_url: null,
        thumbnail_url: null,
        content: 'Salt content',
      },
    ],
    visualAssets: [],
    relatedMetrics: [],
  } as unknown as RunRecord['retrieval'],
};

const personas = JSON.parse(fs.readFileSync(PERSONAS_PATH, 'utf-8')).personas as Persona[];

test('grader prompt has no persona, expected block or query type', () => {
  const prompt = buildGraderPrompt(record, runAutomatedChecks(record));
  // The deterministic trigger label 'invention_bait' in strategy_lead_triggers is shown on purpose (D-415)
  for (const banned of ['## PERSONA', '## EXPECTED', 'SENTINEL-EXPECTED-NOTES', 'type:']) {
    assert.ok(!prompt.includes(banned), `prompt leaks ${banned}`);
  }
  for (const p of personas) {
    for (const value of [p.label, p.role, p.marketing_problem]) {
      assert.ok(!prompt.includes(value), `prompt leaks persona text: ${value}`);
    }
  }
});

test('grader prompt has the four sections and the query', () => {
  const prompt = buildGraderPrompt(record, runAutomatedChecks(record));
  for (const h of ['## QUERY', '## RETRIEVED CONTEXT', '## AUTOMATED CHECKS', '## CONCIERGE RESPONSE']) {
    assert.ok(prompt.includes(h), h);
  }
  assert.ok(prompt.includes(record.query));
});

test('rubric outside the embedded app prompt does not mention personas', () => {
  assert.doesNotMatch(RUBRIC.replace(SYSTEM_PROMPT, ''), /\bpersonas?\b/i);
});

test('rubric renders the component-count rule from shared config', () => {
  assert.ok(RUBRIC.includes(componentCountRule()));
  assert.ok(!RUBRIC.includes('4-10 components'));
});

test('rubric renders every enabled Strategy Lead trigger', () => {
  for (const t of CONCIERGE_CONFIG.strategyLead.offerOn) {
    assert.ok(RUBRIC.includes(STRATEGY_LEAD_TRIGGER_DESCRIPTIONS[t]), t);
  }
  assert.ok(strategyLeadRubricText().includes('Strategy Lead'));
});

test('rubric tells the grader that reformatted numbers are equivalent', () => {
  assert.ok(RUBRIC.includes('8M+'));
  assert.ok(RUBRIC.includes('over 8 million'));
});

test('schema classifies claims by kind', () => {
  const s = GRADER_SCHEMA as any;
  assert.deepEqual(s.properties.claims.items.properties.kind.enum, [...CLAIM_KINDS]);
  assert.ok(s.required.includes('claims'));
  assert.ok(!s.required.includes('invented_claims'));
});

test('strategy lead checks are computed for empty retrieval', () => {
  const empty = { ...record, retrieval: { chunks: [], visualAssets: [], relatedMetrics: [] } };
  const checks = runAutomatedChecks(empty);
  assert.equal(checks.strategy_lead_expected, true);
  assert.equal(checks.strategy_lead_offered, false);
});

const chunk = (o: Record<string, unknown>) => ({
  slug: 's', document_title: 'T', client_name: 'C', document_type: 'case_study', combined_score: 0.5,
  vimeo_url: null, thumbnail_url: null, content: 'x', ...o,
});
const withChunks = (chunks: unknown[], layout: unknown[]): RunRecord =>
  ({
    ...record,
    raw_response: '```json\n' + JSON.stringify({ layout }) + '\n```',
    retrieval: { chunks, visualAssets: [], relatedMetrics: [] },
  }) as unknown as RunRecord;

test('prompt and rubric render the same config-driven rules', () => {
  assert.ok(SYSTEM_PROMPT.includes(teaserPromptRule()));
  assert.ok(SYSTEM_PROMPT.includes(noDirectMatchPrompt().intro));
  assert.ok(SYSTEM_PROMPT.includes(noDirectMatchPrompt().rule));
  assert.ok(RUBRIC.includes(teaserRubricText()));
  assert.ok(RUBRIC.includes(fallbackRubricText()));
  for (const old of ['include CaseStudyTeaser for each one', 'you MUST include them as CaseStudyTeaser', 'Case Study Inclusion Rule']) {
    assert.ok(!SYSTEM_PROMPT.includes(old), old);
  }
  if (CONCIERGE_CONFIG.teasers.policy === 'relevant_only') {
    assert.ok(!SYSTEM_PROMPT.includes('NEVER say: "We don\'t currently have X case studies"'));
    assert.ok(!RUBRIC.includes('still show case studies'));
    assert.ok(!RUBRIC.includes('a CaseStudyTeaser for retrieved case studies)'));
  }
});

test('unused-video check only covers presented studies under relevant_only', () => {
  const a = chunk({ slug: 'a', vimeo_url: 'https://vimeo.com/1' });
  const b = chunk({ slug: 'b', vimeo_url: 'https://vimeo.com/2' });
  const checks = runAutomatedChecks(
    withChunks([a, b], [{ component: 'CaseStudyTeaser', props: { slug: 'a', title: 'T', summary: 's' } }]),
  );
  assert.deepEqual(checks.videos_available_not_used, ['a']);
});

test('grader context prints rank signals, falling back to score for legacy chunks', () => {
  const r = withChunks([chunk({ semantic_rank: 2, keyword_rank: 1 }), chunk({})], []);
  const ctx = formatGraderContext(r);
  assert.ok(ctx.includes('rank 1, semantic #2, keyword #1'));
  assert.ok(ctx.includes('score 0.500'));
});

test('formatContext labels by rank and signals, not score thresholds', () => {
  const ctx = (chunks: unknown[]) =>
    formatContext({ chunks, visualAssets: [], relatedMetrics: [] } as any);
  const legacy = ctx([chunk({ semantic_rank: null, keyword_rank: null })]);
  assert.ok(!legacy.includes('no keyword match') && !legacy.includes('semantic #'));
  assert.ok(legacy.includes('Retrieval rank 1 of 1'));
  const v2 = ctx([chunk({ semantic_rank: 3, keyword_rank: null })]);
  assert.ok(v2.includes('semantic #3, no keyword match'));
  assert.ok(!/GOOD|MODERATE|MUST USE VideoPlayer/.test(v2));
});

test('catalogueSection and harness version', () => {
  assert.equal(catalogueSection(record), null);
  const s = catalogueSection({ ...record, catalogue: 'CAT-LINES' });
  assert.ok(s!.startsWith('## PORTFOLIO CATALOGUE (cached system prefix the concierge saw)'));
  assert.ok(s!.includes('CAT-LINES'));
  assert.ok(RUBRIC.includes('PORTFOLIO CATALOGUE'));
  assert.match(RUBRIC, /no outcomes, results or metrics/);
  assert.equal(HARNESS_VERSION, 4);
});

test('rubric uses the fictional example and has no NeoBank outside the prompt', () => {
  assert.ok(RUBRIC.includes(FICTIONAL_EXAMPLE.client));
  assert.ok(RUBRIC.includes(FICTIONAL_EXAMPLE.slug));
  assert.ok(!RUBRIC.replace(SYSTEM_PROMPT, '').includes('NeoBank'));
});

test('schema requires presupposes_asserted_work', () => {
  assert.ok((GRADER_SCHEMA as any).required.includes('presupposes_asserted_work'));
});

test('strategy lead triggers are deterministic per trigger', () => {
  const noFallback = { ...record.expected, fallback_expected: false };
  const empty = { ...record, type: 'standard', query: 'hello', expected: noFallback, retrieval: { chunks: [], visualAssets: [], relatedMetrics: [] } } as unknown as RunRecord;
  const c = runAutomatedChecks(empty);
  assert.deepEqual(c.strategy_lead_triggers, ['no_context']);
  assert.equal(c.strategy_lead_expected, true);
  assert.equal(c.strategy_lead_offered, false);
  const bait = runAutomatedChecks(record);
  assert.ok(bait.strategy_lead_triggers!.includes('invention_bait'));
  assert.ok(bait.strategy_lead_triggers!.includes('fallback'));
  const priced = runAutomatedChecks({ ...record, type: 'standard', query: 'how much do u charge', expected: noFallback } as unknown as RunRecord);
  assert.deepEqual(priced.strategy_lead_triggers, ['pricing']);
});

test('strategy lead offer is read from the narrative, not follow-ups', () => {
  const r = { ...record, response: { explanation: 'We did this. Our Strategy Lead can scope it.', layoutPlan: null }, raw_response: 'x' } as unknown as RunRecord;
  assert.equal(runAutomatedChecks(r).strategy_lead_offered, true);
  const r2 = { ...r, response: { explanation: 'We did this.', layoutPlan: null }, raw_response: 'Strategy Lead follow-up?' } as unknown as RunRecord;
  assert.equal(runAutomatedChecks(r2).strategy_lead_offered, false);
});

test('narrative sentence count and range', () => {
  const mk = (e: string) => ({ ...record, response: { explanation: e, layoutPlan: null } }) as unknown as RunRecord;
  const ok = runAutomatedChecks(mk('One thing. Two things. Three things.'));
  assert.equal(ok.narrative_sentences, 3);
  assert.equal(ok.narrative_in_range, true);
  assert.equal(runAutomatedChecks(mk('A one. B two. C three. D four. E five.')).narrative_in_range, false);
  assert.equal(runAutomatedChecks(mk('Just one.')).narrative_in_range, false);
});

test('teaser tags not from the catalogue are reported', () => {
  const cat = '- Salt | client: Salt | slug: salt | capabilities: Brand Strategy, Video | industries: n/a | video: no';
  const teaser = (caps: string[], inds: string[]) => ({ component: 'CaseStudyTeaser', props: { slug: 'salt', title: 'T', summary: 's', capabilities: caps, industries: inds } });
  const bad = { ...withChunks([chunk({ slug: 'salt' })], [teaser(['Brand Strategy', 'Podcasts'], ['Cyber'])]), catalogue: cat } as RunRecord;
  assert.deepEqual(runAutomatedChecks(bad).teaser_tags_not_from_db, ['salt: Podcasts', 'salt: Cyber']);
  const good = { ...withChunks([chunk({ slug: 'salt' })], [teaser(['Brand Strategy'], [])]), catalogue: cat } as RunRecord;
  assert.deepEqual(runAutomatedChecks(good).teaser_tags_not_from_db, []);
  assert.deepEqual(runAutomatedChecks(withChunks([chunk({ slug: 'salt' })], [teaser(['X'], [])])).teaser_tags_not_from_db, []);
});

test('video query without a VideoPlayer is flagged', () => {
  const q = 'we need instagram and tiktok videos';
  const ch = chunk({ slug: 'a', vimeo_url: 'https://vimeo.com/1' });
  const base = { ...withChunks([ch], [{ component: 'HeroBlock', props: { title: 'x' } }]), query: q } as RunRecord;
  const c = runAutomatedChecks(base);
  assert.equal(c.video_query, true);
  assert.equal(c.video_query_missing_video, true);
  const withVideo = { ...withChunks([ch], [{ component: 'VideoPlayer', props: { url: 'https://vimeo.com/1' } }]), query: q } as RunRecord;
  assert.equal(runAutomatedChecks(withVideo).video_query_missing_video, false);
});

test('pricing/timeline figures are listed only when a trigger fired', () => {
  const mk = (query: string) => ({
    ...record, type: 'standard', query, expected: { ...record.expected, fallback_expected: false },
    response: { explanation: 'Typically $5k and 6 weeks, maybe two months.', layoutPlan: null },
    raw_response: '```json\n{"layout":[{"component":"HeroBlock","props":{"title":"Hi"}}]}\n```',
  }) as unknown as RunRecord;
  const f = runAutomatedChecks(mk('how much and how long')).pricing_timeline_figures;
  assert.ok(f.some(x => x.includes('$5k')) && f.some(x => /6 weeks/.test(x)) && f.some(x => /two months/.test(x)), JSON.stringify(f));
  assert.deepEqual(runAutomatedChecks(mk('tell me about salt')).pricing_timeline_figures, []);
});
