import React, { useState, useCallback, useEffect } from 'react';
import type { VisualAssetProps } from '../types';

/**
 * VisualAsset Component
 * 
 * Displays images and charts from Supabase Storage with:
 * - Lazy loading with blur-up effect
 * - Click-to-expand lightbox
 * - Proper aspect ratio handling
 * 
 * Usage in layout plan:
 * { 
 *   "component": "VisualAsset", 
 *   "props": { 
 *     "src": "https://...", 
 *     "alt": "...", 
 *     "caption": "..." 
 *   } 
 * }
 */

const aspectRatioClasses = {
  'auto': '',
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '3:2': 'aspect-[3/2]',
};

export const VisualAsset: React.FC<VisualAssetProps> = ({
  src,
  alt,
  caption,
  aspectRatio = 'auto',
  loading = 'lazy',
  enableLightbox = true,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);
  
  const handleError = useCallback(() => {
    setHasError(true);
  }, []);
  
  const openLightbox = useCallback(() => {
    if (enableLightbox && !hasError) {
      setIsLightboxOpen(true);
      document.body.style.overflow = 'hidden';
    }
  }, [enableLightbox, hasError]);
  
  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
    document.body.style.overflow = '';
  }, []);
  
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLightboxOpen) {
        closeLightbox();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen, closeLightbox]);
  
  // Error state
  if (hasError) {
    return (
      <div 
        className="
          rounded-xl bg-[var(--color-bg-muted)] 
          p-12 flex items-center justify-center
          text-[var(--color-text-tertiary)]
        "
      >
        <div className="text-center">
          <svg 
            className="w-12 h-12 mx-auto mb-3 opacity-40"
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" 
            />
          </svg>
          <p className="text-[var(--text-sm)]">Unable to load image</p>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <figure className="group">
        {/* Image container */}
        <div 
          className={`
            relative overflow-hidden rounded-xl
            bg-[var(--color-bg-muted)]
            ${aspectRatioClasses[aspectRatio]}
            ${enableLightbox ? 'cursor-zoom-in' : ''}
          `}
          onClick={openLightbox}
          role={enableLightbox ? 'button' : undefined}
          tabIndex={enableLightbox ? 0 : undefined}
          onKeyDown={(e) => {
            if (enableLightbox && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              openLightbox();
            }
          }}
          aria-label={enableLightbox ? `View ${alt} in fullscreen` : undefined}
        >
          {/* Loading skeleton */}
          {!isLoaded && (
            <div 
              className="
                absolute inset-0 
                bg-gradient-to-r from-[var(--color-bg-muted)] via-[var(--color-border-subtle)] to-[var(--color-bg-muted)]
                animate-pulse
              "
            />
          )}
          
          {/* The actual image */}
          <img
            src={src}
            alt={alt}
            loading={loading}
            onLoad={handleLoad}
            onError={handleError}
            className={`
              w-full h-full object-cover
              transition-all duration-700 ease-out
              ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
              ${enableLightbox ? 'group-hover:scale-[1.02]' : ''}
            `}
          />
          
          {/* Hover overlay with zoom icon */}
          {enableLightbox && isLoaded && (
            <div 
              className="
                absolute inset-0 
                bg-black/0 group-hover:bg-black/20
                flex items-center justify-center
                transition-all duration-300
                opacity-0 group-hover:opacity-100
              "
            >
              <div 
                className="
                  w-12 h-12 rounded-full
                  bg-white/90 backdrop-blur-sm
                  flex items-center justify-center
                  transform scale-75 group-hover:scale-100
                  transition-transform duration-300
                "
              >
                <svg 
                  className="w-5 h-5 text-[var(--color-text-primary)]"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" 
                  />
                </svg>
              </div>
            </div>
          )}
        </div>
        
        {/* Caption */}
        {caption && (
          <figcaption 
            className="
              mt-4 px-1
              text-[var(--text-sm)] text-[var(--color-text-tertiary)]
              text-center
            "
          >
            {caption}
          </figcaption>
        )}
      </figure>
      
      {/* Lightbox overlay */}
      {isLightboxOpen && (
        <div 
          className="lightbox-overlay animate-fade-in"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Fullscreen view of ${alt}`}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="
              absolute top-6 right-6 z-10
              w-12 h-12 rounded-full
              bg-white/10 hover:bg-white/20
              flex items-center justify-center
              transition-colors duration-200
            "
            aria-label="Close lightbox"
          >
            <svg 
              className="w-6 h-6 text-white"
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M6 18L18 6M6 6l12 12" 
              />
            </svg>
          </button>
          
          {/* Fullsize image */}
          <img
            src={src}
            alt={alt}
            className="lightbox-content animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Caption in lightbox */}
          {caption && (
            <div 
              className="
                absolute bottom-6 left-1/2 transform -translate-x-1/2
                px-6 py-3 rounded-full
                bg-black/60 backdrop-blur-sm
                text-white text-[var(--text-sm)]
                max-w-lg text-center
              "
            >
              {caption}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default VisualAsset;
