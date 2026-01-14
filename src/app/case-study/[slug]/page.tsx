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

/**
 * Clean and parse content - removes ALL unwanted text, markdown, and metadata
 */
function cleanContent(text: string): string {
  let cleaned = text
    // Remove JSON wrappers
    .replace(/^\s*\{"markdown"\s*:\s*"/g, '')
    .replace(/"\s*\}\s*$/g, '')
    // Convert escaped characters
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    // Remove LlamaParse metadata and junk
    .replace(/Tables\s*There are no tables[^.]*\./gi, '')
    .replace(/Images\s*There are no images[^.]*\./gi, '')
    .replace(/If you need further assistance[^}]*\}/gi, '')
    .replace(/"?job_metadata"?\s*:\s*\{[^}]*\}/gi, '')
    .replace(/\{"?credits_used"?[^}]*\}/gi, '')
    .replace(/Extracted Text\s*/gi, '')
    // Remove markdown headers
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

  return cleaned;
}

/**
 * Parse structured content into clean sections
 */
function parseContentSections(rawContent: string): Array<{ type: 'heading' | 'paragraph' | 'list'; content: string; items?: string[] }> {
  const cleaned = cleanContent(rawContent);
  const sections: Array<{ type: 'heading' | 'paragraph' | 'list'; content: string; items?: string[] }> = [];
  
  // First, parse the structured format (Title:, Subtitle:, Challenge:, Journey:, Solution:)
  const structuredPattern = /\*\*?(Title|Subtitle|Challenge|Journey|Solution|Overview|Approach|Results|Impact|Background|Context|Problem|Process|Outcome):?\*?\*?\s*/gi;
  
  // Split content by these markers
  const parts = cleaned.split(structuredPattern);
  
  let currentSection: string | null = null;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;
    
    // Check if this is a section header
    const headerMatch = part.match(/^(Title|Subtitle|Challenge|Journey|Solution|Overview|Approach|Results|Impact|Background|Context|Problem|Process|Outcome)$/i);
    
    if (headerMatch) {
      currentSection = headerMatch[1];
      continue;
    }
    
    // Skip unwanted content
    if (part.match(/Tables\s*There are no/i) || 
        part.match(/Images\s*There are no/i) ||
        part.match(/job_metadata/i) ||
        part.match(/credits_used/i) ||
        part.match(/Extracted Text/i) ||
        part.match(/If you need further assistance/i)) {
      continue;
    }
    
    // Clean the content
    let content = part
      .replace(/\*\*/g, '') // Remove all ** markers
      .replace(/^\s*[-*]\s*/gm, '• ') // Normalize list markers
      .trim();
    
    if (!content) continue;
    
    // Add section header if we have one
    if (currentSection && currentSection.toLowerCase() !== 'title' && currentSection.toLowerCase() !== 'subtitle') {
      sections.push({ type: 'heading', content: currentSection });
      currentSection = null;
    }
    
    // Check if content is a list
    if (content.includes('\n• ') || content.startsWith('• ')) {
      const items = content
        .split(/\n/)
        .map(line => line.replace(/^[•\-*]\s*/, '').trim())
        .filter(line => line.length > 0 && !line.match(/Tables\s*There|Images\s*There|job_metadata/i));
      
      if (items.length > 0) {
        sections.push({ type: 'list', content: '', items });
      }
    } else {
      // Regular paragraph
      sections.push({ type: 'paragraph', content });
    }
  }
  
  // If no structured content found, fall back to simple paragraph splitting
  if (sections.length === 0) {
    const paragraphs = cleaned
      .replace(/\*\*/g, '')
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0 && 
        !p.match(/Tables\s*There are no/i) && 
        !p.match(/Images\s*There are no/i) &&
        !p.match(/job_metadata/i) &&
        !p.match(/credits_used/i) &&
        !p.match(/Extracted Text/i) &&
        !p.match(/If you need further assistance/i));
    
    for (const para of paragraphs) {
      if (para.includes('\n- ') || para.includes('\n* ') || para.startsWith('- ') || para.startsWith('* ')) {
        const items = para
          .split(/\n/)
          .map(line => line.replace(/^[-*]\s*/, '').trim())
          .filter(line => line.length > 0);
        sections.push({ type: 'list', content: '', items });
      } else {
        sections.push({ type: 'paragraph', content: para });
      }
    }
  }
  
  return sections;
}

/**
 * Extract a clean summary from the content
 */
function extractCleanSummary(summary: string | null, chunks: ContentChunk[]): string | null {
  if (!summary) {
    // Try to extract from first chunk
    if (chunks.length > 0) {
      const firstChunk = cleanContent(chunks[0].content);
      // Look for subtitle or first meaningful paragraph
      const subtitleMatch = firstChunk.match(/Subtitle:?\s*([^*\n]+)/i);
      if (subtitleMatch) {
        return subtitleMatch[1].trim();
      }
      // Get first paragraph that isn't a label
      const paras = firstChunk.split(/\n\n+/);
      for (const para of paras) {
        const clean = para.replace(/\*\*/g, '').replace(/^(Title|Subtitle|Challenge|Journey|Solution):?\s*/i, '').trim();
        if (clean.length > 50 && !clean.match(/^(Title|Subtitle|Extracted)/i)) {
          return clean.slice(0, 300);
        }
      }
    }
    return null;
  }
  
  // Clean the existing summary
  return cleanContent(summary)
    .replace(/\*\*/g, '')
    .replace(/^(Title|Subtitle|Challenge|Journey|Solution|Extracted Text):?\s*/gi, '')
    .replace(/Tables\s*There are no[^.]*\./gi, '')
    .replace(/Images\s*There are no[^.]*\./gi, '')
    .replace(/If you need further assistance[^}]*/gi, '')
    .replace(/job_metadata[^}]*\}/gi, '')
    .trim();
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
  const cleanSummary = extractCleanSummary(caseStudy.summary, chunks);

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

      {/* Metrics Section - removed for now until we have clean data */}

      {/* Content Section */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        {/* Summary Card */}
        {cleanSummary && (
          <div className="mb-12 p-8 bg-ag-gray-100 rounded-2xl">
            <h2 className="text-xs font-semibold text-ag-gray-400 uppercase tracking-widest mb-4">Overview</h2>
            <p className="text-xl text-ag-black leading-relaxed">{cleanSummary}</p>
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
