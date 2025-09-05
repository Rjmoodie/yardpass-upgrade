import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share, Crown, MoreVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { useShare } from '@/hooks/useShare';
import { formatDistanceToNow } from 'date-fns';
import { routes } from '@/lib/routes';
import { capture } from '@/lib/analytics';

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
  badge_label?: string;
  user_profiles: {
    display_name: string;
    photo_url?: string;
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
  const { sharePost } = useShare();
  const [posts, setPosts] = useState<EventPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchPosts();
  }, [eventId, userId]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      console.log('Fetching posts with params:', { eventId, userId });
      
      const url = new URL('https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/posts-list');
      if (eventId) url.searchParams.append('event_id', eventId);
      if (userId) url.searchParams.append('user_id', userId);
      url.searchParams.append('limit', '20');
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY'}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Posts fetch result:', result);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      setPosts(result.data || []);

      // Fetch user's likes if authenticated
      if (user && result.data?.length > 0) {
        const postIds = result.data.map((p: EventPost) => p.id);
        const { data: reactions } = await supabase
          .from('event_reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('kind', 'like')
          .in('post_id', postIds);

        const likedSet = new Set(reactions?.map(r => r.post_id) || []);
        setLikedPosts(likedSet);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like posts",
        variant: "destructive",
      });
      return;
    }

    const isLiked = likedPosts.has(postId);

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('event_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('kind', 'like');

        setLikedPosts(prev => {
          const newSet = new Set(prev);
          newSet.delete(postId);
          return newSet;
        });

        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, like_count: Math.max(0, post.like_count - 1) }
            : post
        ));
      } else {
        // Like
        await supabase
          .from('event_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            kind: 'like'
          });

        setLikedPosts(prev => new Set([...prev, postId]));

        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, like_count: post.like_count + 1 }
            : post
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like",
        variant: "destructive",
      });
    }
  };

  const handleShare = (post: EventPost) => {
    capture('feed_click', { 
      target: 'share', 
      event_id: post.event_id, 
      post_id: post.id 
    });
    sharePost(post.id, post.events.title, post.text);
  };

  const handleComment = (post: EventPost) => {
    capture('feed_click', { 
      target: 'comment', 
      event_id: post.event_id, 
      post_id: post.id 
    });
    navigate(routes.post(post.id));
  };

  const handlePostMenu = (post: EventPost) => {
    // TODO: Implement contextual menu (Report / Save / Copy Link)
    console.log('Post menu for:', post.id);
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

  if (posts.length === 0) {
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
        <Card key={post.id} className="overflow-hidden group">
          <CardContent className="p-4 space-y-4">
            {/* Post Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={post.user_profiles.photo_url || ''} />
                  <AvatarFallback>
                    {post.user_profiles.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="font-medium hover:underline text-left"
                      onClick={() => {
                        capture('feed_click', { target: 'handle', event_id: post.event_id, post_id: post.id });
                        // TODO: Navigate to user profile when we have usernames
                      }}
                    >
                      {post.user_profiles.display_name}
                    </button>
                    {post.is_organizer && (
                      <button
                        onClick={() => {
                          capture('feed_click', { target: 'organizer_badge', event_id: post.event_id });
                          // TODO: Navigate to org page when we have org slugs
                        }}
                        className="hover:opacity-80"
                        aria-label="Organizer badge"
                      >
                        <Crown className="w-4 h-4 text-primary" />
                      </button>
                    )}
                    {post.badge_label && (
                      <Badge 
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-secondary/80"
                        onClick={() => {
                          capture('feed_click', { target: 'badge', event_id: post.event_id });
                          onEventClick?.(post.event_id);
                        }}
                      >
                        {post.badge_label}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    {!eventId && (
                      <>
                        {' • '}
                        <button 
                          onClick={() => {
                            capture('feed_click', { target: 'title', event_id: post.event_id });
                            onEventClick?.(post.event_id);
                          }}
                          className="hover:text-foreground hover:underline"
                        >
                          {post.events.title}
                        </button>
                      </>
                    )}
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

            {/* Post Content */}
            {post.text && (
              <div className="text-sm leading-relaxed">
                {post.text}
              </div>
            )}

            {/* Media */}
            {post.media_urls.length > 0 && (
              <div className="grid gap-2">
                {post.media_urls.map((url, index) => {
                  // Check if it's a Mux video
                  const isMuxVideo = url.startsWith('mux:');
                  const isVideo = url.includes('video') || url.includes('.mp4') || url.includes('.webm');
                  
                  return (
                    <div key={index} className="relative rounded-lg overflow-hidden">
                      {isMuxVideo ? (
                        <video 
                          src={`https://stream.mux.com/${url.replace('mux:', '')}.m3u8`}
                          controls 
                          className="w-full max-h-80 object-cover"
                          playsInline
                        />
                      ) : isVideo ? (
                        <video 
                          src={url} 
                          controls 
                          className="w-full max-h-80 object-cover"
                        />
                      ) : (
                        <img 
                          src={url} 
                          alt="Post media" 
                          className="w-full max-h-80 object-cover"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Post Actions */}
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
                  <Heart 
                    className={`w-4 h-4 ${likedPosts.has(post.id) ? 'fill-current' : ''}`} 
                  />
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