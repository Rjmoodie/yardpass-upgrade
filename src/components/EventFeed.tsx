import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share, Crown, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';

interface EventPostRow {
  id: string;
  text: string;
  media_urls: string[] | null;
  created_at: string;
  author_user_id: string;
  event_id: string;
  likes?: number;
  shares?: number;
  comments?: number;
  author?: { name: string | null; avatar: string | null };
  badge?: string | null;
  tier_name?: string | null;
}

interface EventTitleRow { id: string; title: string }

interface EventPost {
  id: string;
  text: string;
  media_urls: string[];
  created_at: string;
  author_user_id: string;
  event_id: string;
  like_count: number;
  comment_count: number;
  is_organizer: boolean;
  badge_label?: string | null;
  user_profiles: {
    display_name: string;
    photo_url?: string | null;
  };
  events: {
    title: string;
  };
}

interface EventFeedProps {
  eventId?: string;
  userId?: string;
  onEventClick?: (eventId: string) => void;
}

export function EventFeed({ eventId, userId, onEventClick }: EventFeedProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackClick, startViewTracking, stopViewTracking, trackVideoProgress } = useVideoAnalytics();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [posts, setPosts] = useState<EventPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  // Intersection observer for view tracking
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const postId = entry.target.getAttribute('data-post-id');
          const eventIdAttr = entry.target.getAttribute('data-event-id');
          if (!postId || !eventIdAttr) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            startViewTracking(postId, eventIdAttr);
          } else {
            stopViewTracking(postId, eventIdAttr);
          }
        });
      },
      { threshold: [0.25, 0.75] }
    );

    return () => observerRef.current?.disconnect();
  }, [startViewTracking, stopViewTracking]);

  const postRef = useCallback((node: HTMLDivElement) => {
    if (node) observerRef.current?.observe(node);
  }, []);

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, userId]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      // Build GET to Edge Function (uses auth header)
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = new URL(`${baseUrl}/functions/v1/posts-list`);
      if (eventId) url.searchParams.append('event_id', eventId);
      if (userId) url.searchParams.append('user_id', userId);
      url.searchParams.append('limit', '20');

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
      });

      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const payload = await res.json();
      const rows: EventPostRow[] = payload.items ?? payload.data ?? [];

      // fetch event titles for mapping
      const uniqueEventIds = [...new Set(rows.map((r) => r.event_id))].filter(Boolean);
      let titles: Record<string, string> = {};
      if (uniqueEventIds.length) {
        const { data: eventsRows, error } = await supabase
          .from('events')
          .select('id,title')
          .in('id', uniqueEventIds);

        if (!error && eventsRows) {
          titles = (eventsRows as EventTitleRow[]).reduce((acc, r) => {
            acc[r.id] = r.title;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const mapped: EventPost[] = rows.map((r) => ({
        id: r.id,
        text: r.text,
        media_urls: r.media_urls ?? [],
        created_at: r.created_at,
        author_user_id: r.author_user_id,
        event_id: r.event_id,
        like_count: r.likes ?? 0,
        comment_count: r.comments ?? 0,
        is_organizer: false,
        badge_label: r.badge ?? null,
        user_profiles: {
          display_name: r.author?.name ?? 'User',
          photo_url: r.author?.avatar ?? null,
        },
        events: { title: titles[r.event_id] ?? 'Event' },
      }));

      setPosts(mapped);

      // Prefetch user's likes
      if (user && mapped.length) {
        const { data: reactions } = await supabase
          .from('event_reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('kind', 'like')
          .in('post_id', mapped.map((p) => p.id));

        const likedSet = new Set((reactions ?? []).map((r) => r.post_id));
        setLikedPosts(likedSet);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to load posts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    const isLiked = likedPosts.has(postId);
    try {
      if (isLiked) {
        await supabase.from('event_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('kind', 'like');
        setLikedPosts((prev) => {
          const next = new Set(prev);
          next.delete(postId);
          return next;
        });
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: Math.max(0, p.like_count - 1) } : p)));
      } else {
        await supabase.from('event_reactions').insert({ post_id: postId, user_id: user.id, kind: 'like' });
        setLikedPosts((prev) => new Set([...prev, postId]));
        setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, like_count: p.like_count + 1 } : p)));
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to update like', variant: 'destructive' });
    }
  };

  const handleShare = (post: EventPost) => {
    trackClick({ post_id: post.id, event_id: post.event_id, target: 'share' });
    capture('feed_click', { target: 'share', event_id: post.event_id, post_id: post.id });
    if (navigator.share) {
      navigator
        .share({
          title: post.events.title,
          text: post.text,
          url: `${location.origin}/post/${post.id}`,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(`${location.origin}/post/${post.id}`).then(() =>
        toast({ title: 'Link copied' })
      );
    }
  };

  const handleComment = (post: EventPost) => {
    trackClick({ post_id: post.id, event_id: post.event_id, target: 'comment' });
    capture('feed_click', { target: 'comment', event_id: post.event_id, post_id: post.id });
    navigate(routes.post(post.id));
  };

  const handlePostMenu = (post: EventPost) => {
    console.log('Post menu', post.id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full" />
                  <div className="space-y-1">
                    <div className="w-24 h-4 bg-muted rounded" />
                    <div className="w-16 h-3 bg-muted rounded" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-4 bg-muted rounded" />
                  <div className="w-3/4 h-4 bg-muted rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No posts yet</p>
        <p className="text-sm">Be the first to share something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Card
          key={post.id}
          className="overflow-hidden group"
          ref={postRef}
          data-post-id={post.id}
          data-event-id={post.event_id}
        >
          <CardContent className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={post.user_profiles.photo_url || ''} />
                  <AvatarFallback>{post.user_profiles.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      className="font-medium hover:underline text-left"
                      onClick={() => capture('feed_click', { target: 'handle', event_id: post.event_id, post_id: post.id })}
                    >
                      {post.user_profiles.display_name}
                    </button>
                    {post.is_organizer && (
                      <Crown className="w-4 h-4 text-primary" aria-label="Organizer" />
                    )}
                    {post.badge_label && (
                      <Badge
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-secondary/80"
                        onClick={() => onEventClick?.(post.event_id)}
                      >
                        {post.badge_label}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleString()}
                    {' • '}
                    <button
                      onClick={() => onEventClick?.(post.event_id)}
                      className="hover:text-foreground hover:underline"
                    >
                      {post.events.title}
                    </button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handlePostMenu(post)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Text */}
            {post.text && <div className="text-sm leading-relaxed">{post.text}</div>}

            {/* Media */}
            {post.media_urls.length > 0 && (
              <div className="grid gap-2">
                {post.media_urls.map((url, idx) => {
                  const isMux = url.startsWith('mux:');
                  const isVideo = isMux || /\.(mp4|webm|mov)$/i.test(url);
                  return (
                    <div key={idx} className="relative rounded-lg overflow-hidden">
                      {isMux ? (
                        <video
                          src={`https://stream.mux.com/${url.replace('mux:', '')}.m3u8`}
                          controls
                          className="w-full max-h-80 object-cover"
                          playsInline
                          preload="metadata"
                          onLoadedData={(e) => {
                            const v = e.currentTarget;
                            const cleanup = trackVideoProgress(post.id, post.event_id, v);
                            v.addEventListener('unload', cleanup);
                          }}
                        />
                      ) : isVideo ? (
                        <video
                          src={url}
                          controls
                          className="w-full max-h-80 object-cover"
                          onLoadedData={(e) => {
                            const v = e.currentTarget;
                            const cleanup = trackVideoProgress(post.id, post.event_id, v);
                            v.addEventListener('unload', cleanup);
                          }}
                        />
                      ) : (
                        <img src={url} alt="Post media" className="w-full max-h-80 object-cover" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    capture('feed_click', { target: 'like', event_id: post.event_id, post_id: post.id });
                    handleLike(post.id);
                  }}
                  className={`gap-2 ${likedPosts.has(post.id) ? 'text-red-500' : ''}`}
                  aria-label={likedPosts.has(post.id) ? 'Unlike post' : 'Like post'}
                >
                  <Heart className={`w-4 h-4 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} />
                  {post.like_count}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={() => handleComment(post)}
                  aria-label="View comments"
                >
                  <MessageCircle className="w-4 h-4" />
                  {post.comment_count}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleShare(post)}
                className="gap-2"
                aria-label="Share post"
              >
                <Share className="w-4 h-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
