import { useRef, useMemo } from 'react';

export function FeedGestures() {
  const startY = useRef<number | null>(null);

  const containerProps = useMemo(() => ({
    onTouchStart: (e: React.TouchEvent) => {
      startY.current = e.touches[0]?.clientY ?? null;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (startY.current == null) return;
      const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current;
      if (Math.abs(dy) > 60) {
        window.dispatchEvent(new CustomEvent(dy < 0 ? 'feed:next' : 'feed:prev'));
        startY.current = null;
      }
    },
    onTouchEnd: () => { startY.current = null; },
  }), []);

  return { containerProps };
}
