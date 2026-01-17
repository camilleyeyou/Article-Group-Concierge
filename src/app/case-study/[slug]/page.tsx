'use client';

/**
 * Case Study Detail Page
 * 
 * Displays full case study content with Challenge, Journey, Solution sections
 * and visual assets throughout - matching the AG website design.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CaseStudy {
  id: string;
  title: string;
  client_name: string;
  slug: string;
  summary: string;
  document_type: string;
  thumbnail_url: string | null;
  hero_image_url: string | null;
  vimeo_url: string | null;
}

interface ContentChunk {
  id: string;
  content: string;
  chunk_index: number;
  chunk_type: string;
}

interface VisualAsset {
  id: string;
  storage_path: string;
  bucket_name: string;
  asset_type: string;
  original_filename: string;
  alt_text: string | null;
}

interface Capability {
  name: string;
  slug: string;
}

interface Industry {
  name: string;
  slug: string;
}

/**
 * Get public URL for a visual asset
 */
function getAssetUrl(asset: VisualAsset): string {
  // Use the environment variable for Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/storage/v1/object/public/${asset.bucket_name}/${asset.storage_path}`;
}

/**
 * Aggressive content cleaner - removes ALL junk and fixes punctuation
 */
function cleanContent(text: string | null | undefined): string {
  if (!text) return '';
  
  let cleaned = text
    .replace(/^\s*\{["\s]*markdown["\s]*:\s*["]/gi, '')
    .replace(/["]\s*\}\s*$/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/###\s*/g, '')
    .replace(/Text Extracted\s*/gi, '')
    .replace(/Extracted Text\s*/gi, '')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^[-●•]\s*/gm, '')
    .replace(/\\n-\s*/g, ' ')
    .replace(/No tables were present[^.]*\.?/gi, '')
    .replace(/No images were present[^.]*\.?/gi, '')
    .replace(/Since there were no images[^.]*\.?/gi, '')
    .replace(/There are no tables[^.]*\.?/gi, '')
    .replace(/There are no images[^.]*\.?/gi, '')
    .replace(/Tables and Images/gi, '')
    .replace(/Image Descriptions/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  cleaned = cleaned
    .replace(/\s+(Challenge|Journey|Solution|Overview|Title|Subtitle)\s+/gi, '. ')
    .replace(/^(Challenge|Journey|Solution|Overview|Title|Subtitle)\s+/gi, '');
  
  cleaned = cleaned
    .replace(/\s*(Yes|No|Not yet|N\/A|None|TBD|Confidential|Proprietary)\s*$/gi, '')
    .replace(/\s*(Yes|No|Not yet|N\/A|None|TBD)\s*$/gi, '');
  
  cleaned = cleaned.replace(/\s*(Yes|No|Not yet)\.?\s*$/gi, '');
  cleaned = cleaned.replace(/([a-z])([A-Z][a-z])/g, '$1. $2');
  cleaned = cleaned.replace(/\.([A-Z])/g, '. $1');
  cleaned = cleaned.replace(/([a-z])(Journey|Solution|Challenge)/g, '$1. $2');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/^\.\s*/, '');
  cleaned = cleaned.replace(/\.\s*(Challenge|Journey|Solution)\s*\.?\s*$/gi, '.');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length > 10 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  
  return cleaned;
}

/**
 * Extract a clean summary
 */
function getCleanSummary(summary: string | null, chunks: ContentChunk[]): string | null {
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const fullChunk = chunks.find(c => c.chunk_type === 'full');
  
  if (challengeChunk) {
    const cleaned = cleanContent(challengeChunk.content);
    if (cleaned.length > 50) {
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        let result = '';
        let count = 0;
        for (const sentence of sentences) {
          if (result.length + sentence.length > 400) break;
          result += sentence;
          count++;
          if (count >= 3) break;
        }
        if (result.trim().length > 50) {
          return result.trim();
        }
      }
      if (cleaned.length > 350) {
        const truncated = cleaned.slice(0, 350);
        const lastSpace = truncated.lastIndexOf(' ');
        return truncated.slice(0, lastSpace) + '...';
      }
      return cleaned;
    }
  }
  
  if (summary) {
    const cleaned = cleanContent(summary);
    if (cleaned.length > 50 && 
        !cleaned.toLowerCase().includes('markdown') && 
        !cleaned.includes('\\n') &&
        !cleaned.toLowerCase().includes('text extracted')) {
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        let result = '';
        let count = 0;
        for (const sentence of sentences) {
          if (result.length + sentence.length > 400) break;
          result += sentence;
          count++;
          if (count >= 3) break;
        }
        if (result.trim().length > 50) {
          return result.trim();
        }
      }
    }
  }
  
  if (fullChunk) {
    const cleaned = cleanContent(fullChunk.content);
    const withoutHeader = cleaned.replace(/^(Challenge|Journey|Solution)\s*/i, '');
    if (withoutHeader.length > 50) {
      const sentences = withoutHeader.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        let result = '';
        let count = 0;
        for (const sentence of sentences) {
          if (result.length + sentence.length > 400) break;
          result += sentence;
          count++;
          if (count >= 3) break;
        }
        if (result.trim().length > 50) {
          return result.trim();
        }
      }
    }
  }
  
  return null;
}

/**
 * Image Gallery Component - displays 2-4 images in a grid
 */
function ImageGallery({ images, className = '' }: { images: VisualAsset[]; className?: string }) {
  if (images.length === 0) return null;
  
  // Determine grid layout based on number of images
  const gridClass = images.length === 1 
    ? 'grid-cols-1' 
    : images.length === 2 
      ? 'grid-cols-2' 
      : images.length === 3
        ? 'grid-cols-3'
        : 'grid-cols-2 md:grid-cols-4';
  
  return (
    <div className={`grid ${gridClass} gap-4 ${className}`}>
      {images.map((img, i) => (
        <div 
          key={img.id} 
          className={`relative overflow-hidden rounded-xl bg-gray-100 ${
            images.length === 1 ? 'aspect-video' : 'aspect-square'
          }`}
        >
          <img
            src={getAssetUrl(img)}
            alt={img.alt_text || `Case study image ${i + 1}`}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

export default function CaseStudyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [chunks, setChunks] = useState<ContentChunk[]>([]);
  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCaseStudy() {
      try {
        const response = await fetch(`/api/case-study/${slug}`);
        if (!response.ok) {
          throw new Error('Case study not found');
        }
        const data = await response.json();
        setCaseStudy(data.caseStudy);
        setChunks(data.chunks || []);
        setAssets(data.assets || []);
        setCapabilities(data.capabilities || []);
        setIndustries(data.industries || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load case study');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchCaseStudy();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-t-[#F96A63] animate-spin"></div>
          </div>
          <p className="text-[#595959] font-medium">Loading case study...</p>
        </div>
      </div>
    );
  }

  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-serif text-[#1A1818] mb-4">Case Study Not Found</h1>
          <p className="text-[#595959] mb-6">
            We couldn't find the case study you're looking for.
          </p>
          <button
            onClick={() => router.back()}
            className="px-6 py-3 bg-[#1A1818] text-white rounded-full font-medium hover:bg-[#333] transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Parse title
  const titleParts = caseStudy.title.split(':');
  const displayClient = titleParts.length > 1 ? titleParts[0].trim() : caseStudy.client_name;
  const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;

  // Get content sections
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const journeyChunk = chunks.find(c => c.chunk_type === 'journey');
  const solutionChunk = chunks.find(c => c.chunk_type === 'solution');
  const cleanSummary = getCleanSummary(caseStudy.summary, chunks);
  const hasStructuredContent = challengeChunk || journeyChunk || solutionChunk;

  // Organize images - filter out logos and very small images
  const galleryImages = assets.filter(a => 
    a.asset_type !== 'logo' && 
    !a.original_filename?.toLowerCase().includes('logo') &&
    !a.original_filename?.toLowerCase().includes('icon')
  );
  
  // Split images into groups for different sections
  const heroImage = caseStudy.hero_image_url || caseStudy.thumbnail_url;
  const topGalleryImages = galleryImages.slice(0, 4);
  const middleGalleryImages = galleryImages.slice(4, 8);
  const bottomGalleryImages = galleryImages.slice(8, 12);

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#EEEEEE]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[#595959] hover:text-[#1A1818] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
            
            <Link
              href="/contact"
              className="px-5 py-2 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-[#333] transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16">
        {/* Hero Image or Gradient */}
        {heroImage ? (
          <div className="relative">
            <div className="w-full h-[50vh] md:h-[60vh] overflow-hidden">
              <img
                src={heroImage}
                alt={displayTitle}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            </div>
            
            {/* Overlay Content */}
            <div className="absolute bottom-0 left-0 right-0 pb-12 lg:pb-20">
              <div className="max-w-7xl mx-auto px-6 lg:px-12">
                <div className="max-w-4xl">
                  {displayClient && (
                    <div className="inline-flex items-center mb-4">
                      <span className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold tracking-wide text-white border border-white/20">
                        {displayClient}
                      </span>
                    </div>
                  )}
                  <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-normal leading-[1.1] text-white">
                    {displayTitle}
                  </h1>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Fallback Gradient Hero */
          <div className="bg-gradient-to-br from-[#1A1818] via-[#2A2A2A] to-[#1A1818] text-white">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#F96A63]/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0097A7]/10 rounded-full blur-3xl" />
            
            <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32">
              <div className="max-w-4xl">
                {displayClient && (
                  <div className="inline-flex items-center mb-6">
                    <span className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-semibold tracking-wide border border-white/10">
                      {displayClient}
                    </span>
                  </div>
                )}
                <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-normal leading-[1.1] mb-8">
                  {displayTitle}
                </h1>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tags & Capabilities */}
      {(capabilities.length > 0 || industries.length > 0) && (
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-8">
          <div className="flex flex-wrap gap-3">
            {capabilities.map((cap, i) => (
              <span 
                key={`cap-${i}`}
                className="px-4 py-2 text-sm bg-[#0097A7]/10 text-[#0097A7] rounded-full font-medium border border-[#0097A7]/20"
              >
                {cap.name}
              </span>
            ))}
            {industries.map((ind, i) => (
              <span 
                key={`ind-${i}`}
                className="px-4 py-2 text-sm bg-gray-100 text-[#595959] rounded-full border border-gray-200"
              >
                {ind.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Overview Card */}
      {cleanSummary && (
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-8">
          <div className="bg-[#FAFAFA] rounded-2xl border border-[#EEEEEE] p-8 lg:p-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 bg-[#F96A63] rounded-full" />
              <span className="text-xs font-bold text-[#8A8A8A] uppercase tracking-[0.2em]">Overview</span>
            </div>
            <p className="text-xl lg:text-2xl text-[#1A1818] leading-relaxed font-light">
              {cleanSummary}
            </p>
          </div>
        </section>
      )}

      {/* Top Image Gallery - After Overview */}
      {topGalleryImages.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 lg:px-12 py-8">
          <ImageGallery images={topGalleryImages} />
        </section>
      )}

      {/* Main Content */}
      {hasStructuredContent && (
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <div className="space-y-16">
            {/* Challenge */}
            {challengeChunk && (
              <div className="group">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#F96A63]/10 flex items-center justify-center group-hover:bg-[#F96A63]/20 transition-colors">
                    <svg className="w-6 h-6 text-[#F96A63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="font-serif text-3xl lg:text-4xl text-[#1A1818]">Challenge</h2>
                </div>
                <div className="pl-16">
                  <p className="text-lg text-[#595959] leading-relaxed">
                    {cleanContent(challengeChunk.content)}
                  </p>
                </div>
              </div>
            )}

            {/* Middle Image Gallery - Between Challenge and Journey */}
            {middleGalleryImages.length > 0 && (
              <ImageGallery images={middleGalleryImages} className="!pl-0" />
            )}

            {/* Journey */}
            {journeyChunk && (
              <div className="group">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#0097A7]/10 flex items-center justify-center group-hover:bg-[#0097A7]/20 transition-colors">
                    <svg className="w-6 h-6 text-[#0097A7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <h2 className="font-serif text-3xl lg:text-4xl text-[#1A1818]">Journey</h2>
                </div>
                <div className="pl-16">
                  <p className="text-lg text-[#595959] leading-relaxed">
                    {cleanContent(journeyChunk.content)}
                  </p>
                </div>
              </div>
            )}

            {/* Bottom Image Gallery - Between Journey and Solution */}
            {bottomGalleryImages.length > 0 && (
              <ImageGallery images={bottomGalleryImages} className="!pl-0" />
            )}

            {/* Solution */}
            {solutionChunk && (
              <div className="group">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#3FD9A3]/10 flex items-center justify-center group-hover:bg-[#3FD9A3]/20 transition-colors">
                    <svg className="w-6 h-6 text-[#3FD9A3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="font-serif text-3xl lg:text-4xl text-[#1A1818]">Solution</h2>
                </div>
                <div className="pl-16">
                  <p className="text-lg text-[#595959] leading-relaxed">
                    {cleanContent(solutionChunk.content)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Full Image Gallery - Show all remaining images */}
      {galleryImages.length > 12 && (
        <section className="max-w-6xl mx-auto px-6 lg:px-12 py-8">
          <div className="mb-6">
            <span className="text-xs font-bold text-[#8A8A8A] uppercase tracking-[0.2em]">Project Gallery</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.slice(12).map((img, i) => (
              <div 
                key={img.id} 
                className="relative aspect-square overflow-hidden rounded-xl bg-gray-100"
              >
                <img
                  src={getAssetUrl(img)}
                  alt={img.alt_text || `Gallery image ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-[#1A1818] relative overflow-hidden mt-12">
        <div className="absolute inset-0 bg-gradient-to-r from-[#F96A63]/5 via-transparent to-[#0097A7]/5" />
        
        <div className="relative max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28 text-center">
          <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-6 leading-tight">
            Ready to create something<br className="hidden sm:block" /> extraordinary?
          </h3>
          <p className="text-white/60 text-lg lg:text-xl mb-10 max-w-2xl mx-auto">
            Let's discuss how Article Group can help transform your business challenges into breakthrough results.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 px-10 py-5 bg-[#F96A63] text-white font-semibold rounded-full hover:bg-[#e85d56] transition-all duration-300 text-lg shadow-lg shadow-[#F96A63]/25 hover:shadow-xl hover:shadow-[#F96A63]/30 hover:-translate-y-0.5"
          >
            Start a Conversation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#F3F3F3] py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#8A8A8A]">
            © {new Date().getFullYear()} Article Group. All rights reserved.
          </p>
          <button 
            onClick={() => router.back()}
            className="text-sm text-[#595959] hover:text-[#1A1818] transition-colors font-medium"
          >
            Back to Concierge
          </button>
        </div>
      </footer>
    </div>
  );
}
