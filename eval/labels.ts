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
