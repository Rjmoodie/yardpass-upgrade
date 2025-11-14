/**
 * Supabase Image Optimization Utility
 * Automatically adds transformation parameters to Supabase Storage URLs
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Optimizes a Supabase Storage image URL with transformation parameters
 * 
 * @example
 * optimizeSupabaseImage(url, { width: 1200, quality: 80, format: 'webp' })
 */
export function optimizeSupabaseImage(
  url: string | null | undefined,
  options: ImageOptimizationOptions = {}
): string {
  // Return empty string if no URL
  if (!url) return '';
  
  // Skip if not a Supabase URL
  if (!url.includes('supabase.co/storage')) return url;
  
  // Default options
  const {
    width,
    height,
    quality = 80,
    format = 'webp',
    resize = 'cover'
  } = options;
  
  // Build transformation parameters
  const params = new URLSearchParams();
  
  if (width) params.append('width', width.toString());
  if (height) params.append('height', height.toString());
  params.append('quality', quality.toString());
  params.append('format', format);
  params.append('resize', resize);
  
  // Check if URL already has query params
  const separator = url.includes('?') ? '&' : '?';
  
  return `${url}${separator}${params.toString()}`;
}

/**
 * Predefined optimization presets
 */
export const IMAGE_PRESETS = {
  /** Hero/banner images - Large, high quality */
  hero: { width: 1920, quality: 85, format: 'webp' as const },
  
  /** Event cards - Medium, optimized */
  card: { width: 800, quality: 80, format: 'webp' as const },
  
  /** Thumbnails - Small, compressed */
  thumb: { width: 400, quality: 75, format: 'webp' as const },
  
  /** Profile avatars - Small, high quality */
  avatar: { width: 200, height: 200, quality: 85, format: 'webp' as const, resize: 'cover' as const },
  
  /** Post images - Medium quality */
  post: { width: 1200, quality: 80, format: 'webp' as const },
} as const;

/**
 * Generate srcset for responsive images
 * 
 * @example
 * generateSrcSet(url, [480, 800, 1200])
 */
export function generateSrcSet(
  url: string,
  widths: number[] = [480, 800, 1200, 1920],
  quality = 80
): string {
  return widths
    .map(width => {
      const optimized = optimizeSupabaseImage(url, { width, quality, format: 'webp' });
      return `${optimized} ${width}w`;
    })
    .join(', ');
}

