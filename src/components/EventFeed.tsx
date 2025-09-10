import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share as ShareIcon, Crown, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import { muxToHls } from '@/utils/media';

/** Shape returned by posts-list Edge Function after mapping */
interface FeedPost {
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
  liked_by_me?: boolean;
  user_profiles: {
    display_name: string;
    photo_url?: string | null;
  };
  events: { title: string };
}

interface EventFeedProps {
  eventId?: string;
  userId?: string;
  onEventClick?: (eventId: string) => void;
  refreshTrigger?: number;
}

/** Video tile that reuses the shared HLS hook + analytics */
function VideoMedia({
  url,
  post,
  onAttachAnalytics,
}: {
  url: string;
  post: FeedPost;
  onAttachAnalytics?: (v: HTMLVideoElement) => VoidFunction | void;
}) {
  const src = useMemo(() => muxToHls(url), [url]);
  const { videoRef, ready } = useHlsVideo(src);
  const cleanupRef = useRef<VoidFunction | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ready) return;
    // Attach analytics once the element is ready
    cleanupRef.current?.();
    cleanupRef.current = (onAttachAnalytics?.(v) as VoidFunction) ?? null;
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, videoRef]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full max-h-80 object-cover"
      playsInline
      preload="metadata"
      muted
      aria-label={`Video in post by ${post.user_profiles.display_name}`}
    />
  );
}

export function EventFeed({ eventId, userId, onEventClick, refreshTrigger }: EventFeedProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackClick, startViewTracking, stopViewTracking, trackVideoProgress } = useVideoAnalytics();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const isMounted = useRef(true);

  const [posts, setPosts] = useState<FeedPost[]>([]);
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

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    isMounted.current = true;

    try {
      // Build GET to Edge Function (uses auth header)
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = new URL(`${baseUrl}/functions/v1/posts-list`);
      if (eventId) url.searchParams.append('event_id', eventId);
      if (userId) url.searchParams.append('user_id', userId);
      url.searchParams.append('limit', '20');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPosts([]);
        setLikedPosts(new Set());
        return;
      }

      const res = await fetch(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status} ${await res.text()}`);

      const payload = await res.json();
      const rows: any[] = payload.data ?? [];

      // fetch event titles if any are missing (defensive)
      const uniqueEventIds = [...new Set(rows.map((r) => r.event_id))].filter(Boolean);
      let titles: Record<string, string> = {};
      if (uniqueEventIds.length) {
        const { data: eventsRows } = await supabase.from('events').select('id,title').in('id', uniqueEventIds);
        titles = (eventsRows ?? []).reduce((acc: Record<string, string>, r: { id: string; title: string }) => {
          acc[r.id] = r.title;
          return acc;
        }, {});
      }

      const mapped: FeedPost[] = rows.map((r) => ({
        id: r.id,
        text: r.text,
        media_urls: r.media_urls ?? [],
        created_at: r.created_at,
        author_user_id: r.author_user_id,
        event_id: r.event_id,
        like_count: r.like_count ?? 0,
        comment_count: r.comment_count ?? 0,
        is_organizer: r.author_is_organizer ?? false,
        badge_label: r.author_badge_label ?? null,
        liked_by_me: r.liked_by_me ?? false,
        user_profiles: { display_name: r.author_name ?? 'User', photo_url: r.author_photo_url ?? null },
        events: { title: r.event_title ?? titles[r.event_id] ?? 'Event' },
      }));

      if (!isMounted.current) return;
      setPosts(mapped);

      // Prefetch user's likes
      if (user && mapped.length) {
        const { data: reactions } = await supabase
          .from('event_reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('kind', 'like')
          .in('post_id', mapped.map((p) => p.id));
        if (!isMounted.current) return;
        setLikedPosts(new Set((reactions ?? []).map((r) => r.post_id)));
      } else {
        setLikedPosts(new Set());
      }
    } catch (e: any) {
      console.error('❌ Error fetching posts:', e);
      if (isMounted.current) {
        toast({ title: 'Error Loading Posts', description: e.message || 'Failed to load posts. Please try again.', variant: 'destructive' });
        setPosts([]);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [eventId, userId, user]);

  useEffect(() => {
    fetchPosts();
    return () => { isMounted.current = false; };
  }, [fetchPosts, refreshTrigger]);

  // Global "postCreated" -> refresh with small delay
  useEffect(() => {
    const handlePostCreated = () => setTimeout(fetchPosts, 1000);
    window.addEventListener('postCreated', handlePostCreated);
    return () => window.removeEventListener('postCreated', handlePostCreated);
  }, [fetchPosts]);

  const retryFetch = useCallback(() => fetchPosts(), [fetchPosts]);

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }
    const isLiked = likedPosts.has(postId);
    try {
      if (isLiked) {
        await supabase.from('event_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('kind', 'like');
        setLikedPosts((prev) => { const next = new Set(prev); next.delete(postId); return next; });
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

  const handleShare = (post: FeedPost) => {
    trackClick({ post_id: post.id, event_id: post.event_id, target: 'share' });
    capture('feed_click', { target: 'share', event_id: post.event_id, post_id: post.id });
    const url = `${location.origin}/post/${post.id}`;
    if (navigator.share) {
      navigator.share({ title: post.events.title, text: post.text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast({ title: 'Link copied' }));
    }
  };

  const handleComment = (post: FeedPost) => {
    trackClick({ post_id: post.id, event_id: post.event_id, target: 'comment' });
    capture('feed_click', { target: 'comment', event_id: post.event_id, post_id: post.id });
    navigate(routes.post(post.id));
  };

  const handlePostMenu = (post: FeedPost) => {
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
        <Button variant="outline" size="sm" onClick={retryFetch} className="mt-4">
          Refresh
        </Button>
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
                      onClick={() => {
                        capture('feed_click', { target: 'handle', event_id: post.event_id, post_id: post.id });
                        navigate(routes.user(post.author_user_id));
                      }}
                    >
                      {post.user_profiles.display_name}
                    </button>
                    {post.badge_label && (
                      <Badge
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-secondary/80"
                        onClick={() => onEventClick?.(post.event_id)}
                      >
                        {post.badge_label}
                      </Badge>
                    )}
                    {post.is_organizer && <Crown className="w-4 h-4 text-primary" aria-label="Organizer" />}
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
            {!!post.media_urls.length && (
              <div className="grid gap-2">
                {post.media_urls.map((url, idx) => {
                  const isMux = url.startsWith('mux:');
                  const isVideo = isMux || /\.(mp4|webm|mov|m3u8)$/i.test(url);
                  return (
                    <div key={idx} className="relative rounded-lg overflow-hidden">
                      {isVideo ? (
                        <VideoMedia
                          url={isMux ? `mux:${url.replace('mux:', '')}` : url}
                          post={post}
                          onAttachAnalytics={(v) => trackVideoProgress(post.id, post.event_id, v)}
                        />
                      ) : (
                        // eslint-disable-next-line jsx-a11y/alt-text
                        <img src={url} alt="" className="w-full max-h-80 object-cover" />
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
                <ShareIcon className="w-4 h-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default EventFeed;