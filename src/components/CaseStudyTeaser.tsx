import React from 'react';
import Link from 'next/link';
import type { CaseStudyTeaserProps } from '../types';

/**
 * CaseStudyTeaser Component
 * 
 * A preview card for case studies, showing key info at a glance.
 * Designed to entice deeper exploration.
 */
export const CaseStudyTeaser: React.FC<CaseStudyTeaserProps> = ({
  title,
  clientName,
  summary,
  capabilities = [],
  industries = [],
  thumbnailUrl,
  slug,
}) => {
  const content = (
    <div className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all duration-300">
      {/* Thumbnail */}
      <div className="relative aspect-[16/9] bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${clientName || title} case study`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#F96A63]/20 to-[#0097A7]/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-[#1A1818]/30">
                {(clientName || title).charAt(0)}
              </span>
            </div>
          </div>
        )}
        
        {/* Client name badge */}
        {clientName && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full">
            <span className="text-xs font-medium text-[#1A1818]">
              {clientName}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5">
        {/* Title */}
        <h3 className="font-medium text-[#1A1818] text-lg mb-2 group-hover:text-[#F96A63] transition-colors">
          {title}
        </h3>
        
        {/* Summary */}
        <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-2">
          {summary}
        </p>
        
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {capabilities.slice(0, 2).map((cap, i) => (
            <span 
              key={`cap-${i}`}
              className="px-2 py-1 text-xs bg-[#0097A7]/10 text-[#0097A7] rounded-md"
            >
              {cap}
            </span>
          ))}
          {industries.slice(0, 1).map((ind, i) => (
            <span 
              key={`ind-${i}`}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-md"
            >
              {ind}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  // Wrap in Link if slug is provided
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
