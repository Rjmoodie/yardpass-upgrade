import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, Heart, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface EventPostsGridProps {
  eventId: string;
  userId?: string;
  onPostClick?: (post: any) => void;
  showTaggedOnly?: boolean; // If true, only show posts where userId is tagged
}

interface GridPost {
  id: string;
  media_urls: string[] | null;
  text: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
}

export function EventPostsGrid({ eventId, userId, onPostClick, showTaggedOnly = false }: EventPostsGridProps) {
  const [posts, setPosts] = useState<GridPost[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const url = new URL(`${baseUrl}/functions/v1/posts-list`);
        url.searchParams.append('event_id', eventId);
        url.searchParams.append('limit', '100');
        
        // If showTaggedOnly is true, filter by mentioned_user_id
        if (showTaggedOnly && userId) {
          url.searchParams.append('mentioned_user_id', userId);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setPosts([]);
          return;
        }

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) {
          console.error('Failed to fetch posts:', res.status);
          setPosts([]);
          return;
        }

        const payload = await res.json();
        const rows: any[] = payload.data ?? [];

        setPosts(rows.map((r: any) => ({
          id: r.id,
          media_urls: r.media_urls,
          text: r.text,
          like_count: r.like_count ?? 0,
          comment_count: r.comment_count ?? 0,
          created_at: r.created_at,
        })));
      } catch (error) {
        console.error('Error fetching posts:', error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [eventId, userId, showTaggedOnly]);

  const isVideoUrl = (url: string): boolean => {
    if (!url) return false;
    return url.startsWith('mux:') || url.includes('.mp4') || url.includes('.m3u8');
  };

  const getThumbnail = (post: GridPost): string | null => {
    if (!post.media_urls || post.media_urls.length === 0) return null;
    
    const firstMedia = post.media_urls[0];
    if (firstMedia.startsWith('mux:')) {
      const playbackId = firstMedia.slice(4);
      return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=400&fit_mode=smartcrop`;
    }
    
    return firstMedia;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-1">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="aspect-square animate-pulse bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageCircle className="h-12 w-12 text-white/20 mb-3" />
        <p className="text-sm text-white/60">No posts yet</p>
        <p className="text-xs text-white/40 mt-1">Be the first to share a moment!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map((post) => {
        const thumbnail = getThumbnail(post);
        const hasVideo = post.media_urls?.some(isVideoUrl);

        return (
          <button
            key={post.id}
            onClick={() => onPostClick?.(post)}
            className="relative aspect-square overflow-hidden rounded bg-white/5 hover:opacity-80 transition-opacity group"
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt="Post"
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-2">
                <p className="text-xs text-white/60 line-clamp-4">{post.text || 'Post'}</p>
              </div>
            )}

            {/* Video indicator */}
            {hasVideo && (
              <div className="absolute top-2 right-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                  <Play className="h-3 w-3 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Engagement overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <div className="flex items-center gap-1 text-white">
                <Heart className="h-4 w-4 fill-white" />
                <span className="text-sm font-semibold">{post.like_count}</span>
              </div>
              <div className="flex items-center gap-1 text-white">
                <MessageCircle className="h-4 w-4 fill-white" />
                <span className="text-sm font-semibold">{post.comment_count}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

