import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import { SYSTEM_PROMPT } from '../src/lib/orchestrator';
import {
  CONCIERGE_CONFIG,
  STRATEGY_LEAD_TRIGGER_DESCRIPTIONS,
  componentCountRule,
} from '../src/lib/concierge-config';
import { CLAIM_KINDS, PERSONAS_PATH, runAutomatedChecks, type Persona, type RunRecord } from './lib';
import { GRADER_SCHEMA, RUBRIC, buildGraderPrompt, strategyLeadRubricText } from './rubric';

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
  for (const banned of ['## PERSONA', '## EXPECTED', 'SENTINEL-EXPECTED-NOTES', 'invention_bait', 'type:']) {
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

test('rubric renders only the enabled Strategy Lead triggers', () => {
  assert.ok(RUBRIC.includes(STRATEGY_LEAD_TRIGGER_DESCRIPTIONS.no_context));
  assert.ok(!CONCIERGE_CONFIG.strategyLead.offerOn.includes('pricing'));
  assert.ok(!RUBRIC.includes(STRATEGY_LEAD_TRIGGER_DESCRIPTIONS.pricing));
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
