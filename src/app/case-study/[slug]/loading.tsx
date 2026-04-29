/**
 * Route-level loading skeleton for case study detail pages.
 *
 * Renders instantly on navigation while the client component fetches
 * data, so users see the page chrome and a skeleton hero — never a
 * blank white screen.
 */
export default function CaseStudyLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Top nav skeleton matching the real navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#eee]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="h-5 w-16 bg-[#eee] rounded animate-pulse" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#eee] rounded animate-pulse" />
              <div className="h-5 w-24 bg-[#eee] rounded animate-pulse hidden sm:block" />
            </div>
            <div className="h-9 w-20 bg-[#eee] animate-pulse" />
          </div>
        </div>
      </nav>

      {/* Hero skeleton - matches real hero proportions so layout doesn't shift */}
      <section
        className="relative min-h-[55vh] sm:min-h-[60vh] lg:min-h-[70vh] flex items-end overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #1a1a1a 0%, #32373c 50%, #1a1a1a 100%)',
        }}
      >
        <div className="relative z-10 w-full pb-10 sm:pb-16 lg:pb-20 pt-24 sm:pt-28 px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1200px] mx-auto">
            <div className="h-4 w-24 bg-white/10 rounded mb-4 animate-pulse" />
            <div className="h-9 sm:h-14 w-3/4 max-w-2xl bg-white/10 rounded mb-3 animate-pulse" />
            <div className="h-9 sm:h-14 w-1/2 max-w-md bg-white/10 rounded mb-6 animate-pulse" />
            <div className="flex gap-3">
              <div className="h-7 w-24 bg-white/10 rounded animate-pulse" />
              <div className="h-7 w-20 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* PDF section header skeleton */}
      <div className="bg-black px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
          <div className="h-9 w-28 bg-white/10 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
