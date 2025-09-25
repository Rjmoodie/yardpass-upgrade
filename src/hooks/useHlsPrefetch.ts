import { useEffect, useRef } from 'react';

function canPrefetch() {
  const n = (navigator as any).connection;
  // Be conservative on slow networks
  const slow = n && ['slow-2g', '2g'].includes(n.effectiveType);
  return !slow;
}

// naive memoized fetch to warm HTTP and CDN caches
const seen = new Set<string>();
async function warmManifest(url: string) {
  if (!url || seen.has(url)) return;
  seen.add(url);
  try {
    await fetch(url, { method: 'GET', mode: 'cors', cache: 'force-cache' });
  } catch { /* ignore */ }
}

export function useHlsPrefetch(currentIndex: number, urls: string[], lookahead = 1) {
  const ref = useRef({ idx: -1 });

  useEffect(() => {
    if (!canPrefetch()) return;
    if (currentIndex === ref.current.idx) return;
    ref.current.idx = currentIndex;

    // prefetch next N manifests
    for (let i = 1; i <= lookahead; i++) {
      const nextUrl = urls[currentIndex + i];
      if (nextUrl) warmManifest(nextUrl);
    }
  }, [currentIndex, urls, lookahead]);
}