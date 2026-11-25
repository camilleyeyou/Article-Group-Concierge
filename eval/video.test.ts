import { test } from 'node:test';
import assert from 'node:assert/strict';
import { posterUrlFor, isDirectVideoUrl } from '../src/lib/video-poster';
import { isPlayableVideoUrl } from '../src/lib/concierge-config';
import { dropUnplayableVideos, postProcessOutput } from '../src/lib/layout-postprocess';
import { formatContext, orchestrateStream, type OrchestratorStreamEvent, type RawModelEvent } from '../src/lib/orchestrator';
import { runAutomatedChecks, type RunRecord } from './lib';
import type { LayoutPlan, OrchestratorOutput } from '../src/types';

const base = 'https://x.supabase.co/storage/v1/object/public/case-study-videos/a/B_-_C';
const DEAD = 'https://vimeo.com/1030871091';
const DEAD2 = 'https://vimeo.com/877614456';
const GOOD = 'https://vimeo.com/190925687';

test('posterUrlFor derives sibling poster', () => {
  for (const ext of ['mp4', 'webm', 'mov', 'm4v']) {
    assert.equal(posterUrlFor(`${base}.${ext}`), `${base}.poster.jpg`);
  }
  assert.equal(posterUrlFor(`${base}.mp4?token=1#x`), `${base}.poster.jpg`);
  assert.equal(posterUrlFor(GOOD), null);
  assert.equal(posterUrlFor('https://x.com/a.png'), null);
  assert.ok(isDirectVideoUrl(`${base}.mp4`));
});

test('isPlayableVideoUrl', () => {
  for (const u of [DEAD, DEAD2, 'https://player.vimeo.com/video/877614456?h=abc', 'http://www.vimeo.com/1030871091/', 'https://vimeo.com/channels/x/1030871091']) {
    assert.equal(isPlayableVideoUrl(u), false, u);
  }
  assert.equal(isPlayableVideoUrl(GOOD), true);
  assert.equal(isPlayableVideoUrl(`${base}.mp4`), true);
  for (const u of ['', null, undefined]) assert.equal(isPlayableVideoUrl(u), false);
});

const video = (url: string): any => ({ component: 'VideoPlayer', props: { url } });
const hero: any = { component: 'HeroBlock', props: { headline: 'h', subheadline: 's' } };
const teaser: any = { component: 'CaseStudyTeaser', props: { title: 't', summary: 's', slug: 'x' } };

test('dropUnplayableVideos filters only dead videos, no mutation', () => {
  const layout: LayoutPlan = { layout: [hero, video(DEAD), video(GOOD), teaser, video(DEAD2)] };
  const snapshot = JSON.stringify(layout);
  const r = dropUnplayableVideos(layout);
  assert.equal(JSON.stringify(layout), snapshot);
  assert.equal(r.dropped, 2);
  assert.deepEqual(r.layout.layout.map(i => i.component), ['HeroBlock', 'VideoPlayer', 'CaseStudyTeaser']);
  assert.equal((r.layout.layout[1].props as any).url, GOOD);
});

test('postProcessOutput removes dead video from layout and raw response', () => {
  const layout: LayoutPlan = { layout: [hero, video(DEAD), teaser] };
  const raw = 'intro\n```json\n' + JSON.stringify(layout) + '\n```\nend';
  const out = postProcessOutput({ layoutPlan: layout, rawResponse: raw } as unknown as OrchestratorOutput, raw, null);
  assert.equal(out.layoutPlan.layout.some(i => i.component === 'VideoPlayer'), false);
  assert.ok(!out.rawResponse!.includes('1030871091'));
  assert.ok(out.modelRawResponse!.includes('1030871091'));
});

function rawFor(layout: LayoutPlan): RawModelEvent[] {
  const text = '```json\n' + JSON.stringify(layout, null, 2) + '\n```';
  return [
    { type: 'message_start', message: { usage: {} } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text' } },
    ...(text.match(/[\s\S]{1,40}/g) ?? []).map(t => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) as RawModelEvent),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
}

test('orchestrateStream never emits dead video, still emits playable', async () => {
  const layout: LayoutPlan = { layout: [hero, video(DEAD), video(GOOD), teaser] };
  const evs = rawFor(layout);
  const events: OrchestratorStreamEvent[] = [];
  const gen = orchestrateStream(
    { userQuery: 'video q ' + Math.random(), context: { chunks: [], visualAssets: [], relatedMetrics: [] } as any, skipCache: true },
    { catalogue: null, createEvents: async () => (async function* () { for (const e of evs) yield e; })() as AsyncIterable<RawModelEvent> },
  );
  for await (const e of gen) events.push(e);
  const comps = events.filter(e => e.type === 'component') as Extract<OrchestratorStreamEvent, { type: 'component' }>[];
  assert.ok(!comps.some(c => JSON.stringify(c.props).includes('1030871091')));
  assert.ok(comps.some(c => c.component === 'VideoPlayer' && (c.props as any).url === GOOD));
  const final = events[events.length - 1];
  assert.equal(final.type, 'final');
  if (final.type === 'final') {
    const vids = final.output.layoutPlan.layout.filter(i => i.component === 'VideoPlayer');
    assert.equal(vids.length, 1);
    assert.equal((vids[0].props as any).url, GOOD);
  }
});

test('formatContext hides unplayable Vimeo URL from the model', () => {
  const chunk = (vimeo_url: string) => ({ document_type: 'case_study', document_title: 'T', client_name: 'C', slug: 's', vimeo_url, thumbnail_url: null, content: 'c' }) as any;
  const mk = (u: string) => formatContext({ chunks: [chunk(u)], visualAssets: [], relatedMetrics: [], capabilities: [], industries: [], topics: [] } as any);
  const dead = mk(DEAD2);
  assert.ok(dead.includes('Vimeo URL: None'));
  assert.ok(!dead.includes('use a VideoPlayer'));
  const ok = mk(GOOD);
  assert.ok(ok.includes(`Vimeo URL: ${GOOD} (use a VideoPlayer if you present this study)`));
});

// Harness correction (06-05): the check counts only videos the app tells the model about.
function videoRecord(vimeo: string | null, slug: string): RunRecord {
  const layout = { layout: [{ component: 'HeroBlock', props: { title: 'Hi' } }, { component: 'CaseStudyTeaser', props: { title: 'T', summary: 's', slug } }] };
  return {
    id: 'fixture', persona_id: 'p', type: 'direct', query: 'show me a video case study',
    expected: { components: ['HeroBlock'], fallback_expected: false, case_studies: [], site_only_work: [], notes: '' },
    status: 'ok', http_status: 200, latency_ms: 1, error: null, response: null,
    raw_response: 'x\n```json\n' + JSON.stringify(layout) + '\n```',
    orchestrator_error: null,
    retrieval: {
      chunks: [{ slug, document_title: 'T', client_name: 'C', document_type: 'case_study', combined_score: 0.5, vimeo_url: vimeo, thumbnail_url: null, content: 'c' }],
      visualAssets: [], relatedMetrics: [],
    },
  } as unknown as RunRecord;
}

test('eval video check ignores an unplayable Vimeo URL', () => {
  const c = runAutomatedChecks(videoRecord(DEAD2, 'gfe'));
  assert.equal(c.video_query, true);
  assert.equal(c.video_query_missing_video, false);
  assert.deepEqual(c.videos_available_not_used, []);
});

test('eval video check still flags a playable video that is not shown', () => {
  const c = runAutomatedChecks(videoRecord(`${base}.mp4`, 'ok-slug'));
  assert.equal(c.video_query_missing_video, true);
  assert.deepEqual(c.videos_available_not_used, ['ok-slug']);
});

test('eval missing-video check counts only presented studies (option D)', () => {
  // playable MP4 retrieved but the response presents a different slug
  const rec = videoRecord(`${base}.mp4`, 'ok-slug');
  const layout = { layout: [{ component: 'HeroBlock', props: { title: 'Hi' } }, { component: 'CaseStudyTeaser', props: { title: 'T', summary: 's', slug: 'other' } }] };
  (rec as any).raw_response = 'x\n```json\n' + JSON.stringify(layout) + '\n```';
  assert.equal(runAutomatedChecks(rec).video_query_missing_video, false);
});
