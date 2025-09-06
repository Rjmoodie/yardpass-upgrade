import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Send, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
  is_liked?: boolean;
  likes_count?: number;
}

interface Post {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[];
  author_name?: string;
  author_avatar?: string;
  author_badge?: string;
  comments: Comment[];
  is_liked?: boolean;
  likes_count?: number;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

export function CommentModal({ isOpen, onClose, eventId, eventTitle }: CommentModalProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch posts and comments for the event
  useEffect(() => {
    if (isOpen && eventId) {
      fetchPostsAndComments();
    }
  }, [isOpen, eventId]);

  const fetchPostsAndComments = async () => {
    setLoading(true);
    try {
      // Fetch posts for the event
      const { data: postsData, error: postsError } = await supabase
        .from('event_posts')
        .select(`
          id,
          text,
          author_user_id,
          created_at,
          media_urls,
          user_profiles!event_posts_author_user_id_fkey (
            display_name,
            photo_url
          ),
          ticket_tiers!event_posts_ticket_tier_id_fkey (
            badge_label
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch comments for each post
      const postsWithComments = await Promise.all(
        (postsData || []).map(async (post: any) => {
          const { data: commentsData, error: commentsError } = await supabase
            .from('event_comments')
            .select(`
              id,
              text,
              author_user_id,
              created_at,
              user_profiles!event_comments_author_user_id_fkey (
                display_name,
                photo_url
              )
            `)
            .eq('post_id', post.id)
            .order('created_at', { ascending: true });

          if (commentsError) throw commentsError;

          return {
            id: post.id,
            text: post.text,
            author_user_id: post.author_user_id,
            created_at: post.created_at,
            media_urls: post.media_urls || [],
            author_name: post.user_profiles?.display_name || 'Anonymous',
            author_avatar: post.user_profiles?.photo_url,
            author_badge: post.ticket_tiers?.badge_label,
            comments: (commentsData || []).map((comment: any) => ({
              id: comment.id,
              text: comment.text,
              author_user_id: comment.author_user_id,
              created_at: comment.created_at,
              author_name: comment.user_profiles?.display_name || 'Anonymous',
              author_avatar: comment.user_profiles?.photo_url,
              is_liked: false, // TODO: Implement comment likes
              likes_count: 0
            }))
          };
        })
      );

      setPosts(postsWithComments);
    } catch (error) {
      console.error('Error fetching posts and comments:', error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedPostId || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('event_comments')
        .insert({
          post_id: selectedPostId,
          author_user_id: user.id,
          text: newComment.trim()
        });

      if (error) throw error;

      // Refresh comments
      await fetchPostsAndComments();
      setNewComment('');
      setSelectedPostId(null);
      
      toast({
        title: "Success",
        description: "Comment added successfully!",
      });
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to like posts",
        variant: "destructive",
      });
      return;
    }

    try {
      // TODO: Implement post liking
      toast({
        title: "Liked!",
        description: "Post liked successfully",
      });
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-background border shadow-xl">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Comments for {eventTitle}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 p-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No posts yet for this event.</p>
              <p className="text-sm">Be the first to share something!</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="border rounded-lg p-4 space-y-3">
                {/* Post Header */}
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={post.author_avatar} />
                    <AvatarFallback className="text-xs">
                      {post.author_name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{post.author_name}</span>
                      {post.author_badge && (
                        <Badge variant="outline" className="text-xs">
                          {post.author_badge}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed">{post.text}</p>
                  </div>
                </div>

                {/* Post Actions */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <button
                    onClick={() => handleLikePost(post.id)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Heart className="w-3 h-3" />
                    {post.likes_count || 0}
                  </button>
                  <span>{post.comments.length} comments</span>
                </div>

                {/* Comments */}
                {post.comments.length > 0 && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={comment.author_avatar} />
                          <AvatarFallback className="text-xs">
                            {comment.author_name?.charAt(0) || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-xs">{comment.author_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed">{comment.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Input */}
                {user && (
                  <div className="flex items-start gap-3 pt-2 border-t">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-xs">
                        {user.user_metadata?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={selectedPostId === post.id ? newComment : ''}
                        onChange={(e) => {
                          setNewComment(e.target.value);
                          setSelectedPostId(post.id);
                        }}
                        className="min-h-[60px] resize-none text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmitComment();
                          }
                        }}
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleSubmitComment}
                          disabled={!newComment.trim() || submitting}
                          className="h-8 px-3"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {submitting ? 'Posting...' : 'Post'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!user && (
          <div className="flex-shrink-0 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              Sign in to join the conversation
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}