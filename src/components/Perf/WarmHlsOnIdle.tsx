import { useEffect } from 'react';

export function WarmHlsOnIdle() {
  useEffect(() => {
    const warm = () => {
      // kick the dynamic import while user reads the first card
      import('hls.js').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(warm, { timeout: 1500 });
    } else {
      setTimeout(warm, 800);
    }
  }, []);
  return null;
}