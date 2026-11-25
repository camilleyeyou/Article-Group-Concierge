import { createHash } from "node:crypto";
/**
 * D-301: labels stay frozen in eval/queries.json; these are excluded only for recall_pct_corrected.
 */
export const DISPUTED_LABELS: ReadonlyArray<{ query_id: string; slug: string; reason: string }> = [
  {
    query_id: 'p1-q05',
    slug: 'chorus-alphabet-x-creating-an-eye-opening-asset-visibility-brand',
    reason: 'Chorus text describes supply-chain asset visibility; no security content',
  },
  {
    query_id: 'p1-q07',
    slug: 'chorus-alphabet-x-creating-an-eye-opening-asset-visibility-brand',
    reason: 'Chorus text describes supply-chain asset visibility; no security content',
  },
  {
    query_id: 'p1-q02',
    slug: 'renew-home-elevating-a-new-brand-to-own-the-market-conversation',
    reason: 'Renew Home is an energy brand; no security content',
  },
];

export function isDisputed(queryId: string, slug: string): boolean {
  return DISPUTED_LABELS.some((d) => d.query_id === queryId && d.slug === slug);
}

/** D-603: held-out labels approved 2026-11-24; frozen like the original set. sha256 of JSON.stringify(heldOutEntries) in file order. */
export const HELD_OUT_SHA256 = '22428daf29afeb55d99707c50c9786f6d464f07de163287da2d26a7e744dd9a8';

export function heldOutDigest(queries: Array<{ held_out?: boolean }>): string {
  return createHash('sha256').update(JSON.stringify(queries.filter((q) => q.held_out === true))).digest('hex');
}
