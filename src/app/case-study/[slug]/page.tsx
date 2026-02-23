'use client';

/**
 * Case Study Detail Page - PDF-First Design (Optimized)
 * 
 * Three sections:
 * 1. Hero Section - Video background or gradient with title
 * 2. Document Section - Full-width native PDF embed
 * 3. Knowledge Base - Related articles and support videos
 */

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CaseStudy {
  id: string;
  title: string;
  client_name: string;
  slug: string;
  summary: string;
  pdf_url: string | null;
  thumbnail_url: string | null;
  hero_video_url: string | null;
  vimeo_url: string | null;
}

interface Capability {
  name: string;
  slug: string;
}

interface Industry {
  name: string;
  slug: string;
}

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  thumbnail_url: string | null;
  pdf_url: string | null;
}

interface RelatedCaseStudy {
  id: string;
  title: string;
  slug: string;
  client_name: string | null;
  summary: string | null;
  thumbnail_url: string | null;
}

interface SupportVideo {
  id: string;
  video_url: string;
  title: string | null;
  description: string | null;
}

export default function CaseStudyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [relatedCaseStudies, setRelatedCaseStudies] = useState<RelatedCaseStudy[]>([]);
  const [supportVideos, setSupportVideos] = useState<SupportVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCaseStudy() {
      try {
        const response = await fetch(`/api/case-study/${slug}`);
        if (!response.ok) throw new Error('Case study not found');
        const data = await response.json();
        setCaseStudy(data.caseStudy);
        setCapabilities(data.capabilities || []);
        setIndustries(data.industries || []);
        setRelatedArticles(data.relatedArticles || []);
        setRelatedCaseStudies(data.relatedCaseStudies || []);
        setSupportVideos(data.supportVideos || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchCaseStudy();
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#eee] border-t-[#fc5d4c] rounded-full animate-spin" />
          <p className="text-[#6B6B6B] font-medium">
            Loading case study...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={{ fontFamily: 'Poppins, sans-serif' }}>
        <div className="text-center px-6">
          <h1 className="text-3xl text-black mb-4" style={{ fontFamily: 'Lora, serif' }}>
            Case Study Not Found
          </h1>
          <p className="text-[#6B6B6B] mb-8">
            We couldn't find the case study you're looking for.
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 bg-[#32373c] text-white font-medium hover:bg-black transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // Parse title
  const titleParts = caseStudy.title.split(':');
  const clientName = titleParts.length > 1 ? titleParts[0].trim() : caseStudy.client_name;
  const projectTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;

  // Check for hero video
  const heroVideoUrl = caseStudy.hero_video_url || 
    (caseStudy.vimeo_url?.includes('.mp4') ? caseStudy.vimeo_url : null);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#eee]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#313131] hover:text-black transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium hidden sm:inline">Back</span>
            </Link>

            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-black rounded flex items-center justify-center">
                <span className="text-white font-semibold text-sm">AG</span>
              </div>
              <span className="font-semibold text-black text-lg hidden sm:block" style={{ fontFamily: 'Lora, serif' }}>
                Article Group
              </span>
            </Link>

            <Link
              href="/contact"
              className="px-5 py-2 bg-[#32373c] text-white text-sm font-medium hover:bg-black transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </nav>

      {/* ============================================ */}
      {/* SECTION 1: HERO - Full viewport dramatic */}
      {/* ============================================ */}
      <section className="relative min-h-[60vh] lg:min-h-[70vh] flex items-end overflow-hidden">
        {/* Background: Video or Gradient */}
        {heroVideoUrl ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            >
              <source src={heroVideoUrl} type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/20" />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #32373c 50%, #1a1a1a 100%)',
            }}
          >
            {/* Subtle animated gradient orbs */}
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#fc5d4c]/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-[#0d72d1]/8 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#47ddb2]/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />
          </div>
        )}

        {/* Content Overlay */}
        <div className="relative z-10 w-full pb-12 sm:pb-16 lg:pb-20 pt-28 px-6 lg:px-8">
          <div className="max-w-[1200px] mx-auto">
            {/* Client name label */}
            {clientName && (
              <div className="mb-4 animate-fade-in">
                <span className="text-[#fc5d4c] text-sm font-medium uppercase tracking-wider">
                  {clientName}
                </span>
              </div>
            )}

            {/* Project title - dramatic sizing */}
            <h1
              className="text-3xl sm:text-5xl lg:text-6xl text-white leading-[1.1] max-w-4xl mb-6 animate-fade-in-up"
              style={{ fontFamily: 'Lora, serif', fontWeight: 400, letterSpacing: '-0.02em' }}
            >
              {projectTitle}
            </h1>

            {/* Tags with better styling */}
            {(capabilities.length > 0 || industries.length > 0) && (
              <div className="flex flex-wrap gap-3 animate-fade-in" style={{ animationDelay: '200ms' }}>
                {capabilities.slice(0, 3).map((cap, i) => (
                  <span
                    key={i}
                    className="px-4 py-1.5 text-xs sm:text-sm bg-[#0d72d1]/20 text-[#7bb8eb] font-medium"
                  >
                    {cap.name}
                  </span>
                ))}
                {industries.slice(0, 2).map((ind, i) => (
                  <span
                    key={i}
                    className="px-4 py-1.5 text-xs sm:text-sm bg-white/10 text-white/80 font-medium"
                  >
                    {ind.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-white/50 animate-bounce">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ============================================ */}
      {/* SECTION 2: DOCUMENT (PDF) - Full Width */}
      {/* ============================================ */}
      <section className="bg-[#F5F5F5]">
        {/* PDF Header Bar */}
        <div className="bg-black border-b border-white/10 px-6 lg:px-8 py-3">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <h2 className="text-white text-sm sm:text-base font-medium">
              Case Study Document
            </h2>
            {caseStudy.pdf_url && (
              <a
                href={caseStudy.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-[#fc5d4c] text-white text-sm font-medium hover:bg-[#e54d3c] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span className="hidden sm:inline">Download PDF</span>
                <span className="sm:hidden">Download</span>
              </a>
            )}
          </div>
        </div>

        {/* PDF Viewer - Native embed with reasonable height */}
        {caseStudy.pdf_url ? (
          <div className="w-full bg-[#525659]">
            <embed
              src={`${caseStudy.pdf_url}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
              type="application/pdf"
              className="w-full"
              style={{
                height: '85vh',
                maxHeight: '900px',
                minHeight: '600px',
              }}
            />
          </div>
        ) : (
          <div className="py-20 text-center bg-[#F5F5F5]">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#eee] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#6B6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl text-black mb-3" style={{ fontFamily: 'Lora, serif' }}>
              Document Coming Soon
            </h3>
            <p className="text-[#6B6B6B]">
              The detailed case study document is being prepared.
            </p>
          </div>
        )}
      </section>

      {/* ============================================ */}
      {/* SECTION 3: KNOWLEDGE BASE */}
      {/* ============================================ */}
      {(relatedCaseStudies.length > 0 || relatedArticles.length > 0 || supportVideos.length > 0) && (
        <section className="py-16 sm:py-24 px-6 lg:px-8 bg-[#F5F5F5]">
          <div className="max-w-[1200px] mx-auto">
            {/* Section header - AG style */}
            <div className="mb-12 sm:mb-16">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-[#fc5d4c]" />
                <div className="w-2 h-2 rounded-full bg-[#47ddb2]" />
                <div className="w-2 h-2 rounded-full bg-[#0d72d1]" />
              </div>
              <h2
                className="text-3xl sm:text-4xl text-black mb-3"
                style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
              >
                Related Resources
              </h2>
              <p className="text-[#6B6B6B] text-base sm:text-lg max-w-xl">
                Explore more of our work and thinking in similar areas.
              </p>
            </div>

            {/* Related Case Studies */}
            {relatedCaseStudies.length > 0 && (
              <div className="mb-12">
                <h3 className="text-lg text-black mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#47ddb2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Related Case Studies
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {relatedCaseStudies.slice(0, 4).map((cs) => {
                    const titleParts = cs.title.split(':');
                    const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : cs.title;
                    const clientLabel = titleParts.length > 1 ? titleParts[0].trim() : cs.client_name;

                    return (
                      <Link
                        key={cs.id}
                        href={`/case-study/${cs.slug}`}
                        className="group bg-white border border-transparent hover:border-black overflow-hidden transition-all duration-200"
                      >
                        <div className="aspect-[4/3] bg-[#eee] relative overflow-hidden">
                          {cs.thumbnail_url ? (
                            <img
                              src={cs.thumbnail_url}
                              alt={cs.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0d72d1]/20 to-[#32373c]">
                              <span className="text-4xl text-white/20" style={{ fontFamily: 'Lora, serif' }}>
                                {(clientLabel || displayTitle).charAt(0)}
                              </span>
                            </div>
                          )}
                          {/* Overlay for text */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>

                        <div className="p-4">
                          {clientLabel && (
                            <p className="text-xs text-[#0d72d1] font-medium mb-1">
                              {clientLabel}
                            </p>
                          )}
                          <h4 className="text-black text-sm font-medium line-clamp-2 group-hover:text-[#fc5d4c] transition-colors">
                            {displayTitle}
                          </h4>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <div className="mb-12">
                <h3 className="text-lg text-black mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#fc5d4c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                  Related Articles
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {relatedArticles.slice(0, 6).map((article) => (
                    <Link
                      key={article.id}
                      href={`/article/${article.slug}`}
                      className="group bg-white border border-transparent hover:border-black overflow-hidden transition-all duration-200"
                    >
                      <div className="aspect-[16/10] bg-[#eee] relative overflow-hidden">
                        {article.thumbnail_url ? (
                          <img
                            src={article.thumbnail_url}
                            alt={article.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F5F5F5] to-[#eee]">
                            <svg className="w-10 h-10 text-[#6B6B6B]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        <h4 className="text-black text-sm font-medium line-clamp-2 group-hover:text-[#fc5d4c] transition-colors">
                          {article.title.replace(/_/g, ' ')}
                        </h4>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Support Videos */}
            {supportVideos.length > 0 && (
              <div>
                <h3 className="text-lg text-black mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#0d72d1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Related Videos
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {supportVideos.slice(0, 4).map((video) => (
                    <div key={video.id} className="bg-white border border-[#eee] overflow-hidden">
                      <video
                        controls
                        className="w-full aspect-video bg-black"
                        preload="metadata"
                        poster={caseStudy.thumbnail_url || undefined}
                      >
                        <source src={video.video_url} type="video/mp4" />
                      </video>
                      {video.title && (
                        <div className="p-4">
                          <h4 className="text-black text-sm font-medium">
                            {video.title}
                          </h4>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* CTA SECTION - More impactful */}
      {/* ============================================ */}
      <section className="bg-black relative overflow-hidden">
        {/* Subtle gradient orbs */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#fc5d4c]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#0d72d1]/10 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto px-6 lg:px-8 py-20 sm:py-28 text-center relative">
          <h2
            className="text-3xl sm:text-4xl lg:text-5xl text-white mb-6"
            style={{ fontFamily: 'Lora, serif', fontWeight: 400, letterSpacing: '-0.02em' }}
          >
            Interested in similar work?
          </h2>
          <p className="text-white/60 text-lg sm:text-xl mb-10 max-w-xl mx-auto">
            Let's discuss how Article Group can help with your next project.
          </p>
          <Link
            href="/contact"
            className="group inline-flex items-center gap-3 px-10 py-5 bg-[#fc5d4c] text-white font-medium hover:bg-[#e54d3c] transition-all duration-300 text-lg"
          >
            <span>Start a Conversation</span>
            <svg
              className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-[#eee]">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                <span className="text-white font-semibold text-xs">AG</span>
              </div>
              <span className="text-black text-base" style={{ fontFamily: 'Lora, serif' }}>
                Article Group
              </span>
            </Link>
            <p className="text-[#6B6B6B] text-sm">
              © {new Date().getFullYear()} Article Group
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
