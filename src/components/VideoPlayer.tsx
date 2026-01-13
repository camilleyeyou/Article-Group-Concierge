import React, { useState, useCallback } from 'react';
import type { VideoPlayerProps } from '../types';

/**
 * VideoPlayer Component
 * 
 * Embeds Vimeo videos with a custom thumbnail overlay.
 * Supports lazy loading and custom aspect ratios.
 * 
 * Usage in layout plan:
 * { "component": "VideoPlayer", "props": { "url": "https://vimeo.com/...", "caption": "..." } }
 */

// Extract Vimeo ID from various URL formats
const extractVimeoId = (url: string): string | null => {
  const patterns = [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/channels\/[\w-]+\/(\d+)/,
    /vimeo\.com\/groups\/[\w-]+\/videos\/(\d+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

const aspectRatioClasses = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  caption,
  aspectRatio = '16:9',
  autoplay = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(autoplay);
  
  const vimeoId = extractVimeoId(url);
  
  const handlePlay = useCallback(() => {
    setHasInteracted(true);
  }, []);
  
  const handleIframeLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);
  
  if (!vimeoId) {
    return (
      <div className="card bg-[var(--color-bg-muted)] p-8 text-center">
        <p className="text-[var(--color-text-tertiary)]">
          Invalid video URL
        </p>
      </div>
    );
  }
  
  const embedUrl = `https://player.vimeo.com/video/${vimeoId}?${new URLSearchParams({
    autoplay: hasInteracted ? '1' : '0',
    loop: '0',
    title: '0',
    byline: '0',
    portrait: '0',
    dnt: '1',
    color: '0A0A0A',
  }).toString()}`;
  
  const thumbnailUrl = `https://vumbnail.com/${vimeoId}.jpg`;
  
  return (
    <figure className="group">
      <div 
        className={`
          relative overflow-hidden rounded-xl
          bg-[var(--color-bg-muted)]
          ${aspectRatioClasses[aspectRatio]}
        `}
      >
        {/* Loading skeleton */}
        {!isLoaded && hasInteracted && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-[var(--color-border)] border-t-[var(--color-text-primary)] rounded-full animate-spin" />
          </div>
        )}
        
        {/* Thumbnail overlay (before interaction) */}
        {!hasInteracted && (
          <button
            onClick={handlePlay}
            className="
              absolute inset-0 z-10
              flex items-center justify-center
              cursor-pointer
              group/play
            "
            aria-label="Play video"
          >
            {/* Thumbnail image */}
            <img
              src={thumbnailUrl}
              alt=""
              className="
                absolute inset-0 w-full h-full object-cover
                transition-transform duration-700 ease-out
                group-hover/play:scale-105
              "
              loading="lazy"
            />
            
            {/* Dark overlay */}
            <div 
              className="
                absolute inset-0 bg-black/30
                transition-opacity duration-300
                group-hover/play:bg-black/40
              " 
            />
            
            {/* Play button */}
            <div 
              className="
                relative z-10
                w-20 h-20 rounded-full
                bg-white/95 backdrop-blur-sm
                flex items-center justify-center
                shadow-2xl
                transition-transform duration-300 ease-out
                group-hover/play:scale-110
              "
            >
              <svg 
                className="w-8 h-8 text-[var(--color-text-primary)] ml-1"
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </button>
        )}
        
        {/* Vimeo iframe */}
        {hasInteracted && (
          <iframe
            src={embedUrl}
            className={`
              absolute inset-0 w-full h-full
              transition-opacity duration-500
              ${isLoaded ? 'opacity-100' : 'opacity-0'}
            `}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            onLoad={handleIframeLoad}
            title={caption || 'Video'}
          />
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
  );
};

export default VideoPlayer;
