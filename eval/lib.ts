/**
 * Shared helpers for the Concierge evaluation harness.
 *
 * Pipeline: generate.ts -> run.ts -> grade.ts -> report.ts
 * Everything for one run lives in eval/results/<timestamp>/.
 */

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import type {
  ComponentType,
  DocumentMetric,
  GenerationUsage,
  HybridSearchResult,
  OrchestratorOutput,
  VisualAssetSearchResult,
} from '../src/types';
import { anthropicClientOptions, claudeModelId, usingOpenRouter } from '../src/lib/llm-config';
import { CONCIERGE_CONFIG, isNoContext } from '../src/lib/concierge-config';
import { metricValueInContext } from './numbers';

dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// ============================================
// PATHS
// ============================================

export const EVAL_DIR = __dirname;
export const RESULTS_DIR = path.join(EVAL_DIR, 'results');
export const PERSONAS_PATH = path.join(EVAL_DIR, 'personas.json');
export const QUERIES_PATH = path.join(EVAL_DIR, 'queries.json');

// ============================================
// TYPES
// ============================================

// Mirrors availableComponents in src/components/index.ts (not imported to avoid pulling in React)
export const COMPONENTS: ComponentType[] = [
  'HeroBlock',
  'StrategyCard',
  'VideoPlayer',
  'MetricGrid',
  'VisualAsset',
  'CaseStudyTeaser',
];

export const QUERY_TYPES = ['well_formed', 'vague', 'off_topic', 'invention_bait', 'multi_part'] as const;
export type QueryType = (typeof QUERY_TYPES)[number];

// How many queries of each type every persona gets
export const QUERY_MIX: Record<QueryType, number> = {
  well_formed: 5,
  vague: 2,
  off_topic: 1,
  invention_bait: 1,
  multi_part: 1,
};

export interface Persona {
  id: string;
  label: string;
  role: string;
  company_type: string;
  company_size: string;
  industry: string;
  marketing_problem: string;
  technical_level: string;
  articulateness: string;
  win: string;
  site_alignment: string;
  likely_relevant_work: string[];
}

export interface Expected {
  components: ComponentType[];
  fallback_expected: boolean;
  case_studies: string[]; // Slugs of indexed case studies retrieval should surface
  site_only_work: string[]; // Work shown on articlegroup.com/work that is not in the index
  notes: string;
}

export interface EvalQuery {
  id: string;
  persona_id: string;
  type: QueryType;
  text: string;
  expected: Expected;
}

export interface IndexedDoc {
  slug: string;
  title: string;
  client_name: string | null;
  doc_type: 'case_study' | 'article';
  has_video: boolean;
}

export interface QueriesFile {
  generated_at: string;
  model: string;
  indexed_documents: IndexedDoc[];
  queries: EvalQuery[];
}

export interface RetrievalSnapshot {
  chunks: HybridSearchResult[];
  visualAssets: VisualAssetSearchResult[];
  relatedMetrics: DocumentMetric[];
  searchFunction?: string;
}

export const FROZEN_BASELINE_ID = '2026-11-20T15-12-31';
export const CLAIM_KINDS = ['goal_as_result', 'capability_not_shown', 'generated_tags', 'other'] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];
export interface UnsupportedClaim {
  claim: string;
  kind: ClaimKind;
}
export interface RunModels {
  route: string;
  generation: string;
  embedding: string;
}

export interface RunRecord {
  id: string;
  persona_id: string;
  type: QueryType;
  query: string;
  expected: Expected;
  status: 'ok' | 'error';
  http_status: number | null;
  latency_ms: number | null;
  error: string | null;
  response: OrchestratorOutput | null;
  raw_response: string | null;
  orchestrator_error: string | null;
  retrieval: RetrievalSnapshot | null;
  catalogue?: string | null;
  catalogue_version?: string | null;
  usage?: GenerationUsage | null;
  search_function?: string | null;
}

export interface RunFile {
  started_at: string;
  finished_at: string | null;
  base_url: string;
  git_commit: string | null;
  query_count: number;
  records: RunRecord[];
  models?: RunModels | null;
  regrade_of?: string;
  regraded_at?: string;
}

export interface CriterionScore {
  score: number;
  reason: string;
}

export const CRITERIA = ['grounded', 'components', 'fallback', 'cta', 'voice'] as const;
export type Criterion = (typeof CRITERIA)[number];

export interface AutomatedChecks {
  layout_parsed: boolean;
  unknown_components: string[];
  missing_props: string[];
  media_not_in_context: string[];
  unknown_slugs: string[];
  non_verbatim_titles: string[];
  metrics_not_in_context: string[];
  videos_available_not_used: string[];
  strategy_lead_expected?: boolean;
  strategy_lead_offered?: boolean;
}

export interface GradeRecord {
  id: string;
  grader_model: string;
  graded_at: string;
  skipped: string | null; // Reason the response could not be graded
  grader_error: string | null;
  scores: Record<Criterion, CriterionScore> | null;
  invented_claims: string[];
  claims?: UnsupportedClaim[];
  harness_version?: number;
  context_relevant: boolean | null;
  would_strict_pass_fallback: boolean | null;
  hallucination: boolean;
  automated_checks: AutomatedChecks | null;
}

export interface GradesFile {
  grader_model: string;
  grader_route?: string;
  harness_version?: number;
  grades: GradeRecord[];
}

// ============================================
// FILES & CLI
// ============================================

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/** Results dir from --dir, else the most recent run that has responses.json. */
export function resolveResultsDir(): string {
  const explicit = argValue('--dir');
  if (explicit) return path.resolve(explicit);

  const runs = fs.existsSync(RESULTS_DIR)
    ? fs
        .readdirSync(RESULTS_DIR)
        .filter(d => fs.existsSync(path.join(RESULTS_DIR, d, 'responses.json')))
        .sort()
    : [];
  if (runs.length === 0) {
    throw new Error('No eval runs found in eval/results. Run `npm run eval:run` first.');
  }
  return path.join(RESULTS_DIR, runs[runs.length - 1]);
}

/** The frozen baseline must never be overwritten; re-grade a copy with `npm run eval:regrade`. */
export function assertWritableRunDir(dir: string): void {
  if (path.basename(path.resolve(dir)) === FROZEN_BASELINE_ID) {
    throw new Error(`${dir} is the frozen baseline and is read-only. Use \`npm run eval:regrade\` to grade a copy.`);
  }
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// CLAUDE (generator + grader)
// ============================================

export const EVAL_MODEL = process.env.EVAL_MODEL || 'claude-opus-5-5';

// A grading call normally takes well under a minute; cap stalls so a run can't hang
const anthropic = new Anthropic({ ...anthropicClientOptions(), maxRetries: 3, timeout: 3 * 60 * 1000 });

interface ClaudeJsonParams {
  system: string | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  user: string;
  schema: Record<string, unknown>;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/**
 * One Claude call constrained to a JSON schema (structured outputs).
 * The installed SDK (0.30) predates output_config/fallbacks typings, so the
 * params are cast; the SDK forwards the body unchanged.
 */
export async function callClaudeJson<T>({ system, user, schema, effort = 'high' }: ClaudeJsonParams): Promise<T> {
  // The fallbacks: "default" form is Anthropic-API only; OpenRouter accepts just an explicit model list
  const useFallbacks = process.env.EVAL_FALLBACKS !== 'off' && !usingOpenRouter();
  const params = {
    model: claudeModelId(EVAL_MODEL),
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: user }],
    output_config: { effort, format: { type: 'json_schema', schema } },
    ...(useFallbacks ? { fallbacks: 'default' } : {}),
  };

  const send = () =>
    anthropic.messages.create(
      params as unknown as Anthropic.MessageCreateParamsNonStreaming,
      useFallbacks ? { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } } : undefined,
    );

  // OpenRouter answers 402 in_flight_budget_exhausted when parallel requests reserve more credit than
  // the balance allows; it clears once they settle. A genuinely empty balance still fails after the retries.
  let response: Anthropic.Message | undefined;
  for (let attempt = 0; !response; attempt++) {
    try {
      response = await send();
    } catch (error) {
      const inFlight =
        error instanceof Anthropic.APIError && error.status === 402 && /in_flight_budget/.test(error.message);
      if (!inFlight || attempt >= 2) throw error;
      const retryAfter = Number(error.headers?.['retry-after']) || 120;
      console.warn(`  OpenRouter in-flight credit limit hit - retrying in ${retryAfter}s`);
      await sleep(retryAfter * 1000);
    }
  }

  const stopReason = response.stop_reason as string;
  if (stopReason === 'refusal') {
    throw new Error('Claude declined the request (stop_reason: refusal)');
  }
  if (stopReason === 'max_tokens') {
    throw new Error('Claude hit max_tokens before finishing the JSON');
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');
  return JSON.parse(text) as T;
}

// ============================================
// AUTOMATED CHECKS
// ============================================

const REQUIRED_PROPS: Record<ComponentType, string[]> = {
  HeroBlock: ['title'],
  StrategyCard: ['title', 'content'],
  VideoPlayer: ['url'],
  MetricGrid: ['stats'],
  VisualAsset: ['src', 'alt'],
  CaseStudyTeaser: ['title', 'summary', 'slug'],
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const stripQuery = (url: string) => url.split('?')[0];

// Model output is untrusted, so checks read props loosely rather than via the component prop types
type LooseLayoutItem = { component: string; props: Record<string, unknown> };

/** Extracts the layout JSON from the raw model text, like parseOrchestratorResponse does. */
export function parseLayout(raw: string | null): LooseLayoutItem[] | null {
  if (!raw) return null;
  const match = raw.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed?.layout) ? parsed.layout : null;
  } catch {
    return null;
  }
}

/**
 * Deterministic checks that don't need a model: tag validity, required props,
 * and whether slugs / media URLs / metrics actually came from retrieval.
 * Results are fed to the grader as evidence and reported separately.
 */
export function runAutomatedChecks(record: RunRecord): AutomatedChecks {
  const layout =
    parseLayout(record.raw_response) ??
    ((record.response?.layoutPlan?.layout as unknown as LooseLayoutItem[] | undefined) ?? null);
  const chunks = record.retrieval?.chunks ?? [];
  const assets = record.retrieval?.visualAssets ?? [];
  const metrics = record.retrieval?.relatedMetrics ?? [];

  const checks: AutomatedChecks = {
    layout_parsed: parseLayout(record.raw_response) !== null,
    unknown_components: [],
    missing_props: [],
    media_not_in_context: [],
    unknown_slugs: [],
    non_verbatim_titles: [],
    metrics_not_in_context: [],
    videos_available_not_used: [],
    // Only the no_context trigger is deterministic; other triggers are left to the grader
    strategy_lead_expected:
      CONCIERGE_CONFIG.strategyLead.offerOn.includes('no_context') &&
      isNoContext(record.retrieval ?? { chunks: [], visualAssets: [], relatedMetrics: [] }),
    strategy_lead_offered: new RegExp(CONCIERGE_CONFIG.strategyLead.name, 'i').test(
      record.raw_response ?? record.response?.explanation ?? '',
    ),
  };
  if (!layout) return checks;

  const slugs = new Set(chunks.map(c => c.slug));
  const titles = new Set(chunks.map(c => normalize(c.document_title)));
  const vimeoUrls = new Set(chunks.map(c => c.vimeo_url).filter(Boolean).map(u => stripQuery(u!)));
  const thumbnails = new Set(chunks.map(c => c.thumbnail_url).filter(Boolean).map(u => stripQuery(u!)));
  const contextText = normalize(
    [...chunks.map(c => c.content), ...metrics.map(m => `${m.label} ${m.value} ${m.context ?? ''}`)].join(' '),
  );

  // Signed URLs expire, so match on the storage path rather than the full URL
  const isKnownAsset = (src: string) =>
    thumbnails.has(stripQuery(src)) || assets.some(a => src.includes(a.storage_path));

  for (const item of layout) {
    const props = item.props ?? {};
    if (!COMPONENTS.includes(item.component as ComponentType)) {
      checks.unknown_components.push(item.component);
      continue;
    }
    const component = item.component as ComponentType;

    for (const prop of REQUIRED_PROPS[component]) {
      if (props[prop] === undefined || props[prop] === '') {
        checks.missing_props.push(`${component}.${prop}`);
      }
    }

    if (component === 'VideoPlayer' && typeof props.url === 'string' && !vimeoUrls.has(stripQuery(props.url))) {
      checks.media_not_in_context.push(`VideoPlayer.url ${props.url}`);
    }
    if (component === 'VisualAsset' && typeof props.src === 'string' && !isKnownAsset(props.src)) {
      checks.media_not_in_context.push(`VisualAsset.src ${stripQuery(props.src)}`);
    }
    if (component === 'CaseStudyTeaser') {
      if (typeof props.thumbnailUrl === 'string' && !isKnownAsset(props.thumbnailUrl)) {
        checks.media_not_in_context.push(`CaseStudyTeaser.thumbnailUrl ${stripQuery(props.thumbnailUrl)}`);
      }
      if (typeof props.slug === 'string' && !slugs.has(props.slug)) {
        checks.unknown_slugs.push(props.slug);
      }
      if (typeof props.title === 'string' && !titles.has(normalize(props.title))) {
        checks.non_verbatim_titles.push(props.title);
      }
    }
    if (component === 'MetricGrid' && Array.isArray(props.stats)) {
      for (const stat of props.stats as Array<{ value?: unknown }>) {
        const value = String(stat?.value ?? '');
        if (value && !metricValueInContext(value, contextText)) {
          checks.metrics_not_in_context.push(value);
        }
      }
    }
  }

  const usedVideos = new Set(
    layout
      .filter(item => item.component === 'VideoPlayer' && typeof item.props?.url === 'string')
      .map(item => stripQuery(item.props.url as string)),
  );
  // Under relevant_only, only studies the response presents (has a teaser for) need their video shown
  const presented = new Set(
    layout.filter(i => i.component === 'CaseStudyTeaser' && typeof i.props?.slug === 'string').map(i => i.props.slug as string),
  );
  for (const chunk of chunks) {
    if (CONCIERGE_CONFIG.teasers.policy === 'relevant_only' && !presented.has(chunk.slug)) continue;
    if (chunk.vimeo_url && !usedVideos.has(stripQuery(chunk.vimeo_url))) {
      checks.videos_available_not_used.push(chunk.slug);
    }
  }

  return checks;
}
