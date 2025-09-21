// Image optimization and preloading utilities
import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Image preloader with cache management
 */
class ImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private loadingPromises = new Map<string, Promise<void>>();

  async preload(src: string): Promise<void> {
    if (this.cache.has(src)) return;
    
    if (this.loadingPromises.has(src)) {
      return this.loadingPromises.get(src)!;
    }

    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(src, img);
        this.loadingPromises.delete(src);
        resolve();
      };
      img.onerror = () => {
        this.loadingPromises.delete(src);
        reject(new Error(`Failed to load image: ${src}`));
      };
      img.src = src;
    });

    this.loadingPromises.set(src, promise);
    return promise;
  }

  get(src: string): HTMLImageElement | undefined {
    return this.cache.get(src);
  }

  clear(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const imageCache = new ImageCache();

/**
 * Hook for optimized image preloading
 */
export function useImagePreloader() {
  const preloadImage = useCallback(async (src: string) => {
    if (!src) return;
    try {
      await imageCache.preload(src);
    } catch (error) {
      console.warn('Failed to preload image:', src, error);
    }
  }, []);

  const preloadImages = useCallback(async (srcs: string[]) => {
    const promises = srcs.filter(Boolean).map(src => imageCache.preload(src));
    await Promise.allSettled(promises);
  }, []);

  const clearCache = useCallback(() => {
    imageCache.clear();
  }, []);

  return { preloadImage, preloadImages, clearCache };
}

/**
 * Hook for progressive image loading
 */
export function useProgressiveImage(src: string, placeholderSrc?: string) {
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc || '');
  const [isLoading, setIsLoading] = useState(!!src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!src) return;

    setIsLoading(true);
    setHasError(false);

    const img = new Image();
    img.onload = () => {
      setCurrentSrc(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { src: currentSrc, isLoading, hasError };
}