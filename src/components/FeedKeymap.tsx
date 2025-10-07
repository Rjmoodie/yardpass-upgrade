import { useEffect, useMemo } from 'react';

export function FeedKeymap() {
  // Keep handlers stable
  const handler = useMemo(() => {
    return (e: KeyboardEvent) => {
      // Example: j/k navigation; customize as needed
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'j') window.dispatchEvent(new CustomEvent('feed:next'));
      if (e.key === 'k') window.dispatchEvent(new CustomEvent('feed:prev'));
    };
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);

  return { layer: null };
}
