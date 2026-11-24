/**
 * GEN-03 post-processing: overwrite teaser capabilities/industries from DB links so the model can
 * never invent tags, and re-render the raw response so the eval grader sees what the user sees.
 * Pure module (no I/O).
 * The 04-07 verifier hooks in after this.
 */
import type { LayoutPlan, OrchestratorOutput, CaseStudyTeaserProps } from '../types';
import type { CatalogueTags } from './catalogue';

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
  return {
    ...output,
    layoutPlan: tagged.layout,
    rawResponse: renderRawResponse(modelRaw, tagged.layout),
    modelRawResponse: modelRaw,
  };
}
