import React from 'react';
import type { HeroBlockProps } from '../types';

/**
 * HeroBlock Component
 * 
 * The primary headline component for pitch decks.
 * Typically appears first and sets the context for the presentation.
 */
export const HeroBlock: React.FC<HeroBlockProps> = ({
  title,
  subtitle,
  challengeSummary,
  backgroundVariant = 'light',
}) => {
  const bgClasses = {
    dark: 'bg-[#1A1818] text-white',
    light: 'bg-white text-[#1A1818]',
    gradient: 'bg-gradient-to-br from-[#1A1818] to-[#333] text-white',
  };
  
  return (
    <section
      className={`
        relative overflow-hidden
        px-6 py-10 md:py-14
        rounded-xl
        ${bgClasses[backgroundVariant]}
      `}
    >
      {/* Subtle accent decoration */}
      <div 
        className={`
          absolute top-0 right-0 w-48 h-48 
          rounded-full blur-3xl opacity-10
          ${backgroundVariant === 'light' ? 'bg-[#F96A63]' : 'bg-[#0097A7]'}
        `}
        style={{ transform: 'translate(30%, -30%)' }}
      />
      
      <div className="relative max-w-3xl">
        {/* Subtitle/label */}
        {subtitle && (
          <p className={`
            text-xs uppercase tracking-widest mb-3 font-medium
            ${backgroundVariant === 'light' ? 'text-[#F96A63]' : 'text-[#3FD9A3]'}
          `}>
            {subtitle}
          </p>
        )}
        
        {/* Main title */}
        <h1 className="font-serif text-2xl md:text-3xl lg:text-4xl font-medium leading-tight mb-4">
          {title}
        </h1>
        
        {/* Challenge summary */}
        {challengeSummary && (
          <p className={`
            text-sm md:text-base leading-relaxed max-w-2xl
            ${backgroundVariant === 'light' ? 'text-gray-600' : 'text-white/80'}
          `}>
            {challengeSummary}
          </p>
        )}
      </div>
    </section>
  );
};

export default HeroBlock;
