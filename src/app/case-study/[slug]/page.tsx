'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CaseStudy {
  id: string;
  title: string;
  client_name: string;
  slug: string;
  summary: string;
  document_type: string;
}

interface ContentChunk {
  id: string;
  content: string;
  chunk_index: number;
  chunk_type: string;
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
 * Aggressive content cleaner - removes ALL junk
 */
function cleanContent(text: string | null | undefined): string {
  if (!text) return '';
  
  return text
    // Remove JSON wrapper
    .replace(/^\s*\{["\s]*markdown["\s]*:\s*["]/gi, '')
    .replace(/["]\s*\}\s*$/g, '')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/###\s*/g, '')
    // Remove "Text Extracted" and similar labels
    .replace(/Text Extracted\s*/gi, '')
    .replace(/Extracted Text\s*/gi, '')
    // Remove escape sequences
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\"/g, '"')
    // Remove bold markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*\*/g, '')
    // Remove bullet points and list markers
    .replace(/^[-●•]\s*/gm, '')
    .replace(/\\n-\s*/g, ' ')
    // Remove section labels that got mixed in
    .replace(/^(Title|Subtitle|Challenge|Journey|Solution|Overview|Event Title|Date|Time|Description|Product Tracks|Key Personnel):\s*/gim, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a clean summary - either from summary field or first chunk
 * Ensures we return complete sentences that make sense
 */
function getCleanSummary(summary: string | null, chunks: ContentChunk[]): string | null {
  // Get the challenge chunk as our primary source for summary
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const fullChunk = chunks.find(c => c.chunk_type === 'full');
  
  // Try challenge chunk first (usually the best summary source)
  if (challengeChunk) {
    const cleaned = cleanContent(challengeChunk.content);
    if (cleaned.length > 50) {
      // Get complete sentences (up to ~400 chars or 3 sentences)
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        let result = '';
        for (const sentence of sentences) {
          if (result.length + sentence.length > 400) break;
          result += sentence;
          if (sentences.indexOf(sentence) >= 2) break; // Max 3 sentences
        }
        if (result.trim().length > 50) {
          return result.trim();
        }
      }
      // If no good sentence breaks, return first 350 chars at word boundary
      if (cleaned.length > 350) {
        const truncated = cleaned.slice(0, 350);
        const lastSpace = truncated.lastIndexOf(' ');
        return truncated.slice(0, lastSpace) + '...';
      }
      return cleaned;
    }
  }
  
  // Try the summary field
  if (summary) {
    const cleaned = cleanContent(summary);
    // Check it's not junk
    if (cleaned.length > 50 && 
        !cleaned.toLowerCase().includes('markdown') && 
        !cleaned.includes('\\n') &&
        !cleaned.toLowerCase().includes('text extracted')) {
      // Get complete sentences
      const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        let result = '';
        for (const sentence of sentences) {
          if (result.length + sentence.length > 400) break;
          result += sentence;
          if (sentences.indexOf(sentence) >= 2) break;
        }
        if (result.trim().length > 50) {
          return result.trim();
        }
      }
    }
  }
  
  // Fall back to full chunk
  if (fullChunk) {
    const cleaned = cleanContent(fullChunk.content);
    // Remove the **Challenge** header if present at start
    const withoutHeader = cleaned.replace(/^(Challenge|Journey|Solution)\s*/i, '');
    if (withoutHeader.length > 50) {
      const sentences = withoutHeader.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        let result = '';
        for (const sentence of sentences) {
          if (result.length + sentence.length > 400) break;
          result += sentence;
          if (sentences.indexOf(sentence) >= 2) break;
        }
        if (result.trim().length > 50) {
          return result.trim();
        }
      }
    }
  }
  
  return null;
}

export default function CaseStudyDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [chunks, setChunks] = useState<ContentChunk[]>([]);
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#F96A63] border-t-transparent rounded-full animate-spin" />
          <span className="text-[#595959] text-lg font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-[#F3F3F3] flex items-center justify-center">
            <svg className="w-12 h-12 text-[#8A8A8A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-serif text-4xl text-[#1A1818] mb-4">Case Study Not Found</h1>
          <p className="text-[#595959] text-lg mb-10">{error || "We couldn't find what you're looking for."}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#1A1818] text-white rounded-full hover:bg-[#333] transition-all duration-300 font-medium text-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Concierge
          </Link>
        </div>
      </div>
    );
  }

  // Get chunks by type
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const journeyChunk = chunks.find(c => c.chunk_type === 'journey');
  const solutionChunk = chunks.find(c => c.chunk_type === 'solution');
  
  // Parse title
  const titleParts = caseStudy.title.split(':');
  const displayClient = caseStudy.client_name || (titleParts.length > 1 ? titleParts[0].trim() : null);
  const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;
  
  // Get clean summary
  const cleanSummary = getCleanSummary(caseStudy.summary, chunks);
  
  // Check if we have structured content
  const hasStructuredContent = challengeChunk || journeyChunk || solutionChunk;

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#EEEEEE]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex items-center justify-between h-16">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-[#595959] hover:text-[#1A1818] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-medium">Back</span>
            </Link>
            
            <a
              href="mailto:hello@articlegroup.com"
              className="px-5 py-2 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-[#333] transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section - Full Width with Gradient */}
      <section className="relative pt-16">
        <div className="bg-gradient-to-br from-[#1A1818] via-[#2A2A2A] to-[#1A1818] text-white">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#F96A63]/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0097A7]/10 rounded-full blur-3xl" />
          
          <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-20 lg:py-32">
            <div className="max-w-4xl">
              {/* Client Badge */}
              {displayClient && (
                <div className="inline-flex items-center mb-6">
                  <span className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-semibold tracking-wide border border-white/10">
                    {displayClient}
                  </span>
                </div>
              )}
              
              {/* Title */}
              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-normal leading-[1.1] mb-8">
                {displayTitle}
              </h1>
              
              {/* Tags */}
              {(capabilities.length > 0 || industries.length > 0) && (
                <div className="flex flex-wrap gap-3">
                  {capabilities.map((cap, i) => (
                    <span 
                      key={`cap-${i}`}
                      className="px-4 py-2 text-sm bg-[#0097A7]/20 text-[#0097A7] rounded-full font-medium border border-[#0097A7]/30"
                    >
                      {cap.name}
                    </span>
                  ))}
                  {industries.map((ind, i) => (
                    <span 
                      key={`ind-${i}`}
                      className="px-4 py-2 text-sm bg-white/5 text-white/70 rounded-full border border-white/10"
                    >
                      {ind.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Overview Card - Overlapping Hero */}
      {cleanSummary && (
        <section className="relative z-10 max-w-4xl mx-auto px-6 lg:px-12 -mt-8">
          <div className="bg-white rounded-2xl shadow-xl border border-[#EEEEEE] p-8 lg:p-10">
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

      {/* Main Content */}
      {hasStructuredContent && (
        <section className="max-w-4xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
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

      {/* CTA Section */}
      <section className="bg-[#1A1818] relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#F96A63]/5 via-transparent to-[#0097A7]/5" />
        
        <div className="relative max-w-4xl mx-auto px-6 lg:px-12 py-20 lg:py-28 text-center">
          <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white mb-6 leading-tight">
            Ready to create something<br className="hidden sm:block" /> extraordinary?
          </h3>
          <p className="text-white/60 text-lg lg:text-xl mb-10 max-w-2xl mx-auto">
            Let's discuss how Article Group can help transform your business challenges into breakthrough results.
          </p>
          <a
            href="mailto:hello@articlegroup.com"
            className="inline-flex items-center gap-3 px-10 py-5 bg-[#F96A63] text-white font-semibold rounded-full hover:bg-[#e85d56] transition-all duration-300 text-lg shadow-lg shadow-[#F96A63]/25 hover:shadow-xl hover:shadow-[#F96A63]/30 hover:-translate-y-0.5"
          >
            Start a Conversation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#F3F3F3] py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[#8A8A8A]">
            © {new Date().getFullYear()} Article Group. All rights reserved.
          </p>
          <Link 
            href="/" 
            className="text-sm text-[#595959] hover:text-[#1A1818] transition-colors font-medium"
          >
            Back to Concierge
          </Link>
        </div>
      </footer>
    </div>
  );
}
