'use client';

/**
 * Case Study Detail Page
 * 
 * Redesigned to match articlegroup.com editorial style:
 * - Clean, flowing prose (no boxed sections)
 * - Images interspersed naturally between paragraphs
 * - "Our contribution" sidebar
 * - Editorial section headings
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
 * Clean content - remove junk from ingestion
 */
function cleanContent(text: string | null | undefined): string {
  if (!text) return '';
  
  let cleaned = text
    .replace(/^\s*\{["\s]*markdown["\s]*:\s*["]/gi, '')
    .replace(/["]\s*\}\s*$/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/###\s*/g, '')
    .replace(/Text Extracted\s*/gi, '')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/^[-●•]\s*/gm, '')
    .replace(/No tables were present[^.]*\.?/gi, '')
    .replace(/No images were present[^.]*\.?/gi, '')
    .replace(/Tables and Images/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Remove section labels
  cleaned = cleaned
    .replace(/\s+(Challenge|Journey|Solution|Overview|Title|Subtitle)\s+/gi, '. ')
    .replace(/^(Challenge|Journey|Solution|Overview|Title|Subtitle)\s+/gi, '');
  
  // Remove trailing artifacts
  cleaned = cleaned
    .replace(/\s*(Yes|No|Not yet|N\/A|None|TBD)\s*$/gi, '');
  
  // Fix punctuation
  cleaned = cleaned.replace(/([a-z])([A-Z][a-z])/g, '$1. $2');
  cleaned = cleaned.replace(/\.([A-Z])/g, '. $1');
  cleaned = cleaned.replace(/\.{2,}/g, '.');
  cleaned = cleaned.replace(/^\.\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length > 10 && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }
  
  return cleaned;
}

/**
 * Split content into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  const cleaned = cleanContent(text);
  // Split on sentence boundaries, group into ~2-3 sentence paragraphs
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  const paragraphs: string[] = [];
  
  for (let i = 0; i < sentences.length; i += 3) {
    const para = sentences.slice(i, i + 3).join(' ').trim();
    if (para.length > 20) {
      paragraphs.push(para);
    }
  }
  
  return paragraphs.length > 0 ? paragraphs : [cleaned];
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#F96A63] rounded-full animate-spin" />
          <p className="text-[#595959]">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-2xl font-serif text-[#1A1818] mb-4">Not Found</h1>
          <button onClick={() => router.back()} className="px-6 py-3 bg-[#1A1818] text-white rounded-full">
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

  // Get content
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const journeyChunk = chunks.find(c => c.chunk_type === 'journey');
  const solutionChunk = chunks.find(c => c.chunk_type === 'solution');

  // Combine all content into flowing paragraphs
  const allContent: string[] = [];
  if (challengeChunk) allContent.push(...splitIntoParagraphs(challengeChunk.content));
  if (journeyChunk) allContent.push(...splitIntoParagraphs(journeyChunk.content));
  if (solutionChunk) allContent.push(...splitIntoParagraphs(solutionChunk.content));

  // Filter images - exclude logos, icons, tiny images
  const galleryImages = assets.filter(a => 
    a.asset_type !== 'logo' && 
    !a.original_filename?.toLowerCase().includes('logo') &&
    !a.original_filename?.toLowerCase().includes('icon') &&
    !a.original_filename?.toLowerCase().includes('arrow')
  );

  // Select best images for display (hero + 4-6 content images)
  const heroImage = caseStudy.hero_image_url || caseStudy.thumbnail_url || (galleryImages[0] ? getAssetUrl(galleryImages[0]) : null);
  const contentImages = galleryImages.slice(0, 6);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#EEEEEE]">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
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
            
            <Link href="/" className="font-serif text-xl text-[#1A1818]">
              Article Group
            </Link>
            
            <Link
              href="/contact"
              className="px-5 py-2 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-[#333] transition-colors"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-20">
        <article className="max-w-4xl mx-auto px-6 lg:px-8">
          
          {/* Client Badge */}
          {clientName && (
            <div className="mb-6">
              <span className="inline-block px-4 py-1.5 bg-[#F3F3F3] text-sm font-medium text-[#595959] rounded-full">
                {clientName}
              </span>
            </div>
          )}

          {/* Title */}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#1A1818] leading-[1.1] mb-8">
            {projectTitle}
          </h1>

          {/* Hero Image */}
          {heroImage && (
            <div className="mb-12 -mx-6 lg:-mx-20">
              <img
                src={heroImage}
                alt={projectTitle}
                className="w-full h-auto object-cover rounded-lg shadow-lg"
              />
            </div>
          )}

          {/* Intro / Summary */}
          {allContent[0] && (
            <p className="text-xl lg:text-2xl text-[#1A1818] leading-relaxed mb-10 font-light">
              {allContent[0]}
            </p>
          )}

          {/* Body content with images interspersed */}
          <div className="prose prose-lg max-w-none">
            {allContent.slice(1).map((paragraph, idx) => (
              <React.Fragment key={idx}>
                <p className="text-lg text-[#595959] leading-relaxed mb-6">
                  {paragraph}
                </p>
                
                {/* Insert image after every 2 paragraphs */}
                {idx > 0 && idx % 2 === 1 && contentImages[Math.floor(idx / 2)] && (
                  <figure className="my-10 -mx-6 lg:-mx-12">
                    <img
                      src={getAssetUrl(contentImages[Math.floor(idx / 2)])}
                      alt={contentImages[Math.floor(idx / 2)].alt_text || `Project image`}
                      className="w-full h-auto rounded-lg shadow-md"
                      loading="lazy"
                    />
                  </figure>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Our Contribution - Sidebar style */}
          {capabilities.length > 0 && (
            <aside className="mt-16 pt-8 border-t border-[#EEEEEE]">
              <h3 className="text-xs font-bold text-[#8A8A8A] uppercase tracking-[0.2em] mb-4">
                Our contribution
              </h3>
              <div className="space-y-1">
                {capabilities.map((cap, i) => (
                  <p key={i} className="text-[#1A1818]">{cap.name}</p>
                ))}
              </div>
            </aside>
          )}

          {/* Additional Images Grid */}
          {contentImages.length > 3 && (
            <div className="mt-16 grid grid-cols-2 gap-4">
              {contentImages.slice(3, 7).map((img, i) => (
                <div key={img.id} className="overflow-hidden rounded-lg">
                  <img
                    src={getAssetUrl(img)}
                    alt={img.alt_text || `Gallery ${i + 1}`}
                    className="w-full h-64 object-cover hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}

        </article>
      </main>

      {/* CTA Section */}
      <section className="bg-[#1A1818] py-20 lg:py-28">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-6">
            Ready to tell your story?
          </h3>
          <p className="text-white/60 text-lg mb-10 max-w-2xl mx-auto">
            Let's discuss how we can help transform your business challenges into breakthrough results.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-3 px-10 py-5 bg-[#F96A63] text-white font-semibold rounded-full hover:bg-[#e85d56] transition-all text-lg"
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
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#8A8A8A]">
            © {new Date().getFullYear()} Article Group
          </p>
          <Link href="/" className="text-sm text-[#595959] hover:text-[#1A1818] transition-colors">
            Back to Concierge
          </Link>
        </div>
      </footer>
    </div>
  );
}
