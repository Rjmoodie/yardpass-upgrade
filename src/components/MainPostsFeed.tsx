import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share, Play, ArrowLeft, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { sharePayload } from '@/lib/share';
import { buildShareUrl, getShareTitle, getShareText } from '@/lib/shareLinks';

interface PostData {
  id: string;
  text: string;
  media_urls: string[];
  created_at: string;
  author_user_id: string;
  event_id: string;
  like_count: number;
  comment_count: number;
  author_name: string;
  author_photo_url?: string;
  author_badge_label?: string;
  author_is_organizer: boolean;
  event_title: string;
  liked_by_me: boolean;
}

interface MainPostsFeedProps {
  onEventSelect?: (eventId: string) => void;
}

export function MainPostsFeed({ onEventSelect }: MainPostsFeedProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchMainFeed = useCallback(async () => {
    if (!user) {
      console.log('👤 No user found, skipping main feed fetch');
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Fetching main posts feed for user:', user.id);
      
      // Build GET to Edge Function (fetch posts from events user is related to)
      const baseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const url = new URL(`${baseUrl}/functions/v1/posts-list`);
      url.searchParams.append('limit', '50'); // More posts for main feed
      console.log('📍 MainPostsFeed API call initiated');

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.warn('⚠️ No session found, skipping main feed fetch');
        setPosts([]);
        return;
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Main feed fetch failed:', res.status, errorText);
        throw new Error(`Failed to fetch main feed: ${res.status} ${errorText}`);
      }
      
      const payload = await res.json();
      console.log('📝 Main feed API response:', payload);
      
      const rows: PostData[] = payload.data ?? [];
      console.log('📋 Raw main feed data:', rows);

      // Update liked posts set
      const newLikedPosts = new Set<string>();
      rows.forEach(post => {
        if (post.liked_by_me) {
          newLikedPosts.add(post.id);
        }
      });
      setLikedPosts(newLikedPosts);
      
      setPosts(rows);
    } catch (error) {
      console.error('❌ Error fetching main feed:', error);
      toast({
        title: 'Error Loading Posts',
        description: 'Could not load posts. Please try again.',
        variant: 'destructive' 
      });
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    console.log('⚡ MainPostsFeed useEffect triggered with user:', user?.id);
    fetchMainFeed();
  }, [fetchMainFeed]);

  // Listen for global post creation events
  useEffect(() => {
    const handlePostCreated = (event: any) => {
      console.log('📢 Post created event received in MainPostsFeed, refreshing...', event.detail);
      setTimeout(() => {
        console.log('⏰ Executing delayed fetchMainFeed after post creation');
        fetchMainFeed();
      }, 1000);
    };

    window.addEventListener('postCreated', handlePostCreated);
    return () => window.removeEventListener('postCreated', handlePostCreated);
  }, [fetchMainFeed]);

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    const isLiked = likedPosts.has(postId);
    
    try {
      // Optimistic update
      const newLikedPosts = new Set(likedPosts);
      if (isLiked) {
        newLikedPosts.delete(postId);
      } else {
        newLikedPosts.add(postId);
      }
      setLikedPosts(newLikedPosts);

      // Update posts state
      setPosts(prev => 
        prev.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                liked_by_me: !isLiked,
                like_count: isLiked ? post.like_count - 1 : post.like_count + 1 
              }
            : post
        )
      );

      // Make API call
      const response = await supabase.functions.invoke('reactions-toggle', {
        body: { post_id: postId, kind: 'like' }
      });

      if (response.error) {
        throw response.error;
      }

    } catch (error) {
      console.error('❌ Error toggling like:', error);
      toast({ title: 'Error', description: 'Could not update like', variant: 'destructive' });
      
      // Revert optimistic update
      fetchMainFeed();
    }
  };

  const handleShare = async (post: PostData) => {
    try {
      await sharePayload({
        title: getShareTitle({ type: 'post', id: post.id, title: post.text, eventSlug: post.event_title }),
        text: getShareText({ type: 'post', id: post.id, title: post.text, eventSlug: post.event_title }),
        url: buildShareUrl({ type: 'post', id: post.id, title: post.text, eventSlug: post.event_title })
      });
      
      toast({ title: 'Shared!', description: 'Post shared successfully' });
    } catch (error) {
      console.error('❌ Error sharing post:', error);
      toast({ title: 'Error', description: 'Could not share post', variant: 'destructive' });
    }
  };

  const handleComment = (post: PostData) => {
    navigate(routes.post(post.id));
  };

  const retryFetch = useCallback(() => {
    console.log('🔄 Retrying main feed fetch...');
    fetchMainFeed();
  }, [fetchMainFeed]);

  if (!user) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Sign In Required</h1>
        <p className="text-muted-foreground mb-4">Please sign in to see your personalized feed.</p>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">No Posts Yet</h1>
        <p className="text-muted-foreground mb-4 text-center">
          Posts from events you're attending or organizing will appear here.
        </p>
        <Button onClick={retryFetch} variant="outline" className="mb-2">
          <RotateCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Button onClick={() => navigate('/')}>Browse Events</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            size="icon"
            className="min-h-[40px] min-w-[40px]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Your Feed</h1>
            <p className="text-sm text-muted-foreground">{posts.length} posts</p>
          </div>
          <div className="flex-1" />
          <Button onClick={retryFetch} variant="ghost" size="sm">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Post Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={post.author_photo_url} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                        {post.author_name?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{post.author_name}</span>
                        {post.author_badge_label && (
                          <Badge variant="secondary" className="text-xs">
                            {post.author_badge_label}
                          </Badge>
                        )}
                        {post.author_is_organizer && (
                          <Badge variant="outline" className="text-xs">HOST</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <button 
                          onClick={() => onEventSelect?.(post.event_id)}
                          className="hover:text-primary transition-colors"
                        >
                          {post.event_title}
                        </button>
                        <span>•</span>
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                {post.text && (
                  <div className="px-4 pb-3">
                    <p className="text-sm leading-relaxed">{post.text}</p>
                  </div>
                )}

                {/* Media Content */}
                {post.media_urls && post.media_urls.length > 0 && (
                  <div className="relative bg-black">
                    {post.media_urls.map((url, index) => {
                      const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('mux');
                      return (
                        <div key={index} className="relative">
                          {isVideo ? (
                            <div className="relative aspect-video">
                              <video
                                className="w-full h-full object-cover"
                                controls
                                poster={url.replace('.mp4', '.jpg')}
                              >
                                <source src={url} type="video/mp4" />
                              </video>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                <Play className="w-12 h-12 text-white/80" />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={url}
                              alt="Post media"
                              className="w-full aspect-auto object-cover max-h-96"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Post Actions */}
                <div className="p-4 pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleLike(post.id)}
                        className="flex items-center gap-2 text-sm hover:text-red-500 transition-colors"
                      >
                        <Heart className={`w-5 h-5 ${likedPosts.has(post.id) ? 'fill-red-500 text-red-500' : ''}`} />
                        <span>{post.like_count}</span>
                      </button>
                      <button
                        onClick={() => handleComment(post)}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>{post.comment_count}</span>
                      </button>
                    </div>
                    <button
                      onClick={() => handleShare(post)}
                      className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                    >
                      <Share className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}