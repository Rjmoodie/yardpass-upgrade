// Image utility functions for performance optimization
import React, { useEffect } from 'react';

/**
 * Generate optimized image URL using Supabase transforms
 */
export const getOptimizedImageUrl = (
  path: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {}
): string => {
  if (!path) return '';
  
  const { width = 1200, quality = 70, format = 'webp' } = options;
  
  // If it's already a full URL, return as is
  if (path.startsWith('http')) {
    return path;
  }
  
  // Build Supabase transform URL
  const params = new URLSearchParams();
  params.set('width', width.toString());
  params.set('quality', quality.toString());
  params.set('format', format);
  
  return `${path}?${params.toString()}`;
};

/**
 * Preload next images for better UX
 */
export const preloadImages = (urls: string[], options?: { width?: number }) => {
  const { width = 600 } = options || {};
  
  urls.forEach(url => {
    if (url) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = getOptimizedImageUrl(url, { width });
      document.head.appendChild(link);
    }
  });
};

/**
 * Lazy load image with intersection observer
 */
export const useLazyImage = (ref: React.RefObject<HTMLImageElement>, src: string) => {
  useEffect(() => {
    const img = ref.current;
    if (!img) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            img.src = src;
            observer.unobserve(img);
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(img);
    return () => observer.disconnect();
  }, [src]);
};