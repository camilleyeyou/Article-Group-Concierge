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

interface Metric {
  label: string;
  value: string;
  context?: string;
}

/**
 * Clean and parse content - removes all markdown artifacts and JSON wrappers
 */
function cleanContent(text: string): string {
  return text
    // Remove JSON wrappers
    .replace(/^\s*\{"markdown"\s*:\s*"/g, '')
    .replace(/"\s*\}\s*$/g, '')
    // Convert escaped characters
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    // Remove markdown headers (we'll style sections differently)
    .replace(/^#{1,6}\s+/gm, '')
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Remove image markdown
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove link markdown but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parse content into structured sections
 */
function parseContentSections(rawContent: string): Array<{ type: 'heading' | 'paragraph' | 'list' | 'metric'; content: string; items?: string[] }> {
  const cleaned = cleanContent(rawContent);
  const sections: Array<{ type: 'heading' | 'paragraph' | 'list' | 'metric'; content: string; items?: string[] }> = [];
  
  // Split by double newlines to get paragraphs
  const blocks = cleaned.split(/\n\n+/);
  
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    
    // Check if it's a bold heading (text wrapped in **)
    if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) {
      const headingText = trimmed.replace(/^\*\*/, '').replace(/\*\*:?\s*$/, '');
      sections.push({ type: 'heading', content: headingText });
      continue;
    }
    
    // Check if it's a list (starts with - or *)
    if (/^[-*]\s/.test(trimmed) || trimmed.includes('\n- ') || trimmed.includes('\n* ')) {
      const items = trimmed
        .split(/\n/)
        .map(line => line.replace(/^[-*]\s+/, '').trim())
        .filter(line => line.length > 0)
        // Clean bold markers from list items
        .map(item => item.replace(/\*\*([^*]+)\*\*/g, '$1'));
      
      if (items.length > 0) {
        sections.push({ type: 'list', content: '', items });
      }
      continue;
    }
    
    // Check for metrics pattern (e.g., "$30B", "70+", "6+ hrs")
    if (/^\$?[\d.]+[BMK+%]?\s*$/i.test(trimmed) || /^\d+\+?\s*(hrs?|hours?|days?|months?|years?)?$/i.test(trimmed)) {
      sections.push({ type: 'metric', content: trimmed });
      continue;
    }
    
    // Regular paragraph - clean up any remaining bold markers
    const cleanParagraph = trimmed.replace(/\*\*([^*]+)\*\*/g, '$1');
    if (cleanParagraph.length > 0) {
      sections.push({ type: 'paragraph', content: cleanParagraph });
    }
  }
  
  return sections;
}

/**
 * Extract metrics from content if present
 */
function extractMetrics(chunks: ContentChunk[]): Metric[] {
  const metrics: Metric[] = [];
  const metricPatterns = [
    /(\$[\d.]+[BMK]?)\s+([^.]+)/gi,
    /(\d+\+?)\s+([\w\s]+(?:created|produced|delivered|completed))/gi,
    /(\d+\+?\s*(?:hrs?|hours?))\s+([^.]+)/gi,
  ];
  
  const fullText = chunks.map(c => c.content).join(' ');
  
  for (const pattern of metricPatterns) {
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      if (metrics.length < 4) { // Max 4 metrics
        metrics.push({
          value: match[1],
          label: match[2].trim().slice(0, 50),
        });
      }
    }
  }
  
  return metrics;
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
      <div className="min-h-screen bg-white flex items-center justify-center font-sans">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-2 border-ag-gray-200 border-t-ag-coral rounded-full animate-spin" />
          <span className="text-ag-gray-500 text-lg">Loading case study...</span>
        </div>
      </div>
    );
  }

  if (error || !caseStudy) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 font-sans">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-ag-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-ag-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-serif text-3xl text-ag-black mb-4">Case Study Not Found</h1>
          <p className="text-ag-gray-500 text-lg mb-8">{error || "We couldn't find the case study you're looking for."}</p>
          <Link 
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ag-black text-white rounded-full hover:bg-ag-gray-700 transition-colors font-medium"
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

  // Process content
  const fullContent = chunks
    .sort((a, b) => a.chunk_index - b.chunk_index)
    .map(c => c.content)
    .join('\n\n');
  
  const sections = parseContentSections(fullContent);
  const metrics = extractMetrics(chunks);

  // Extract title parts (Client: Title format)
  const titleParts = caseStudy.title.split(':');
  const displayClient = caseStudy.client_name || (titleParts.length > 1 ? titleParts[0].trim() : null);
  const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : caseStudy.title;

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-ag-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-ag-gray-500 hover:text-ag-black transition-colors group">
              <div className="w-8 h-8 rounded-full bg-ag-gray-100 flex items-center justify-center group-hover:bg-ag-coral/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
              <span className="font-medium">Back to Concierge</span>
            </Link>
            
            <a
              href="mailto:hello@articlegroup.com"
              className="px-5 py-2.5 bg-ag-black text-white text-sm font-medium rounded-full hover:bg-ag-gray-700 transition-colors"
            >
              Get in Touch
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-ag-black text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
          {/* Client Badge */}
          {displayClient && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 rounded-full mb-6 backdrop-blur-sm">
              <span className="text-sm font-medium tracking-wide">{displayClient}</span>
            </div>
          )}
          
          {/* Title */}
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-normal leading-tight mb-8 max-w-4xl">
            {displayTitle}
          </h1>
          
          {/* Tags */}
          <div className="flex flex-wrap gap-3">
            {capabilities.map((cap, i) => (
              <span 
                key={`cap-${i}`}
                className="px-4 py-2 text-sm bg-ag-teal/20 text-white rounded-full font-medium"
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

      {/* Metrics Section */}
      {metrics.length > 0 && (
        <section className="border-b border-ag-gray-200">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className={`grid gap-8 ${metrics.length === 2 ? 'grid-cols-2' : metrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
              {metrics.map((metric, i) => (
                <div key={i} className="text-center">
                  <div className="font-mono text-4xl md:text-5xl font-bold text-ag-coral mb-2">
                    {metric.value}
                  </div>
                  <div className="text-ag-gray-500 text-sm uppercase tracking-wider">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Content Section */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        {/* Summary Card */}
        {caseStudy.summary && (
          <div className="mb-12 p-8 bg-ag-gray-100 rounded-2xl">
            <h2 className="text-xs font-semibold text-ag-gray-400 uppercase tracking-widest mb-4">Overview</h2>
            <p className="text-xl text-ag-black leading-relaxed">{cleanContent(caseStudy.summary)}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="space-y-8">
          {sections.map((section, i) => {
            switch (section.type) {
              case 'heading':
                return (
                  <h2 key={i} className="font-serif text-2xl md:text-3xl text-ag-black mt-12 mb-4 first:mt-0">
                    {section.content}
                  </h2>
                );
              
              case 'list':
                return (
                  <ul key={i} className="space-y-3 pl-0">
                    {section.items?.map((item, j) => (
                      <li key={j} className="flex items-start gap-4 text-ag-gray-600 text-lg leading-relaxed">
                        <span className="w-2 h-2 rounded-full bg-ag-coral mt-2.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                );
              
              case 'paragraph':
              default:
                return (
                  <p key={i} className="text-ag-gray-600 text-lg leading-relaxed">
                    {section.content}
                  </p>
                );
            }
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-ag-black">
        <div className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h3 className="font-serif text-3xl md:text-4xl text-white mb-4">
            Interested in similar work?
          </h3>
          <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
            Let's discuss how Article Group can help transform your business challenges into breakthrough results.
          </p>
          <a
            href="mailto:hello@articlegroup.com"
            className="inline-flex items-center gap-3 px-8 py-4 bg-ag-coral text-white font-semibold rounded-full hover:bg-ag-coral/90 transition-colors text-lg"
          >
            Schedule a Conversation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ag-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-sm text-ag-gray-400">
            © {new Date().getFullYear()} Article Group. All rights reserved.
          </p>
          <Link href="/" className="text-sm text-ag-gray-500 hover:text-ag-black transition-colors">
            Back to Concierge
          </Link>
        </div>
      </footer>
    </div>
  );
}
