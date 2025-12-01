// src/components/post-viewer/usePostSequenceNavigation.ts
import { useState, useCallback } from "react";

/**
 * Reusable hook for prev/next navigation through a sequence.
 * Can be used in lightboxes, carousels, or any sequential viewer.
 */
export function usePostSequenceNavigation(total: number, initialIndex = 0) {
  const [index, setIndex] = useState<number | null>(
    total > 0 ? Math.min(Math.max(initialIndex, 0), total - 1) : null
  );

  const canGoPrev = index !== null && index > 0;
  const canGoNext = index !== null && index < total - 1;

  const goPrev = useCallback(() => {
    setIndex((i) => (i == null ? i : Math.max(0, i - 1)));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => (i == null ? i : Math.min(total - 1, i + 1)));
  }, [total]);

  const goTo = useCallback(
    (newIndex: number) => {
      if (total === 0) return;
      setIndex(Math.min(Math.max(newIndex, 0), total - 1));
    },
    [total]
  );

  return {
    index,
    setIndex,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    goTo,
  };
}


