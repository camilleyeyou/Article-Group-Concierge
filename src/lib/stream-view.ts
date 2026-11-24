/**
 * Pure view-state for the streaming chat UI (Phase 5, D-501..D-503, D-506, D-507).
 * Client-safe: no node modules, no React. The page dispatches StreamEvents into the reducer and renders deriveLayout().
 */
import type { CaseStudyTeaserProps, ComponentType, HeroBlockProps, LayoutComponent } from '../types';
import type { InstantTeaser, PublicOrchestratorOutput, StreamEvent, SuppressReason } from './stream-events';

export const NETWORK_ERROR_MESSAGE = "We couldn't reach the concierge. Check your connection and try again.";

export interface StreamViewState {
  phase: 'waiting' | 'teasers' | 'streaming' | 'done' | 'error';
  instantTeasers: InstantTeaser[];
  suppressed: SuppressReason | null;
  hero: Partial<HeroBlockProps> | null;
  heroDone: boolean;
  components: Array<{ index: number; component: ComponentType; props: Record<string, unknown> }>;
  narrative: string;
  final: PublicOrchestratorOutput | null;
  error: { message: string; retryable: boolean; contactCTA: boolean } | null;
  exitingSlugs: string[];
}

export type StreamViewAction = StreamEvent | { type: 'exit_done' } | { type: 'closed' };

export const initialStreamView: StreamViewState = {
  phase: 'waiting',
  instantTeasers: [],
  suppressed: null,
  hero: null,
  heroDone: false,
  components: [],
  narrative: '',
  final: null,
  error: null,
  exitingSlugs: [],
};

export function reconcileTeasers(
  instant: InstantTeaser[],
  finalTeasers: CaseStudyTeaserProps[],
): { ordered: CaseStudyTeaserProps[]; removed: string[] } {
  const keep = new Set(finalTeasers.map(t => t.slug));
  return {
    ordered: [...finalTeasers],
    removed: instant.map(t => t.slug).filter(slug => !keep.has(slug)),
  };
}

function finalTeaserProps(output: PublicOrchestratorOutput): CaseStudyTeaserProps[] {
  return (output.layoutPlan?.layout ?? [])
    .filter(c => c.component === 'CaseStudyTeaser')
    .map(c => c.props as CaseStudyTeaserProps);
}

export function streamViewReducer(s: StreamViewState, a: StreamViewAction): StreamViewState {
  switch (a.type) {
    case 'teasers':
      return { ...s, phase: s.phase === 'waiting' ? 'teasers' : s.phase, instantTeasers: a.items };
    case 'suppressed':
      return { ...s, phase: s.phase === 'waiting' ? 'teasers' : s.phase, suppressed: a.reason, instantTeasers: [] };
    case 'hero': {
      const { type: _t, ...fields } = a;
      void _t;
      return { ...s, phase: 'streaming', hero: { ...(s.hero ?? {}), ...fields } };
    }
    case 'hero_done':
      return { ...s, phase: 'streaming', hero: { ...a.props }, heroDone: true };
    case 'component': {
      const rest = s.components.filter(c => c.index !== a.index);
      rest.push({ index: a.index, component: a.component, props: a.props });
      return { ...s, phase: 'streaming', components: rest };
    }
    case 'narrative':
      return { ...s, narrative: s.narrative + a.text };
    case 'final': {
      const { removed } = reconcileTeasers(s.instantTeasers, finalTeaserProps(a.output));
      return { ...s, phase: 'done', final: a.output, exitingSlugs: removed, error: null };
    }
    case 'error':
      return {
        ...s,
        phase: 'error',
        error: { message: a.explanation, retryable: a.retryable, contactCTA: a.contactCTA },
      };
    case 'exit_done':
      return { ...s, exitingSlugs: [] };
    case 'closed':
      if (s.phase === 'done' || s.phase === 'error') return s;
      return { ...s, phase: 'error', error: { message: NETWORK_ERROR_MESSAGE, retryable: true, contactCTA: false } };
    case 'debug':
    default:
      return s;
  }
}

function toTeaser(t: InstantTeaser): CaseStudyTeaserProps {
  return { ...t, summary: t.summary ?? '' };
}

export function deriveLayout(s: StreamViewState): {
  layout: LayoutComponent[];
  pendingHero: boolean;
  exitingSlugs: string[];
  exiting: LayoutComponent[];
} {
  // Summaries the model has already sent for teasers, by slug (needed for exiting cards too).
  const modelTeasers = new Map<string, CaseStudyTeaserProps>();
  for (const c of s.components) {
    if (c.component === 'CaseStudyTeaser') {
      const p = c.props as unknown as CaseStudyTeaserProps;
      modelTeasers.set(p.slug, p);
    }
  }

  const exiting: LayoutComponent[] = s.exitingSlugs
    .map(slug => s.instantTeasers.find(t => t.slug === slug))
    .filter((t): t is InstantTeaser => !!t)
    .map(t => ({ component: 'CaseStudyTeaser' as const, props: modelTeasers.get(t.slug) ?? toTeaser(t) }));

  if (s.phase === 'done' && s.final) {
    return {
      layout: s.final.layoutPlan.layout,
      pendingHero: false,
      exitingSlugs: [...s.exitingSlugs],
      exiting,
    };
  }

  const layout: LayoutComponent[] = [];

  if (s.hero) {
    const props: HeroBlockProps = {
      title: s.hero.title ?? '',
      subtitle: s.hero.subtitle,
      challengeSummary: s.hero.challengeSummary,
      // The model emits 'dark' almost always; the skeleton is dark, so avoid a light flash while streaming.
      backgroundVariant: s.hero.backgroundVariant ?? (s.heroDone ? undefined : 'dark'),
    };
    layout.push({ component: 'HeroBlock', props });
  }

  const nonTeasers = s.components
    .filter(c => c.component !== 'CaseStudyTeaser' && c.component !== 'HeroBlock')
    .sort((x, y) => x.index - y.index);
  for (const c of nonTeasers) {
    layout.push({ component: c.component, props: c.props as unknown as LayoutComponent['props'] });
  }

  const teasers: CaseStudyTeaserProps[] = s.instantTeasers.map(t => modelTeasers.get(t.slug) ?? toTeaser(t));
  const instantSlugs = new Set(s.instantTeasers.map(t => t.slug));
  for (const c of s.components) {
    if (c.component !== 'CaseStudyTeaser') continue;
    const p = c.props as unknown as CaseStudyTeaserProps;
    if (!instantSlugs.has(p.slug)) teasers.push(p);
  }
  for (const t of teasers) layout.push({ component: 'CaseStudyTeaser', props: t });

  const pendingHero = !s.hero && (s.phase === 'teasers' || s.phase === 'streaming');
  return { layout, pendingHero, exitingSlugs: [], exiting: [] };
}
