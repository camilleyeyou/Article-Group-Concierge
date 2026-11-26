/**
 * GEN-03 post-processing: overwrite teaser capabilities/industries from DB links so the model can
 * never invent tags, drop VideoPlayers whose video is unplayable, and re-render the raw response so the eval grader sees what the user sees.
 * Phase 06.1: the deterministic output guard (leak sentences, count claims, first person) runs last, on the layout and narrative.
 * Pure module (no I/O).
 * The 04-07 verifier hooks in after this.
 */
import type { LayoutPlan, OrchestratorOutput, CaseStudyTeaserProps, VideoPlayerProps } from '../types';
import { isPlayableVideoUrl } from './concierge-config';
import type { CatalogueTags } from './catalogue';
import { guardOutputText, outputGuardEnabled } from './output-guard';

export function applyServerTeaserTags(
  layout: LayoutPlan,
  tags: ReadonlyMap<string, CatalogueTags> | null
): { layout: LayoutPlan; overwritten: number } {
  const out = structuredClone(layout);
  let overwritten = 0;
  for (const item of out.layout) {
    if (item.component !== 'CaseStudyTeaser') continue;
    const props = item.props as CaseStudyTeaserProps;
    delete props.capabilities;
    delete props.industries;
    const t = tags?.get(props.slug);
    if (t) {
      if (t.capabilities.length > 0) props.capabilities = [...t.capabilities];
      if (t.industries.length > 0) props.industries = [...t.industries];
    }
    overwritten++;
  }
  return { layout: out, overwritten };
}

export function dropUnplayableVideos(layout: LayoutPlan): { layout: LayoutPlan; dropped: number } {
  const out = structuredClone(layout);
  const before = out.layout.length;
  out.layout = out.layout.filter(
    item => !(item.component === 'VideoPlayer' && !isPlayableVideoUrl((item.props as VideoPlayerProps).url))
  );
  return { layout: out, dropped: before - out.layout.length };
}

export function renderRawResponse(
  raw: string,
  layout: LayoutPlan,
  explanation?: { from: string; to: string }
): string {
  const block = '```json\n' + JSON.stringify(layout, null, 2) + '\n```';
  let out = raw.replace(/```json\s*[\s\S]*?```/, () => block);
  if (explanation) out = out.replace(explanation.from, () => explanation.to);
  return out;
}

export function postProcessOutput(
  output: OrchestratorOutput,
  modelRaw: string,
  tags: ReadonlyMap<string, CatalogueTags> | null
): OrchestratorOutput {
  const tagged = applyServerTeaserTags(output.layoutPlan, tags);
  const filtered = dropUnplayableVideos(tagged.layout);
  if (!outputGuardEnabled()) {
    return {
      ...output,
      layoutPlan: filtered.layout,
      rawResponse: renderRawResponse(modelRaw, filtered.layout),
      modelRawResponse: modelRaw,
      guard: null,
    };
  }
  const g = guardOutputText(filtered.layout, output.explanation ?? '');
  const explanation = output.explanation === undefined ? undefined : g.explanation;
  const swap =
    output.explanation && g.explanation !== output.explanation
      ? { from: output.explanation, to: g.explanation }
      : undefined;
  return {
    ...output,
    layoutPlan: g.layout,
    ...(explanation === undefined ? {} : { explanation }),
    rawResponse: renderRawResponse(modelRaw, g.layout, swap),
    modelRawResponse: modelRaw,
    guard: g.report,
  };
}
