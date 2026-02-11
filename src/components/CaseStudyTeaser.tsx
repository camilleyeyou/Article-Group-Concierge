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

  // Parse title to separate client name if format is "Client: Project Title"
  const titleParts = title.split(':');
  const displayClientName = titleParts.length > 1 ? titleParts[0].trim() : clientName;
  const displayTitle = titleParts.length > 1 ? titleParts.slice(1).join(':').trim() : title;

  const content = (
    <div className="group relative overflow-hidden bg-white border border-transparent hover:border-black transition-all duration-300">
      {/* Image/Gradient Background - AG uses larger aspect ratio */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${displayClientName || displayTitle} case study`}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`}>
            {/* Decorative elements - more subtle */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-1/4 left-1/4 w-40 h-40 border border-white rounded-full" />
              <div className="absolute bottom-1/4 right-1/4 w-32 h-32 border border-white rounded-full" />
            </div>
            {/* Client initial - larger, more prominent */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-8xl text-white/10"
                style={{ fontFamily: 'Lora, serif' }}
              >
                {(displayClientName || displayTitle).charAt(0)}
              </span>
            </div>
          </div>
        )}

        {/* Overlay gradient - more subtle for cleaner look */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Content area - cleaner layout */}
      <div className="p-6">
        {/* Client name - subtle label style */}
        {displayClientName && (
          <p className="text-xs font-medium text-[#0d72d1] uppercase tracking-wider mb-2">
            {displayClientName}
          </p>
        )}

        {/* Project title - using Lora for editorial feel */}
        <h3
          className="text-lg md:text-xl text-black leading-snug mb-3 group-hover:text-[#fc5d4c] transition-colors duration-300"
          style={{ fontFamily: 'Lora, serif', fontWeight: 400 }}
        >
          {displayTitle}
        </h3>

        {/* Summary - if available */}
        {summary && (
          <p className="text-sm text-[#6B6B6B] leading-relaxed line-clamp-2 mb-4">
            {summary}
          </p>
        )}

        {/* Tags - minimal, inline style */}
        {(capabilities.length > 0 || industries.length > 0) && (
          <div className="flex flex-wrap gap-2 mb-5">
            {capabilities.slice(0, 2).map((cap, i) => (
              <span
                key={`cap-${i}`}
                className="px-2 py-0.5 text-xs text-[#0d72d1] bg-[#0d72d1]/8 font-medium"
              >
                {cap}
              </span>
            ))}
            {industries.slice(0, 1).map((ind, i) => (
              <span
                key={`ind-${i}`}
                className="px-2 py-0.5 text-xs text-[#6B6B6B] bg-[#F5F5F5] font-medium"
              >
                {ind}
              </span>
            ))}
          </div>
        )}

        {/* View link - AG style with arrow animation */}
        <div className="flex items-center gap-2 text-[#fc5d4c] font-medium text-sm">
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
