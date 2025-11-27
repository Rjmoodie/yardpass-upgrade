import { useEffect } from 'react';

export function DeferredImports() {
  useEffect(() => {
    const idle = () => {
      // Preload heavy modal components
      import('@/features/comments').then(({ CommentModal }) => CommentModal).catch(() => {});
      import('@/lib/analytics').catch(() => {});
      import('@/components/ShareModal').catch(() => {});
      import('@/components/EventCheckoutSheet').catch(() => {});
    };
    const id = setTimeout(idle, 1200);
    return () => clearTimeout(id);
  }, []);
  return null;
}