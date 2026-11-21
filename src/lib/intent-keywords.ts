/**
 * Query-intent keyword maps (pure module: no Supabase client, no env access).
 *
 * Every key must be a real slug in the `capabilities` / `industries` tables
 * (verified by `npx tsx scripts/check-intent-slugs.ts`).
 *
 * Matching is lowercase substring (unchanged). Whole-word matching is RETR-02 (Phase 3),
 * so new keywords must be >= 4 characters or contain a space.
 */

/** Maps common terms users might use to capability slugs. */
export const CAPABILITY_KEYWORDS: Record<string, string[]> = {
  'brand-strategy': ['brand', 'branding', 'rebrand', 'brand identity', 'brand positioning', 'brand architecture'],
  'creative-direction': ['creative', 'visual', 'design', 'art direction', 'look and feel'],
  'content-strategy': ['content', 'storytelling', 'copywriting', 'editorial'],
  'messaging-positioning': ['messaging', 'positioning', 'narrative', 'marketecture', 'message house'],
  'social-strategy': ['social', 'social media', 'instagram', 'tiktok', 'twitter', 'facebook', 'linkedin', 'community'],
  'video-production': ['video', 'film', 'commercial', 'documentary', 'motion', 'animation'],
  'growth-marketing': ['digital', 'marketing', 'paid media', 'advertising', 'campaign', 'ads'],
  'events-keynotes': ['experiential', 'event', 'keynote', 'conference', 'virtual event', 'activation', 'pop-up', 'launch event', 'experience'],
  'experience-design': ['web', 'website', 'digital product', 'app', 'platform', 'ux', 'ui'],
  'go-to-market': ['go-to-market', 'gtm strategy', 'product launch'],
  'sales-enablement': ['sales enablement', 'sales deck', 'enablement', 'partner marketing'],
  'thought-leadership': ['thought leadership', 'white paper', 'ebook', 'editorial program'],
  'naming': ['naming', 'product name'],
  'research-insights': ['research', 'insights', 'audience research'],
};

/** Maps common terms to industry slugs. */
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'technology': ['tech', 'technology', 'software', 'saas', 'startup', 'ai', 'fintech', 'b2b tech'],
  'enterprise-software': ['enterprise software', 'productivity', 'workspace', 'browser'],
  'consumer-tech': ['consumer tech', 'smartphone', 'mobile', 'android'],
  'artificial-intelligence': ['artificial intelligence', 'generative', 'gen ai', 'genai', 'machine learning', 'large language model'],
  'cloud-infrastructure': ['cloud', 'infrastructure', 'data center'],
  'cybersecurity': ['security', 'cybersecurity', 'cyber', 'threat'],
  'finance': ['finance', 'financial', 'banking', 'fintech', 'investment', 'insurance', 'wealth'],
  'healthcare': ['health', 'healthcare', 'medical', 'pharma', 'wellness', 'fitness', 'biotech'],
  'consumer-goods': ['consumer', 'consumer goods', 'cpg', 'dtc', 'food', 'beverage', 'fashion'],
  'retail': ['retail', 'ecommerce', 'retailers'],
  'media-entertainment': ['entertainment', 'media', 'streaming', 'gaming', 'sports', 'music'],
  'real-estate': ['real estate', 'property', 'commercial real estate', 'residential'],
  'education': ['education', 'edtech', 'learning', 'university', 'school'],
  'non-profit': ['nonprofit', 'ngo', 'charity', 'foundation', 'social impact'],
  'b2b-services': ['human resources', 'payroll', 'consulting', 'professional services'],
  'energy': ['energy', 'utility', 'utilities', 'smart home'],
};

/** A detected industry also pulls in these slugs (the broad 'technology' tag covers few studies). */
export const INDUSTRY_GROUPS: Record<string, string[]> = {
  technology: [
    'enterprise-software',
    'consumer-tech',
    'artificial-intelligence',
    'cloud-infrastructure',
    'cybersecurity',
    'technology',
  ],
};

function detect(lowerQuery: string, map: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const [slug, keywords] of Object.entries(map)) {
    if (keywords.some((k) => lowerQuery.includes(k.toLowerCase())) && !out.includes(slug)) {
      out.push(slug);
    }
  }
  return out;
}

/** Detects capabilities and industries from a user query (lowercase substring match). */
export function detectQueryIntent(query: string): { capabilities: string[]; industries: string[] } {
  const lower = query.toLowerCase();
  const capabilities = detect(lower, CAPABILITY_KEYWORDS);
  const detected = detect(lower, INDUSTRY_KEYWORDS);
  const industries = [...detected];
  for (const slug of detected) {
    for (const member of INDUSTRY_GROUPS[slug] ?? []) {
      if (!industries.includes(member)) industries.push(member);
    }
  }
  return { capabilities, industries };
}

/** Every slug the maps can emit. */
export function allIntentSlugs(): { capabilities: string[]; industries: string[] } {
  const industries = new Set<string>(Object.keys(INDUSTRY_KEYWORDS));
  for (const members of Object.values(INDUSTRY_GROUPS)) members.forEach((m) => industries.add(m));
  return { capabilities: Object.keys(CAPABILITY_KEYWORDS), industries: [...industries] };
}
