import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share2, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Post {
  id: string;
  text: string;
  created_at: string;
  author_user_id: string;
  event_id: string;
  user_profiles?: {
    display_name: string;
    photo_url?: string;
  };
  events?: {
    title: string;
    cover_image_url?: string;
  };
}

interface PostFeedProps {
  eventId?: string;
  className?: string;
}

export function PostFeedSimple({ eventId, className = '' }: PostFeedProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);

  useEffect(() => {
    loadPosts();
  }, [eventId]);

  const loadPosts = async () => {
    try {
      let query = supabase
        .from('event_posts')
        .select(`
          id,
          text,
          created_at,
          author_user_id,
          event_id,
          user_profiles!event_posts_author_user_id_fkey (
            display_name,
            photo_url
          ),
          events!event_posts_event_id_fkey (
            title,
            cover_image_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (eventId) {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading posts:', error);
        toast({
          title: "Error",
          description: "Failed to load posts",
          variant: "destructive",
        });
      } else {
        setPosts(data || []);
      }
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!user || !newPost.trim()) return;

    // For simplicity, use the first available event or create a demo event
    let targetEventId = eventId;
    
    if (!targetEventId) {
      // Get first available event
      const { data: events } = await supabase
        .from('events')
        .select('id')
        .limit(1);
      
      if (events && events.length > 0) {
        targetEventId = events[0].id;
      } else {
        toast({
          title: "Error",
          description: "No events available to post to",
          variant: "destructive",
        });
        return;
      }
    }

    setPosting(true);
    try {
      const { error } = await supabase
        .from('event_posts')
        .insert({
          text: newPost.trim(),
          author_user_id: user.id,
          event_id: targetEventId,
        });

      if (error) {
        console.error('Error creating post:', error);
        toast({
          title: "Error",
          description: "Failed to create post",
          variant: "destructive",
        });
      } else {
        setNewPost('');
        setShowCreatePost(false);
        loadPosts(); // Reload posts
        toast({
          title: "Success",
          description: "Post created successfully",
        });
      }
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive",
      });
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {user && (
        <Card>
          <CardContent className="p-4">
            {showCreatePost ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="What's happening at your event?"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  className="min-h-[100px]"
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreatePost(false)}
                    disabled={posting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={createPost}
                    disabled={posting || !newPost.trim()}
                  >
                    {posting ? 'Posting...' : 'Post'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button 
                onClick={() => setShowCreatePost(true)}
                variant="outline"
                className="w-full justify-start"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create a post...
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {posts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No posts yet</p>
          <p className="text-sm">Be the first to share something!</p>
        </div>
      ) : (
        posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarFallback>
                    {post.user_profiles?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">
                      {post.user_profiles?.display_name || 'Anonymous'}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {post.events?.title && (
                    <div className="text-sm text-muted-foreground mb-2">
                      in {post.events.title}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed mb-3">{post.text}</p>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Heart className="w-4 h-4 mr-1" />
                      <span className="text-xs">Like</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      <span className="text-xs">Comment</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2">
                      <Share2 className="w-4 h-4 mr-1" />
                      <span className="text-xs">Share</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export default PostFeedSimple;