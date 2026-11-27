/**
 * Named query-id subsets for cheap eval iteration.
 * D-416 smoke subset: remaining gap-run claims + invention bait + pricing/timeline + video.
 */

export const PHASE4_SMOKE_IDS = [
  // remaining claims
  'p1-q01', 'p1-q02', 'p1-q09', 'p2-q01', 'p3-q02', 'p3-q03', 'p3-q05', 'p3-q10',
  'p4-q01', 'p4-q06', 'p4-q10', 'p5-q05',
  // invention bait
  'p2-q09', 'p3-q09', 'p5-q09',
  // pricing / timeline
  'p5-q06', 'p5-q07', 'p5-q10', 'p3-q07',
  // video
  'p1-q05', 'p4-q05',
] as const;

/** Phase 6 fix-pass verification subset (original 50 only, D-607). */
export const PHASE6_FIX_IDS = [
  // targeted: count claim, recall, video, remaining "other" claims
  'p1-q07', 'p2-q03', 'p2-q05', 'p4-q05', 'p3-q01', 'p4-q04', 'p5-q05',
  // voice (scored 4 last run)
  'p1-q02', 'p2-q02', 'p3-q02', 'p3-q09', 'p4-q03', 'p5-q01', 'p5-q07', 'p5-q09',
  // guards: invention bait, pricing/timeline, video
  'p1-q09', 'p2-q09', 'p4-q09', 'p5-q06', 'p5-q10', 'p1-q05',
] as const;

/** Phase 7 fast-hero trial subset: 10 original-50 ids whose user-seen heroes restate in 2026-11-26T05-24-15. */
export const PHASE7_HERO_IDS = [
  'p1-q01', 'p1-q04', 'p1-q05', 'p1-q08', 'p2-q05',
  'p2-q09', 'p3-q01', 'p4-q04', 'p5-q06', 'p5-q07',
] as const;

/** Held-out query ids are p1-h01..p5-h05 (D-602). */
export const HELD_OUT_ID_PATTERN = /^p[1-5]-h\d{2}$/;

export const SUBSETS: Record<string, readonly string[]> = {
  'phase4-smoke': PHASE4_SMOKE_IDS,
  'phase6-fix': PHASE6_FIX_IDS,
  'phase7-hero': PHASE7_HERO_IDS,
};

/** `ids` (comma list) wins over `subset`; returns undefined when neither is given. */
export function resolveIds(opts: { ids?: string; subset?: string }): string[] | undefined {
  if (opts.ids !== undefined) {
    const ids = opts.ids.split(',').map(s => s.trim()).filter(Boolean);
    return ids.length ? ids : undefined;
  }
  if (opts.subset !== undefined) {
    const found = SUBSETS[opts.subset];
    if (!found) {
      throw new Error(`Unknown subset "${opts.subset}". Valid subsets: ${Object.keys(SUBSETS).join(', ')}`);
    }
    return [...found];
  }
  return undefined;
}
