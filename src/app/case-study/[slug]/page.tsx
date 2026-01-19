'use client';

/**
 * Case Study Detail Page
 * 
 * Premium editorial design matching articlegroup.com
 * Features:
 * - Full-width hero with image or gradient
 * - Client logo/badge
 * - Flowing editorial prose
 * - "Our contribution" sidebar
 * - Image gallery sections
 * - AG brand typography and colors
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return `${supabaseUrl}/storage/v1/object/public/${asset.bucket_name}/${asset.storage_path}`;
}

/**
 * Aggressive content cleaner - removes ALL artifacts and junk
 */
function cleanContent(text: string | null | undefined): string {
  if (!text) return '';
  
  let cleaned = text
    // Remove JSON/markdown wrappers
    .replace(/^\s*\{["\s]*markdown["\s]*:\s*["]/gi, '')
    .replace(/["]\s*\}\s*$/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/###\s*/g, '')
    .replace(/##\s*/g, '')
    .replace(/#\s*/g, '')
    // Remove extraction artifacts
    .replace(/Text Extracted\s*/gi, '')
    .replace(/Extracted Text\s*/gi, '')
    .replace(/Image Descriptions?\s*/gi, '')
    .replace(/Tables and Images\s*/gi, '')
    // Remove escape sequences
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\\/g, '')
    // Remove markdown formatting
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove bullet points
    .replace(/^[-●•►▪︎]\s*/gm, '')
    .replace(/^\d+\.\s*/gm, '')
    // Remove LlamaParse artifacts
    .replace(/No tables were present[^.]*\.?/gi, '')
    .replace(/No images were present[^.]*\.?/gi, '')
    .replace(/Since there were no images[^.]*\.?/gi, '')
    .replace(/There are no tables[^.]*\.?/gi, '')
    .replace(/There are no images[^.]*\.?/gi, '')
    .replace(/The document contains[^.]*\.?/gi, '')
    .replace(/This page contains[^.]*\.?/gi, '')
    // Remove section labels that appear mid-text
    .replace(/\b(Challenge|Journey|Solution|Overview|Title|Subtitle|Summary)\s*[:.]?\s*/gi, '')
    // Remove trailing form artifacts
    .replace(/\s*(Yes|No|Not yet|N\/A|None|TBD|Confidential|Proprietary|NA|n\/a)\s*$/gi, '')
    .replace(/\s*(Yes|No|Not yet)\s*$/gi, '')
    // Remove orphaned parentheses content
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
  
  // Fix punctuation issues
  cleaned = cleaned
    .replace(/([a-z])([A-Z][a-z])/g, '$1. $2') // Add period where sentences merge
    .replace(/\.([A-Z])/g, '. $1') // Add space after periods
    .replace(/,([A-Z])/g, ', $1') // Add space after commas
    .replace(/\.{2,}/g, '.') // Remove multiple periods
    .replace(/\s+\./g, '.') // Remove space before period
    .replace(/^\.\s*/, '') // Remove leading period
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove any remaining trailing artifacts
  cleaned = cleaned
    .replace(/\s+(Yes|No|Not yet|NA|N\/A|TBD|None)\s*\.?\s*$/gi, '')
    .replace(/\.\s*(Yes|No)\s*$/gi, '.')
    .trim();
  
  // Ensure proper ending punctuation
  if (cleaned.length > 10 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  
  return cleaned;
}

/**
 * Split content into well-formed paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  const cleaned = cleanContent(text);
  if (!cleaned || cleaned.length < 20) return [];
  
  // Split on sentence boundaries
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  const paragraphs: string[] = [];
  
  // Group into ~2-3 sentence paragraphs
  for (let i = 0; i < sentences.length; i += 3) {
    const para = sentences.slice(i, i + 3).join(' ').trim();
    // Only include substantial paragraphs
    if (para.length > 30 && !para.match(/^(Yes|No|Not yet|NA|N\/A)/i)) {
      paragraphs.push(para);
    }
  }
  
  return paragraphs;
}

/**
 * Get the best summary from available content
 */
function getBestSummary(chunks: ContentChunk[]): string {
  // Try challenge chunk first (usually best for intro)
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  if (challengeChunk) {
    const paras = splitIntoParagraphs(challengeChunk.content);
    if (paras.length > 0 && paras[0].length > 50) {
      return paras[0];
    }
  }
  
  // Try full chunk
  const fullChunk = chunks.find(c => c.chunk_type === 'full');
  if (fullChunk) {
    const paras = splitIntoParagraphs(fullChunk.content);
    if (paras.length > 0 && paras[0].length > 50) {
      return paras[0];
    }
  }
  
  return '';
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
        if (!response.ok) throw new Error('Case study not found');
        const data = await response.json();
        setCaseStudy(data.caseStudy);
        setChunks(data.chunks || []);
        setAssets(data.assets || []);
        setCapabilities(data.capabilities || []);
        setIndustries(data.industries || []);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#EEEEEE] border-t-[#F96A63] rounded-full animate-spin" />
          <p className="text-[#595959] font-medium" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Loading case study...
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-3xl text-[#1A1818] mb-4" style={{ fontFamily: 'Lora, serif' }}>
            Case Study Not Found
          </h1>
          <p className="text-[#595959] mb-8" style={{ fontFamily: 'Poppins, sans-serif' }}>
            We couldn't find the case study you're looking for.
          </p>
          <button 
            onClick={() => router.back()} 
            className="px-8 py-3 bg-[#1A1818] text-white rounded-full font-medium hover:bg-black transition-colors"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Parse title - "Client: Project Title" format
  const titleParts = caseStudy.title.split(':');
  const clientName = titleParts.length > 1 ? titleParts[0].trim() : caseStudy.client_name;
  const projectTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;

  // Get content sections
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const journeyChunk = chunks.find(c => c.chunk_type === 'journey');
  const solutionChunk = chunks.find(c => c.chunk_type === 'solution');

  // Build paragraphs from all content
  const allParagraphs: string[] = [];
  if (challengeChunk) allParagraphs.push(...splitIntoParagraphs(challengeChunk.content));
  if (journeyChunk) allParagraphs.push(...splitIntoParagraphs(journeyChunk.content));
  if (solutionChunk) allParagraphs.push(...splitIntoParagraphs(solutionChunk.content));

  // Get summary (first substantial paragraph)
  const summary = getBestSummary(chunks);

  // Filter gallery images
  const galleryImages = assets.filter(a => 
    a.asset_type !== 'logo' && 
    !a.original_filename?.toLowerCase().includes('logo') &&
    !a.original_filename?.toLowerCase().includes('icon') &&
    !a.original_filename?.toLowerCase().includes('arrow')
  );

  // Hero image
  const heroImage = caseStudy.hero_image_url || caseStudy.thumbnail_url || 
    (galleryImages.length > 0 ? getAssetUrl(galleryImages[0]) : null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#EEEEEE]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-16">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-[#595959] hover:text-[#1A1818] transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
            
            <Link href="/" className="text-xl text-[#1A1818]" style={{ fontFamily: 'Lora, serif' }}>
              Article Group
            </Link>
            
            <Link
              href="/contact"
              className="px-6 py-2.5 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-black transition-colors"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16">
        {heroImage ? (
          // Hero with Image
          <div className="relative h-[70vh] min-h-[500px] max-h-[800px] overflow-hidden">
            <img
              src={heroImage}
              alt={projectTitle}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
            
            {/* Hero content */}
            <div className="absolute inset-0 flex items-end">
              <div className="w-full max-w-7xl mx-auto px-6 lg:px-12 pb-16 lg:pb-24">
                {/* Client badge */}
                {clientName && (
                  <div className="mb-6">
                    <span 
                      className="inline-block px-5 py-2 bg-white/15 backdrop-blur-sm text-white text-sm font-medium rounded-full border border-white/20"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {clientName}
                    </span>
                  </div>
                )}
                
                {/* Title */}
                <h1 
                  className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-white leading-[1.1] max-w-4xl"
                  style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
                >
                  {projectTitle}
                </h1>
              </div>
            </div>
          </div>
        ) : (
          // Hero with Gradient (fallback)
          <div className="relative bg-[#1A1818] overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#F96A63]/10 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#0097A7]/10 rounded-full blur-[100px]" />
            
            <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-24 lg:py-32">
              {/* Client badge */}
              {clientName && (
                <div className="mb-6">
                  <span 
                    className="inline-block px-5 py-2 bg-white/10 text-white text-sm font-medium rounded-full border border-white/20"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {clientName}
                  </span>
                </div>
              )}
              
              {/* Title */}
              <h1 
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-white leading-[1.1] max-w-4xl"
                style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
              >
                {projectTitle}
              </h1>
            </div>
          </div>
        )}
      </section>

      {/* Summary Section */}
      {summary && (
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
          <h2 
            className="text-2xl sm:text-3xl lg:text-4xl text-[#1A1818] leading-relaxed"
            style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
          >
            {summary}
          </h2>
        </section>
      )}

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-20">
        <div className="grid lg:grid-cols-[1fr_280px] gap-16">
          
          {/* Article Content */}
          <article className="order-2 lg:order-1">
            {/* First image after summary */}
            {galleryImages.length > 1 && (
              <figure className="mb-12">
                <img
                  src={getAssetUrl(galleryImages[1])}
                  alt={galleryImages[1].alt_text || 'Project image'}
                  className="w-full h-auto rounded-lg"
                />
              </figure>
            )}
            
            {/* Content paragraphs with interspersed images */}
            <div className="space-y-6">
              {allParagraphs.slice(1).map((paragraph, idx) => (
                <React.Fragment key={idx}>
                  <p 
                    className="text-lg text-[#595959] leading-relaxed"
                    style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 400 }}
                  >
                    {paragraph}
                  </p>
                  
                  {/* Insert image every 3 paragraphs */}
                  {idx > 0 && idx % 3 === 2 && galleryImages[Math.floor(idx / 3) + 2] && (
                    <figure className="my-12">
                      <img
                        src={getAssetUrl(galleryImages[Math.floor(idx / 3) + 2])}
                        alt={galleryImages[Math.floor(idx / 3) + 2].alt_text || 'Project image'}
                        className="w-full h-auto rounded-lg"
                        loading="lazy"
                      />
                    </figure>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Image Grid - remaining images */}
            {galleryImages.length > 4 && (
              <div className="mt-16">
                <div className="grid grid-cols-2 gap-4">
                  {galleryImages.slice(4, 8).map((img) => (
                    <div key={img.id} className="aspect-[4/3] overflow-hidden rounded-lg bg-[#F3F3F3]">
                      <img
                        src={getAssetUrl(img)}
                        alt={img.alt_text || 'Gallery image'}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="order-1 lg:order-2">
            <div className="lg:sticky lg:top-24">
              {/* Our Contribution */}
              {capabilities.length > 0 && (
                <div className="mb-10">
                  <h3 
                    className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-[0.15em] mb-4"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Our contribution
                  </h3>
                  <div className="space-y-2">
                    {capabilities.map((cap, i) => (
                      <p 
                        key={i} 
                        className="text-[#1A1818]"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {cap.name}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Industries */}
              {industries.length > 0 && (
                <div className="mb-10">
                  <h3 
                    className="text-xs font-semibold text-[#8A8A8A] uppercase tracking-[0.15em] mb-4"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    Industry
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {industries.map((ind, i) => (
                      <span 
                        key={i} 
                        className="px-3 py-1.5 text-sm bg-[#F3F3F3] text-[#595959] rounded-full"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        {ind.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Card */}
              <div className="p-6 bg-[#1A1818] rounded-2xl">
                <h3 
                  className="text-white text-lg mb-3"
                  style={{ fontFamily: 'Lora, serif' }}
                >
                  Interested in similar work?
                </h3>
                <p 
                  className="text-white/60 text-sm mb-5"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Let's discuss how we can help with your next project.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F96A63] text-white text-sm font-medium rounded-full hover:bg-[#e85a53] transition-colors"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Get in touch
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Full-width CTA */}
      <section className="bg-[#F3F3F3]">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28 text-center">
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl text-[#1A1818] mb-6 leading-tight"
            style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
          >
            Ready to tell your story?
          </h2>
          <p 
            className="text-[#595959] text-lg mb-10 max-w-2xl mx-auto"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Let's discuss how Article Group can help transform your business challenges into breakthrough results.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 px-10 py-4 bg-[#1A1818] text-white font-medium rounded-full hover:bg-black transition-colors text-lg"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            Start a Conversation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A1818] py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Link 
              href="/" 
              className="text-xl text-white"
              style={{ fontFamily: 'Lora, serif' }}
            >
              Article Group
            </Link>
            
            <div className="flex items-center gap-8">
              <Link 
                href="/"
                className="text-white/60 hover:text-white transition-colors text-sm"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Back to Concierge
              </Link>
              <Link 
                href="/contact"
                className="text-white/60 hover:text-white transition-colors text-sm"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Contact
              </Link>
            </div>
            
            <p 
              className="text-white/40 text-sm"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              © {new Date().getFullYear()} Article Group
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
