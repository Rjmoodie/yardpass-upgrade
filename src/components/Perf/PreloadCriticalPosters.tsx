import { useEffect } from 'react';
import { muxToPoster } from '@/utils/mux';
import { isLikelyVideo } from '@/utils/media';

interface PreloadCriticalPostersProps {
  posts: Array<{ media_urls?: string[] }>;
  limit?: number;
}

export function PreloadCriticalPosters({ posts, limit = 3 }: PreloadCriticalPostersProps) {
  useEffect(() => {
    const links: HTMLLinkElement[] = [];
    
    // Preload the first few video posters with high priority
    posts.slice(0, limit).forEach((post, index) => {
      if (!post.media_urls) return;
      
      post.media_urls.forEach(url => {
        if (isLikelyVideo(url)) {
          const posterUrl = muxToPoster(url, 'fit_mode=smartcrop&time=1&width=800');
          const link = document.createElement('link');
          link.rel = index === 0 ? 'preload' : 'prefetch'; // First is critical
          link.as = 'image';
          link.href = posterUrl;
          if (index === 0) link.fetchPriority = 'high';
          document.head.appendChild(link);
          links.push(link);
        }
      });
    });

    return () => {
      links.forEach(link => {
        try {
          document.head.removeChild(link);
        } catch {
          // Link might already be removed
        }
      });
    };
  }, [posts, limit]);

  return null;
}