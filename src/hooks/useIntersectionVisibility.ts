/**
 * Hook for IntersectionObserver-based visibility detection
 * 
 * More accurate than index-based visibility, especially for feeds with
 * variable item heights or non-snap scrolling.
 */

import { useEffect, useRef, useState } from 'react';

interface UseIntersectionVisibilityOptions {
  /**
   * Root margin for preloading (e.g., "100px" preloads when 100px away)
   * Default: "50px" (preload slightly before fully visible)
   */
  rootMargin?: string;
  
  /**
   * Threshold for considering element visible (0-1)
   * Default: 0.1 (10% visible)
   */
  threshold?: number | number[];
  
  /**
   * Whether to track visibility changes
   * Default: true
   */
  enabled?: boolean;
}

/**
 * Hook that uses IntersectionObserver to detect when an element is visible
 * or about to be visible in the viewport.
 * 
 * Returns:
 * - `isVisible`: Whether the element is currently visible
 * - `isNearVisible`: Whether the element is within rootMargin of being visible
 * - `ref`: Ref to attach to the element
 */
export function useIntersectionVisibility(
  options: UseIntersectionVisibilityOptions = {}
): {
  isVisible: boolean;
  isNearVisible: boolean;
  ref: React.RefObject<HTMLElement>;
} {
  const {
    rootMargin = '50px',
    threshold = 0.1,
    enabled = true,
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isNearVisible, setIsNearVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !elementRef.current) {
      setIsVisible(false);
      setIsNearVisible(false);
      return;
    }

    const element = elementRef.current;

    // Observer for actual visibility (smaller margin)
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= threshold);
      },
      {
        rootMargin: '0px',
        threshold,
      }
    );

    // Observer for near visibility (larger margin for preloading)
    const preloadObserver = new IntersectionObserver(
      ([entry]) => {
        setIsNearVisible(entry.isIntersecting || entry.intersectionRatio > 0);
      },
      {
        rootMargin,
        threshold: 0,
      }
    );

    visibilityObserver.observe(element);
    preloadObserver.observe(element);

    return () => {
      visibilityObserver.disconnect();
      preloadObserver.disconnect();
    };
  }, [enabled, rootMargin, threshold]);

  return {
    isVisible,
    isNearVisible,
    ref: elementRef,
  };
}

