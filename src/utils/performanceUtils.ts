// Performance optimization utility functions
import { useCallback, useMemo, useRef } from 'react';

/**
 * Creates a stable callback that doesn't change unless dependencies change
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);
  const depsRef = useRef(deps);
  
  // Update refs when dependencies change
  const depsChanged = !depsRef.current || 
    deps.length !== depsRef.current.length ||
    deps.some((dep, i) => dep !== depsRef.current![i]);
    
  if (depsChanged) {
    callbackRef.current = callback;
    depsRef.current = deps;
  }
  
  return callbackRef.current;
}

/**
 * Memoized selector with equality check to prevent unnecessary re-renders
 */
export function useShallowMemo<T>(value: T): T {
  const valueRef = useRef<T>(value);
  
  if (shallowEqual(value, valueRef.current)) {
    return valueRef.current;
  }
  
  valueRef.current = value;
  return value;
}

/**
 * Shallow equality check for objects and arrays
 */
function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return false;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (let key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  
  return true;
}

/**
 * Optimized event handler that prevents default and stops propagation
 */
export function useOptimizedEventHandler<T extends Event>(
  handler: (event: T) => void,
  deps: React.DependencyList = []
) {
  return useCallback(
    (event: T) => {
      event.preventDefault();
      event.stopPropagation();
      handler(event);
    },
    deps
  );
}

/**
 * Resource preloader for images and videos
 */
export function useResourcePreloader() {
  const loadedResources = useRef(new Set<string>());
  
  const preloadImage = useCallback((src: string) => {
    if (loadedResources.current.has(src)) return;
    
    const img = new Image();
    img.onload = () => loadedResources.current.add(src);
    img.src = src;
  }, []);
  
  const preloadVideo = useCallback((src: string) => {
    if (loadedResources.current.has(src)) return;
    
    const video = document.createElement('video');
    video.onloadeddata = () => loadedResources.current.add(src);
    video.preload = 'metadata';
    video.src = src;
  }, []);
  
  return { preloadImage, preloadVideo };
}