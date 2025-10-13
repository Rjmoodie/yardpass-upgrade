// src/components/RecentPostsRail.tsx
import { useEffect, useRef, useState } from 'react';
import { EventPost } from '@/types/events';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { Play, Heart, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { YardpassSpinner } from '@/components/LoadingSpinner';

export function RecentPostsRail({
  posts,
  onPostClick,
  onViewAllClick,
}: {
  posts: EventPost[];
  onPostClick: (postId: string, post?: EventPost) => void;
  onViewAllClick: () => void;
}) {
  const [imageLoading, setImageLoading] = useState<Record<string, boolean>>({});
  const [isVisible, setIsVisible] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '50px', threshold: 0.1 });

    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!posts?.length) {
    return (
      <div ref={railRef} className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <p className="text-sm text-gray-300 text-center">Be the first to post about this event!</p>
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div ref={railRef} className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="flex items-center justify-center">
          <YardpassSpinner size="xs" appearance="inverted" showGlow={false} />
          <span className="ml-2 text-sm text-gray-300">Loading posts...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={railRef} className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-white">Recent Posts</h4>
        <button onClick={onViewAllClick} className="text-xs text-primary hover:text-primary/80 font-medium">
          View All
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => onPostClick(post.id, post)}
            className="flex-shrink-0 w-24 h-24 bg-white/10 rounded-lg border border-white/20 hover:bg-white/15 transition-all duration-200 relative group"
            aria-label="Open post"
          >
            {post.thumbnailUrl ? (
              <div className="relative w-full h-full">
                <ImageWithFallback
                  src={post.thumbnailUrl}
                  alt="Post thumbnail"
                  className="w-full h-full object-cover rounded-lg"
                  onLoad={() => setImageLoading((prev) => ({ ...prev, [post.id]: false }))}
                  onError={() => setImageLoading((prev) => ({ ...prev, [post.id]: false }))}
                />
                {imageLoading[post.id] !== false && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/5">
                    <YardpassSpinner size="xs" appearance="inverted" showGlow={false} />
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded-lg bg-white/5">
                {post.mediaType === 'video' ? <Play className="w-6 h-6 text-white/60" /> : <ImageIcon className="w-6 h-6 text-white/60" />}
              </div>
            )}

            {post.mediaType === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center">
                  <Play className="w-4 h-4 text-white ml-0.5" />
                </div>
              </div>
            )}

            <div className="absolute bottom-1 left-1 right-1">
              <div className="bg-black/70 rounded px-1 py-0.5">
                <p className="text-xs text-white truncate">{post.authorName}</p>
                <div className="flex items-center gap-1 text-xs text-gray-300">
                  <Heart className="w-3 h-3" />
                  <span>{post.likes}</span>
                  {!!post.commentCount && (
                    <>
                      <MessageCircle className="w-3 h-3 ml-1" />
                      <span>{post.commentCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}