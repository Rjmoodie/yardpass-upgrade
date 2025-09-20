import { useCallback, useRef, useState } from 'react';

interface SmoothScrollOptions {
  onIndexChange: (index: number) => void;
  maxIndex: number;
  swipeThreshold?: number;
  animationDuration?: number;
}

export function useSmoothScroll({ 
  onIndexChange, 
  maxIndex, 
  swipeThreshold = 80,
  animationDuration = 400 
}: SmoothScrollOptions) {
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<{ y: number; t: number } | null>(null);
  const currentIndexRef = useRef(0);

  const smoothTransition = useCallback((newIndex: number) => {
    if (isAnimating || newIndex < 0 || newIndex > maxIndex) return;
    
    setIsAnimating(true);
    currentIndexRef.current = newIndex;
    onIndexChange(newIndex);
    
    // Reset animation state after duration
    setTimeout(() => {
      setIsAnimating(false);
    }, animationDuration);
  }, [isAnimating, maxIndex, onIndexChange, animationDuration]);

  const handleSwipe = useCallback((direction: 'up' | 'down') => {
    if (isAnimating) return;
    
    const currentIndex = currentIndexRef.current;
    if (direction === 'down' && currentIndex < maxIndex) {
      smoothTransition(currentIndex + 1);
    } else if (direction === 'up' && currentIndex > 0) {
      smoothTransition(currentIndex - 1);
    }
  }, [isAnimating, maxIndex, smoothTransition]);

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartRef.current = { y: touch.clientY, t: Date.now() };
  }, [isAnimating]);

  const onTouchEnd = useCallback((e: TouchEvent) => {
    if (isAnimating) return;
    
    const start = touchStartRef.current;
    if (!start) return;
    
    const endY = e.changedTouches[0]?.clientY ?? start.y;
    const deltaY = start.y - endY;
    const deltaTime = Date.now() - start.t;
    
    // Improved swipe detection
    const absY = Math.abs(deltaY);
    const velocity = absY / deltaTime; // pixels per ms
    
    // Either fast swipe or sufficient distance
    const shouldSwipe = (velocity > 0.5 && absY > 30) || (absY > swipeThreshold);
    
    if (shouldSwipe) {
      handleSwipe(deltaY > 0 ? 'down' : 'up');
    }
    
    touchStartRef.current = null;
  }, [isAnimating, swipeThreshold, handleSwipe]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (isAnimating) return;
    
    const currentIndex = currentIndexRef.current;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'PageUp':
        e.preventDefault();
        handleSwipe('up');
        break;
      case 'ArrowDown':
      case 'PageDown':
        e.preventDefault();
        handleSwipe('down');
        break;
      case 'Home':
        e.preventDefault();
        smoothTransition(0);
        break;
      case 'End':
        e.preventDefault();
        smoothTransition(maxIndex);
        break;
    }
  }, [isAnimating, maxIndex, handleSwipe, smoothTransition]);

  const setCurrentIndex = useCallback((index: number) => {
    currentIndexRef.current = index;
  }, []);

  return {
    onTouchStart,
    onTouchEnd,
    onKeyDown,
    isAnimating,
    setCurrentIndex,
    smoothTransition
  };
}