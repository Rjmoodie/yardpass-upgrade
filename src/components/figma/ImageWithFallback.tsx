import React, { useState } from 'react';

interface ImageWithFallbackProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'fetchPriority'> {
  src: string;
  alt: string;
  fallback?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Disable responsive sources (for small icons/avatars) */
  disableResponsive?: boolean;
  /** Sizes attribute for responsive images (defaults to smart calculation) */
  sizes?: string;
  /** Show blur placeholder while loading (improves perceived performance) */
  showBlurPlaceholder?: boolean;
}

// ✅ Blur placeholder data URL (10x10 neutral gray blur)
const BLUR_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGZpbHRlciBpZD0iYiI+PGZlR2F1c3NpYW5CbHVyIHN0ZERldmlhdGlvbj0iMiIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2VlZSIgZmlsdGVyPSJ1cmwoI2IpIi8+PC9zdmc+';

/**
 * Production-grade image component with:
 * - AVIF/WebP/JPG cascading for modern format support
 * - Responsive sources (400w, 800w)
 * - Lazy loading by default (unless fetchPriority="high")
 * - Blur placeholder for smooth loading experience
 * - Automatic quality optimization
 * - Error fallback
 */
export function ImageWithFallback({ 
  src, 
  alt, 
  fallback = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4=',
  className = '',
  fetchPriority = 'low',
  disableResponsive = false,
  sizes,
  loading,
  showBlurPlaceholder = true,
  ...props 
}: ImageWithFallbackProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const handleError = () => {
    setHasError(true);
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  // Use fallback if error occurred or src is empty
  if (hasError || !src) {
    return (
      <img
        src={fallback}
        alt={alt}
        className={className}
        loading={loading || (fetchPriority === 'high' ? 'eager' : 'lazy')}
        decoding="async"
        {...props}
      />
    );
  }

  // For small images (avatars, icons), skip responsive sources
  if (disableResponsive) {
    return (
      <img
        src={src}
        alt={alt}
        onError={handleError}
        className={className}
        loading={loading || (fetchPriority === 'high' ? 'eager' : 'lazy')}
        decoding="async"
        fetchpriority={fetchPriority}
        {...props}
      />
    );
  }

  // Generate responsive URLs (supports Supabase Storage query params)
  const base = src;
  const isSupabaseStorage = base.includes('supabase.co/storage');
  const isPlaceholder = base.includes('placeholder') || base.startsWith('data:');
  
  // Smart sizes calculation based on common breakpoints
  const imageSizes = sizes || '(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 33vw';
  
  // Generate source URLs with format and size optimizations
  const generateSourceUrl = (width: number, format: string, quality: number) => {
    if (isPlaceholder) return base;
    if (isSupabaseStorage) {
      return `${base}${base.includes('?') ? '&' : '?'}width=${width}&quality=${quality}&format=${format}`;
    }
    // Fallback for other CDNs or direct URLs
    return base;
  };

  const src400avif = generateSourceUrl(400, 'avif', 70);
  const src800avif = generateSourceUrl(800, 'avif', 70);
  const src400webp = generateSourceUrl(400, 'webp', 80);
  const src800webp = generateSourceUrl(800, 'webp', 80);
  const src400jpg = generateSourceUrl(400, 'jpg', 80);
  const src800jpg = generateSourceUrl(800, 'jpg', 80);

  return (
    <div className="relative" style={{ aspectRatio: props.style?.aspectRatio }}>
      {/* ✅ Blur placeholder shown while loading */}
      {showBlurPlaceholder && !isLoaded && (
        <img
          src={BLUR_PLACEHOLDER}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover ${className}`}
          style={{ filter: 'blur(10px)', transform: 'scale(1.1)' }}
        />
      )}
      
      <picture>
        {/* AVIF - best compression (70% smaller than JPG), but limited browser support */}
        {!isPlaceholder && (
          <source 
            type="image/avif" 
            srcSet={`${src400avif} 400w, ${src800avif} 800w`}
            sizes={imageSizes}
          />
        )}
        
        {/* WebP - great compression (30% smaller than JPG), widely supported */}
        {!isPlaceholder && (
          <source 
            type="image/webp" 
            srcSet={`${src400webp} 400w, ${src800webp} 800w`}
            sizes={imageSizes}
          />
        )}
        
        {/* JPG/PNG - fallback for all browsers */}
        <img
          src={src400jpg}
          srcSet={!isPlaceholder ? `${src400jpg} 400w, ${src800jpg} 800w` : undefined}
          sizes={imageSizes}
          alt={alt}
          onError={handleError}
          onLoad={handleLoad}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          loading={loading || (fetchPriority === 'high' ? 'eager' : 'lazy')}
          decoding="async"
          fetchpriority={fetchPriority}
          {...props}
        />
      </picture>
    </div>
  );
}