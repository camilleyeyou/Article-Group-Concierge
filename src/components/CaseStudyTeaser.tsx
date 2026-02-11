import React from 'react';
import Link from 'next/link';
import type { CaseStudyTeaserProps } from '../types';

/**
 * CaseStudyTeaser Component
 *
 * A preview card for case studies matching articlegroup.com/work style:
 * - Image-based tiles with overlaid text
 * - Clean, minimal design
 * - Hover effects with border
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
  // Generate gradient based on client name for visual variety
  // Using AG website color palette
  const gradients = [
    'from-[#32373c] to-[#1a1a1a]',
    'from-[#0d72d1] to-[#084d8c]',
    'from-[#fc5d4c] to-[#c94a3c]',
    'from-[#47ddb2] to-[#2eb88e]',
    'from-[#b47bd5] to-[#8a5ca8]',
    'from-[#4a5568] to-[#2d3748]',
  ];
  const gradientIndex = (clientName || title).charCodeAt(0) % gradients.length;
  const gradient = gradients[gradientIndex];

  const content = (
    <div className="group relative overflow-hidden bg-white border border-transparent hover:border-black transition-all duration-200">
      {/* Image/Gradient Background */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[#F5F5F5]">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${clientName || title} case study`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            {/* Decorative elements */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-1/4 left-1/4 w-32 h-32 border border-white rounded-full" />
              <div className="absolute bottom-1/4 right-1/4 w-24 h-24 border border-white rounded-full" />
            </div>
            {/* Client initial */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-7xl text-white/20" style={{ fontFamily: 'Lora, serif' }}>
                {(clientName || title).charAt(0)}
              </span>
            </div>
          </div>
        )}

        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Title overlay - AG style: centered text on image */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <h3
            className="text-white text-xl md:text-2xl text-center leading-tight"
            style={{ fontFamily: 'Lora, serif' }}
          >
            {title}
          </h3>
        </div>
      </div>

      {/* Content area */}
      <div className="p-5">
        {/* Client name */}
        {clientName && (
          <p className="text-sm text-[#6B6B6B] mb-2">
            {clientName}
          </p>
        )}

        {/* Summary */}
        {summary && (
          <p className="text-sm text-[#313131] leading-relaxed line-clamp-2 mb-4">
            {summary}
          </p>
        )}

        {/* Tags */}
        {(capabilities.length > 0 || industries.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {capabilities.slice(0, 2).map((cap, i) => (
              <span
                key={`cap-${i}`}
                className="px-2 py-1 text-xs text-[#0d72d1] bg-[#0d72d1]/10"
              >
                {cap}
              </span>
            ))}
            {industries.slice(0, 1).map((ind, i) => (
              <span
                key={`ind-${i}`}
                className="px-2 py-1 text-xs text-[#6B6B6B] bg-[#F5F5F5]"
              >
                {ind}
              </span>
            ))}
          </div>
        )}

        {/* View link */}
        <div className="flex items-center gap-2 text-[#fc5d4c] group-hover:gap-3 transition-all">
          <span className="text-sm font-medium">View project</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
