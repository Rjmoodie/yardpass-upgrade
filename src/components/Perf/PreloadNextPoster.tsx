import { useEffect } from 'react';

interface PreloadNextPosterProps {
  url?: string;
}

export function PreloadNextPoster({ url }: PreloadNextPosterProps) {
  useEffect(() => {
    if (!url) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch {
        // Link might already be removed
      }
    };
  }, [url]);
  return null;
}