import React from 'react';
import Link from 'next/link';
import type { CaseStudyTeaserProps } from '../types';

/**
 * CaseStudyTeaser Component
 * 
 * A preview card for case studies matching the Article Group website style.
 * Features image, title overlay, and "View project" link.
 * 
 * TODO: Client to provide:
 * - Case study thumbnail images
 * - Vimeo video links for video case studies
 * 
 * Currently using gradient placeholders with client initials.
 * When assets arrive, simply pass thumbnailUrl prop to display images.
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
  // Generate a gradient background based on client name for visual variety
  // These gradients use AG brand colors for consistency
  const gradients = [
    'from-[#1A1818] to-[#2d2d2d]',   // Dark (AG primary)
    'from-[#0097A7] to-[#006d7a]',   // Teal (AG accent)
    'from-[#F96A63] to-[#d45850]',   // Coral (AG accent)
    'from-[#3FD9A3] to-[#2eb884]',   // Green (AG accent)
    'from-[#4A5568] to-[#2D3748]',   // Slate
    'from-[#5B5EA6] to-[#484b8a]',   // Purple
  ];
  const gradientIndex = (clientName || title).charCodeAt(0) % gradients.length;
  const gradient = gradients[gradientIndex];

  const content = (
    <div className="group relative overflow-hidden rounded-xl bg-[#1A1818] transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
      {/* Image/Gradient Background */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${clientName || title} case study`}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            {/* Decorative pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-white rounded-full" />
              <div className="absolute bottom-1/4 right-1/4 w-24 h-24 border border-white rounded-full" />
            </div>
            {/* Client initial */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl font-serif text-white/20">
                {(clientName || title).charAt(0)}
              </span>
            </div>
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        
        {/* Case study label */}
        <div className="absolute top-4 left-4">
          <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
            Case study
          </span>
        </div>
        
        {/* Client badge */}
        {clientName && (
          <div className="absolute top-4 right-4">
            <span className="px-3 py-1 text-xs font-medium text-white bg-white/20 backdrop-blur-sm rounded-full">
              {clientName}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-6">
        {/* Title */}
        <h3 className="font-serif text-xl text-white mb-3 leading-snug group-hover:text-[#F96A63] transition-colors">
          {title}
        </h3>
        
        {/* Summary - only show if available */}
        {summary && (
          <p className="text-sm text-white/60 leading-relaxed mb-4 line-clamp-2">
            {summary}
          </p>
        )}
        
        {/* Tags */}
        {(capabilities.length > 0 || industries.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {capabilities.slice(0, 2).map((cap, i) => (
              <span 
                key={`cap-${i}`}
                className="px-2 py-1 text-xs text-[#0097A7] bg-[#0097A7]/20 rounded"
              >
                {cap}
              </span>
            ))}
            {industries.slice(0, 1).map((ind, i) => (
              <span 
                key={`ind-${i}`}
                className="px-2 py-1 text-xs text-white/50 bg-white/10 rounded"
              >
                {ind}
              </span>
            ))}
          </div>
        )}
        
        {/* View project link */}
        <div className="flex items-center gap-2 text-[#F96A63] group-hover:gap-3 transition-all">
          <span className="text-sm font-medium">View project</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
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
