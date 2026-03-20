/**
 * Custom image loader for next/image with Supabase Storage.
 *
 * Supabase Storage supports on-the-fly image transforms via query params:
 *   ?width=800&height=600&resize=contain&quality=80
 *
 * This loader passes the width and quality requested by next/image
 * to Supabase's transform API, giving us optimised images without
 * needing a separate CDN.
 *
 * Usage:
 *   import { supabaseLoader } from '@/lib/supabase-image-loader';
 *   <Image loader={supabaseLoader} src={url} ... />
 */

interface ImageLoaderParams {
  src: string;
  width: number;
  quality?: number;
}

export function supabaseLoader({ src, width, quality }: ImageLoaderParams): string {
  // Only transform Supabase Storage URLs
  if (!src.includes('supabase.co/storage/')) {
    return src;
  }

  // Supabase render endpoint for transforms
  // /storage/v1/object/public/bucket/path → /storage/v1/render/image/public/bucket/path
  const transformed = src.replace(
    '/storage/v1/object/',
    '/storage/v1/render/image/'
  );

  // Also works with signed URLs — append transform params
  const separator = transformed.includes('?') ? '&' : '?';
  return `${transformed}${separator}width=${width}&quality=${quality || 75}&resize=contain`;
}
