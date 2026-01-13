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
  created_at: string;
}

interface ContentChunk {
  id: string;
  content: string;
  chunk_index: number;
}

interface Capability {
  name: string;
  slug: string;
}

interface Industry {
  name: string;
  slug: string;
}

// Simple markdown-like renderer
function renderContent(text: string): React.ReactNode[] {
  // First, clean up the text - handle escaped newlines and markdown artifacts
  let cleanText = text
    .replace(/\\n/g, '\n')  // Convert \n to actual newlines
    .replace(/\{"markdown":\s*"/g, '')  // Remove JSON wrapper if present
    .replace(/"\s*\}$/g, '')  // Remove closing JSON
    .replace(/^### /gm, '')  // Remove ### headers, we'll style differently
    .replace(/^\*\*([^*]+)\*\*$/gm, '$1')  // Bold on its own line becomes plain
    .trim();

  // Split into paragraphs
  const paragraphs = cleanText.split(/\n\n+/);
  
  return paragraphs.map((para, i) => {
    const trimmed = para.trim();
    if (!trimmed) return null;

    // Check if it's a header (starts with **)
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      const headerText = trimmed.slice(2, -2);
      return (
        <h3 key={i} className="text-lg font-semibold text-[#1A1818] mt-8 mb-3">
          {headerText}
        </h3>
      );
    }

    // Check if it's a list
    if (trimmed.includes('\n- ') || trimmed.startsWith('- ')) {
      const items = trimmed.split('\n- ').filter(item => item.trim());
      return (
        <ul key={i} className="list-disc list-inside space-y-2 mb-6 text-gray-700">
          {items.map((item, j) => (
            <li key={j} className="leading-relaxed">
              {item.replace(/^- /, '').replace(/\*\*([^*]+)\*\*/g, '$1')}
            </li>
          ))}
        </ul>
      );
    }

    // Check for inline bold and render as paragraph
    const parts = trimmed.split(/\*\*([^*]+)\*\*/g);
    return (
      <p key={i} className="text-gray-700 leading-relaxed mb-4">
        {parts.map((part, j) => 
          j % 2 === 1 ? <strong key={j} className="font-semibold">{part}</strong> : part
        )}
      </p>
    );
  }).filter(Boolean);
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
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#1A1818] rounded-full animate-spin" />
          <span className="text-gray-600">Loading case study...</span>
        </div>
      </div>
    );
  }

  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[#1A1818] mb-2">Case Study Not Found</h1>
          <p className="text-gray-600 mb-6">{error || "We couldn't find the case study you're looking for."}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A1818] text-white rounded-full hover:bg-[#333] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Concierge
          </Link>
        </div>
      </div>
    );
  }

  // Combine chunks into full content
  const fullContent = chunks
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map(c => c.content)
    .join('\n\n');

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-[#1A1818] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm font-medium">Back to Concierge</span>
            </Link>
            
            <a
              href="mailto:hello@articlegroup.com"
              className="px-4 py-2 bg-[#1A1818] text-white text-sm font-medium rounded-full hover:bg-[#333] transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#1A1818] to-[#333] text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 md:py-24">
          {/* Client Badge */}
          {caseStudy.client_name && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full mb-6">
              <span className="text-sm font-medium text-white/90">{caseStudy.client_name}</span>
            </div>
          )}
          
          {/* Title */}
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-medium leading-tight mb-6">
            {caseStudy.title}
          </h1>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {capabilities.map((cap, i) => (
              <span 
                key={`cap-${i}`}
                className="px-3 py-1 text-sm bg-[#0097A7]/30 text-white rounded-full"
              >
                {cap.name}
              </span>
            ))}
            {industries.map((ind, i) => (
              <span 
                key={`ind-${i}`}
                className="px-3 py-1 text-sm bg-white/10 text-white/80 rounded-full"
              >
                {ind.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Content Section */}
      <section className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        {/* Summary */}
        {caseStudy.summary && (
          <div className="mb-12 p-6 bg-gray-50 rounded-xl border border-gray-100">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Overview</h2>
            <p className="text-lg text-gray-700 leading-relaxed">{caseStudy.summary}</p>
          </div>
        )}

        {/* Full Content - Rendered */}
        <div className="prose-content">
          {renderContent(fullContent)}
        </div>

        {/* CTA */}
        <div className="mt-16 p-8 bg-[#1A1818] rounded-2xl text-center">
          <h3 className="text-xl font-medium text-white mb-3">
            Interested in similar work?
          </h3>
          <p className="text-white/70 mb-6">
            Let's discuss how we can help with your project.
          </p>
          <a
            href="mailto:hello@articlegroup.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1A1818] font-medium rounded-full hover:bg-gray-100 transition-colors"
          >
            Schedule a Conversation
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Article Group. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
