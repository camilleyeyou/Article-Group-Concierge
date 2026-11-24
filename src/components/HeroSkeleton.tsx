import React from 'react';

/**
 * Reserved hero placeholder shown while a streamed answer is on its way (Phase 5, D-503).
 * Mirrors HeroBlock's container and line boxes, always dark, so the hero arriving causes no layout shift.
 * Decorative only: the status line in the page carries the accessible text.
 */
export const HeroSkeleton: React.FC = () => (
  <section
    aria-hidden="true"
    className="relative overflow-hidden px-6 py-10 md:py-14 rounded-xl bg-[#1A1818] min-h-[220px] md:min-h-[260px]"
  >
    <div className="bg-white/10 rounded animate-pulse h-3 w-24 mb-3" />
    <div className="bg-white/10 rounded animate-pulse h-7 md:h-9 lg:h-11 w-3/4 mb-2" />
    <div className="bg-white/10 rounded animate-pulse h-7 md:h-9 lg:h-11 w-1/2 mb-4" />
    <div className="bg-white/10 rounded animate-pulse h-5 w-full max-w-2xl mb-2" />
    <div className="bg-white/10 rounded animate-pulse h-5 w-2/3" />
  </section>
);

export default HeroSkeleton;
