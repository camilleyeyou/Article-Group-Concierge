import React from 'react';
import Link from 'next/link';
import type { CaseStudyTeaserProps } from '../types';

/**
 * CaseStudyTeaser Component
 *
 * A preview card for case studies matching articlegroup.com/work style:
 * - Image-dominant tiles with clean typography
 * - Minimal design with squared corners
 * - Elegant hover effects (border, image zoom, arrow slide)
 */
export const CaseStudyTeaser: React.FC<CaseStudyTeaserProps> = ({
  title,
  clientName,
  summary,
  capabilities = [],
  industries = [],
  slug,
}) => {
  // Parse title to separate client name if format is "Client: Project Title"
  const titleParts = title.split(':');
  const displayClientName = titleParts.length > 1 ? titleParts[0].trim() : clientName;
  const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : title;

  const content = (
    <div className="group relative overflow-hidden bg-white border border-[#eee] hover:border-black transition-all duration-300">
      {/* Black overlay header - AG style (fixes "lost black overlay" feedback) */}
      <div className="bg-[#1a1a1a] px-6 py-8">
        {/* Category label - teal accent */}
        {capabilities.length > 0 && (
          <p className="text-[#47ddb2] text-xs font-medium uppercase tracking-wider mb-4">
            {capabilities[0]}
            {capabilities.length > 1 && ` / ${capabilities[1]}`}
          </p>
        )}

        {/* Title - white text on dark background */}
        <h3
          className="text-white text-xl md:text-2xl leading-tight mb-4"
          style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
        >
          {displayTitle}
        </h3>

        {/* Summary - lighter text */}
        {summary && (
          <p className="text-white/70 text-sm leading-relaxed">
            {summary}
          </p>
        )}
      </div>

      {/* White content area with details */}
      <div className="bg-white px-6 py-5 border-t border-[#eee]">
        {/* Client name if available */}
        {displayClientName && (
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 mt-1">
              <svg className="w-5 h-5 text-[#6B6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wider mb-1">Client</p>
              <p className="text-sm text-black font-medium">{displayClientName}</p>
            </div>
          </div>
        )}

        {/* Industries */}
        {industries.length > 0 && (
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-shrink-0 mt-1">
              <svg className="w-5 h-5 text-[#6B6B6B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-[#6B6B6B] uppercase tracking-wider mb-1">Industry</p>
              <p className="text-sm text-black">{industries.slice(0, 2).join(', ')}</p>
            </div>
          </div>
        )}

        {/* View link */}
        <div className="flex items-center gap-2 text-[#fc5d4c] font-medium text-sm pt-2">
          <span>View project</span>
          <svg
            className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </div>
  );

  if (slug) {
    return (
      <Link href={`/case-study/${slug}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export default CaseStudyTeaser;
