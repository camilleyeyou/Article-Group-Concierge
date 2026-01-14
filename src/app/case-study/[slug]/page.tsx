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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-[#F96A63] rounded-full animate-spin" />
          <span className="text-gray-500 text-lg font-sans">Loading case study...</span>
        </div>
      </div>
    );
  }

  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-[#1A1818] mb-4">Case Study Not Found</h1>
          <p className="text-gray-500 text-lg mb-8">{error || "We couldn't find the case study you're looking for."}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#1A1818] text-white rounded-full hover:bg-gray-800 transition-colors font-medium"
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

  // Get structured chunks and clean content
  const challengeChunk = chunks.find(c => c.chunk_type === 'challenge');
  const journeyChunk = chunks.find(c => c.chunk_type === 'journey');
  const solutionChunk = chunks.find(c => c.chunk_type === 'solution');
  const fullChunk = chunks.find(c => c.chunk_type === 'full');

  // Clean content helper - removes markdown and normalizes line breaks
  const cleanContent = (text: string): string => {
    return text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove **bold** markers
      .replace(/\n+/g, ' ') // Replace line breaks with spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .replace(/●/g, '') // Remove bullet points
      .trim();
  };

  // Parse title
  const titleParts = caseStudy.title.split(':');
  const displayClient = caseStudy.client_name || (titleParts.length > 1 ? titleParts[0].trim() : null);
  const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-gray-500 hover:text-[#1A1818] transition-colors group">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-[#F96A63]/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              <span className="font-medium">Back to Concierge</span>
            </Link>
            
            <a
              href="mailto:hello@articlegroup.com"
              className="px-5 py-2.5 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-[#1A1818] text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          {displayClient && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full mb-6">
              <span className="text-sm font-medium tracking-wide">{displayClient}</span>
            </div>
          )}
          
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight mb-8 max-w-4xl">
            {displayTitle}
          </h1>
          
          <div className="flex flex-wrap gap-3">
            {capabilities.map((cap, i) => (
              <span 
                key={`cap-${i}`}
                className="px-4 py-2 text-sm bg-[#0097A7]/30 text-white rounded-full font-medium"
              >
                {cap.name}
              </span>
            ))}
            {industries.map((ind, i) => (
              <span 
                key={`ind-${i}`}
                className="px-4 py-2 text-sm bg-white/10 text-white/80 rounded-full"
              >
                {ind.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        {/* Summary */}
        {caseStudy.summary && (
          <div className="mb-12 p-8 bg-gray-50 rounded-2xl">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Overview</h2>
            <p className="text-xl text-[#1A1818] leading-relaxed">{cleanContent(caseStudy.summary)}</p>
          </div>
        )}

        {/* Structured Content */}
        <div className="space-y-12">
          {challengeChunk && (
            <div>
              <h2 className="font-serif text-2xl md:text-3xl text-[#1A1818] mb-4">Challenge</h2>
              <p className="text-gray-600 text-lg leading-relaxed">{cleanContent(challengeChunk.content)}</p>
            </div>
          )}

          {journeyChunk && (
            <div>
              <h2 className="font-serif text-2xl md:text-3xl text-[#1A1818] mb-4">Journey</h2>
              <p className="text-gray-600 text-lg leading-relaxed">{cleanContent(journeyChunk.content)}</p>
            </div>
          )}

          {solutionChunk && (
            <div>
              <h2 className="font-serif text-2xl md:text-3xl text-[#1A1818] mb-4">Solution</h2>
              <p className="text-gray-600 text-lg leading-relaxed">{cleanContent(solutionChunk.content)}</p>
            </div>
          )}

          {/* Fallback to full content if no structured chunks */}
          {!challengeChunk && !journeyChunk && !solutionChunk && fullChunk && (
            <div className="text-gray-600 text-lg leading-relaxed">
              {cleanContent(fullChunk.content)}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-[#1A1818]">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h3 className="font-serif text-3xl md:text-4xl text-white mb-4">
            Interested in similar work?
          </h3>
          <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
            Let's discuss how Article Group can help transform your business challenges into breakthrough results.
          </p>
          <a
            href="mailto:hello@articlegroup.com"
            className="inline-flex items-center gap-3 px-8 py-4 bg-[#F96A63] text-white font-semibold rounded-full hover:bg-[#F96A63]/90 transition-colors text-lg"
          >
            Schedule a Conversation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Article Group. All rights reserved.
          </p>
          <Link href="/" className="text-sm text-gray-500 hover:text-[#1A1818] transition-colors">
            Back to Concierge
          </Link>
        </div>
      </footer>
    </div>
  );
}
