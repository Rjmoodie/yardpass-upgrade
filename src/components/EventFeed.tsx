import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share as ShareIcon, Crown, MoreVertical, Volume2, VolumeX, Bookmark, Instagram, Twitter, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';
import { useHlsVideo } from '@/hooks/useHlsVideo';
import { useOptimisticReactions } from '@/hooks/useOptimisticReactions';
import { useRealtimeEngagement } from '@/hooks/useRealtimeEngagement';
import { useRealtimeComments } from '@/hooks/useRealtimeComments';
import { muxToHls, muxToPoster, isLikelyVideo } from '@/utils/media';
import CommentModal from '@/components/CommentModal';

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
    username?: string | null;
    instagram_handle?: string | null;
    twitter_handle?: string | null;
    website_url?: string | null;
  };
  events: { 
    title: string;
    organizer_name?: string;
    organizer_instagram?: string;
    organizer_twitter?: string;
    organizer_website?: string;
  };
}

interface EventFeedProps {
  eventId?: string;
  userId?: string;
  onEventClick?: (eventId: string) => void;
  refreshTrigger?: number;
}

/** Video tile with sound controls */
function VideoMedia({
  url,
  post,
  onAttachAnalytics,
}: {
  url: string;
  post: FeedPost;
  onAttachAnalytics?: (v: HTMLVideoElement) => VoidFunction | void;
}) {
  const [muted, setMuted] = useState(true);
  const src = useMemo(() => muxToHls(url), [url]);
  const { videoRef, ready } = useHlsVideo(src);
  const cleanupRef = useRef<VoidFunction | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !ready) return;
    v.muted = muted;

    cleanupRef.current?.();
    cleanupRef.current = (onAttachAnalytics?.(v) as VoidFunction) ?? null;
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, videoRef, muted]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const newMuted = !muted;
    setMuted(newMuted);
    v.muted = newMuted;
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        controls
        className="w-full max-h-80 object-cover rounded-lg"
        playsInline
        preload="metadata"
        muted={muted}
        aria-label={`Video in post by ${post.user_profiles.display_name}`}
      />
      <div className="absolute top-2 right-2 flex flex-col gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full"
          aria-label="Bookmark post"
        >
          <Bookmark className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function EventFeed({ eventId, userId, onEventClick, refreshTrigger }: EventFeedProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trackClick, startViewTracking, stopViewTracking, trackVideoProgress } = useVideoAnalytics();
  const { toggleLike } = useOptimisticReactions();

  // 💬 Comment modal state (fix redirect issue)
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentPostId, setCommentPostId] = useState<string>();
  const [commentEventId, setCommentEventId] = useState<string>();
  const [commentEventTitle, setCommentEventTitle] = useState<string>();

  const observerRef = useRef<IntersectionObserver | null>(null);
  const isMounted = useRef(true);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Record<string, any[]>>({});

  // Pause/mute all videos when modal opens; restore current on close
  useEffect(() => {
    if (!showCommentModal) return;
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    const states = videos.map(v => ({ v, paused: v.paused, muted: v.muted }));
    videos.forEach(v => { try { v.pause(); } catch {} v.muted = true; });

    return () => {
      // restore only mute states; keep paused unless user interacts
      states.forEach(({ v, muted }) => { v.muted = muted; });
    };
  }, [showCommentModal]);

  // Realtime engagement
  const currentEventIds = eventId ? [eventId] : posts.map(p => p.event_id).filter(Boolean);
  const handleEngagementUpdate = useCallback((update: any) => {
    setPosts(prev => prev.map(post =>
      post.id === update.postId
        ? {
            ...post,
            like_count: update.likeCount,
            comment_count: update.commentCount,
            liked_by_me: update.viewerHasLiked
          }
        : post
    ));
  }, []);
  useRealtimeEngagement({ eventIds: currentEventIds, userId: user?.id, onEngagementUpdate: handleEngagementUpdate });

  // Realtime comments now handled by CommentModal via callback
  // This prevents double-counting of comments

  // Intersection observer for view analytics
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
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = new URL(`${baseUrl}/functions/v1/posts-list`);
      if (eventId) url.searchParams.append('event_id', eventId);
      if (userId) url.searchParams.append('user_id', userId);
      url.searchParams.append('limit', '50');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setPosts([]);
        setComments({});
        return;
      }

      const res = await fetch(url.toString(), { method: 'GET', headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status} ${await res.text()}`);

      const payload = await res.json();
      const rows: any[] = payload.data ?? [];

      // Defensive: backfill missing event titles
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
        text: r.text || '',
        media_urls: (r.media_urls ?? []).filter(Boolean),
        created_at: r.created_at,
        author_user_id: r.author_user_id,
        event_id: r.event_id,
        like_count: r.like_count ?? 0,
        comment_count: r.comment_count ?? 0,
        is_organizer: r.author_is_organizer ?? r.is_organizer ?? false,
        badge_label: r.badge_label ?? r.author_badge_label ?? null,
        liked_by_me: r.liked_by_me ?? false,
        user_profiles: { 
          display_name: r.author_name ?? r.author_display_name ?? 'User', 
          photo_url: r.author_photo_url ?? null,
          username: r.author_username ?? null,
          instagram_handle: r.author_instagram ?? null,
          twitter_handle: r.author_twitter ?? null,
          website_url: r.author_website ?? null,
        },
        events: { 
          title: r.event_title ?? titles[r.event_id] ?? 'Event',
          organizer_name: r.organizer_name ?? null,
          organizer_instagram: r.organizer_instagram ?? null,
          organizer_twitter: r.organizer_twitter ?? null,
          organizer_website: r.organizer_website ?? null,
        },
      }));

      // Comments preview (first few) — keep lightweight
      if (mapped.length) {
        const { data: commentsData } = await supabase
          .from('event_comments')
          .select(`
            id, text, created_at, author_user_id, post_id,
            user_profiles!event_comments_author_user_id_fkey (
              display_name, photo_url
            )
          `)
          .in('post_id', mapped.map(p => p.id))
          .order('created_at', { ascending: true });

        const commentsByPost = (commentsData ?? []).reduce((acc: Record<string, any[]>, comment: any) => {
          const postId = comment.post_id;
          if (!acc[postId]) acc[postId] = [];
          acc[postId].push(comment);
          return acc;
        }, {});

        if (!isMounted.current) return;
        setComments(commentsByPost);
      }

      if (!isMounted.current) return;
      setPosts(mapped);
    } catch (e: any) {
      console.error('❌ Error fetching posts:', e);
      if (isMounted.current) {
        toast({ title: 'Error Loading Posts', description: e.message || 'Failed to load posts. Please try again.', variant: 'destructive' });
        setPosts([]);
        setComments({});
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [eventId, userId]);

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
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    await toggleLike(postId, post.liked_by_me ?? false, post.like_count);
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

  // ✅ FIX: Pure modal open (no navigate)
  const handleComment = (post: FeedPost) => {
    console.log('🔥 EventFeed: Opening comment modal for post', { 
      postId: post.id, 
      eventId: post.event_id, 
      eventTitle: post.events.title 
    });
    trackClick({ post_id: post.id, event_id: post.event_id, target: 'comment' });
    capture('feed_click', { target: 'comment', event_id: post.event_id, post_id: post.id });
    setCommentPostId(post.id);
    setCommentEventId(post.event_id);
    setCommentEventTitle(post.events.title || 'Event');
    setShowCommentModal(true);
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
    <>
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
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={post.user_profiles.photo_url || ''} />
                    <AvatarFallback>{post.user_profiles.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        className="font-medium hover:underline text-left"
                        onClick={() => {
                          capture('feed_click', { target: 'handle', event_id: post.event_id, post_id: post.id });
                          navigate(routes.user(post.author_user_id));
                        }}
                      >
                        {post.user_profiles.display_name}
                      </button>
                      {post.user_profiles.username && (
                        <span className="text-sm text-muted-foreground">
                          @{post.user_profiles.username}
                        </span>
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
                      {post.is_organizer && <Crown className="w-4 h-4 text-primary" aria-label="Organizer" />}
                    </div>

                    {/* Meta & Event link */}
                    <div className="flex items-center gap-2 mt-1">
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

                      {/* Author Social Links */}
                      <div className="flex items-center gap-1">
                        {post.user_profiles.instagram_handle && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 p-0 text-muted-foreground hover:text-pink-500"
                            onClick={() => window.open(`https://instagram.com/${post.user_profiles.instagram_handle}`, '_blank')}
                            aria-label="Instagram"
                          >
                            <Instagram className="w-3 h-3" />
                          </Button>
                        )}
                        {post.user_profiles.twitter_handle && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 p-0 text-muted-foreground hover:text-blue-500"
                            onClick={() => window.open(`https://twitter.com/${post.user_profiles.twitter_handle}`, '_blank')}
                            aria-label="Twitter"
                          >
                            <Twitter className="w-3 h-3" />
                          </Button>
                        )}
                        {post.user_profiles.website_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => window.open(post.user_profiles.website_url!, '_blank')}
                            aria-label="Website"
                          >
                            <Globe className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Organizer Socials (if organizer) */}
                    {post.is_organizer && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">Organizer:</span>
                        {post.events.organizer_instagram && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 p-0 text-muted-foreground hover:text-pink-500"
                            onClick={() => window.open(`https://instagram.com/${post.events.organizer_instagram}`, '_blank')}
                            aria-label="Organizer Instagram"
                          >
                            <Instagram className="w-3 h-3" />
                          </Button>
                        )}
                        {post.events.organizer_twitter && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 p-0 text-muted-foreground hover:text-blue-500"
                            onClick={() => window.open(`https://twitter.com/${post.events.organizer_twitter}`, '_blank')}
                            aria-label="Organizer Twitter"
                          >
                            <Twitter className="w-3 h-3" />
                          </Button>
                        )}
                        {post.events.organizer_website && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-5 h-5 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => window.open(post.events.organizer_website!, '_blank')}
                            aria-label="Organizer Website"
                          >
                            <Globe className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
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
                    const isVideo = isLikelyVideo(url);

                    return (
                      <div key={idx} className="relative rounded-lg overflow-hidden">
                          {isVideo ? (
                           <VideoMedia
                             url={url}
                             post={post}
                             onAttachAnalytics={(v) => trackVideoProgress(post.id, post.event_id, v)}
                           />
                        ) : (
                          <div className="relative">
                            <img
                              src={url.startsWith('mux:') ? muxToPoster(url) : url}
                              alt={`Media from ${post.user_profiles.display_name}`}
                              className="w-full max-h-80 object-cover rounded-lg"
                              loading="lazy"
                              decoding="async"
                              onError={(e) => {
                                console.warn('Failed to load image:', url);
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute top-2 right-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="bg-black/50 hover:bg-black/70 text-white backdrop-blur-sm rounded-full"
                                aria-label="Bookmark post"
                              >
                                <Bookmark className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comments preview */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                {comments[post.id] && comments[post.id].length > 0 ? (
                  <>
                    <h4 className="text-sm font-medium">Comments ({post.comment_count})</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {comments[post.id].slice(0, 3).map((comment: any) => (
                        <div key={comment.id} className="flex gap-2 text-sm">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={comment.user_profiles?.photo_url || ''} />
                            <AvatarFallback className="text-xs">
                              {comment.user_profiles?.display_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium text-xs">
                              {comment.user_profiles?.display_name || 'User'}:
                            </span>
                            <span className="ml-1">{comment.text}</span>
                          </div>
                        </div>
                      ))}
                      {post.comment_count > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleComment(post)}
                          className="text-xs text-muted-foreground"
                        >
                          View all {post.comment_count} comments
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    No comments yet. Be the first to comment!
                  </div>
                )}

                {/* Quick comment CTA for authenticated users */}
                {user && (
                  <div className="flex gap-2 mt-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={user.user_metadata?.photo_url || ''} />
                      <AvatarFallback className="text-xs">
                        {user.user_metadata?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleComment(post)}
                      className="flex-1 text-left text-xs text-muted-foreground"
                    >
                      Add a comment...
                    </Button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      capture('feed_click', { target: 'like', event_id: post.event_id, post_id: post.id });
                      handleLike(post.id);
                    }}
                    className={`gap-2 ${post.liked_by_me ? 'text-red-500' : ''}`}
                    aria-label={post.liked_by_me ? 'Unlike post' : 'Like post'}
                  >
                    <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-current' : ''}`} />
                    {post.like_count}
                  </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleComment(post);
                  }}
                  aria-label="View comments"
                >
                  <MessageCircle className="w-4 h-4" />
                  {post.comment_count}
                </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleShare(post);
                  }}
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

      {/* 💬 Inline Comment Modal (no route change) */}
      {showCommentModal && commentPostId && commentEventId && (
        <CommentModal
          isOpen={showCommentModal}
          onClose={() => {
            setShowCommentModal(false);
            setCommentPostId(undefined);
            setCommentEventId(undefined);
            setCommentEventTitle(undefined);
          }}
          eventId={commentEventId!}
          eventTitle={commentEventTitle || 'Event'}
          postId={commentPostId}
          onCommentCountChange={(postId, newCount) => {
            setPosts(prev => prev.map(p => 
              p.id === postId ? { ...p, comment_count: newCount } : p
            ));
          }}
        />
      )}
    </>
  );
}

export default EventFeed;
