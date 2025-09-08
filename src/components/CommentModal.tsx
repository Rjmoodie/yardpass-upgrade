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
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';

interface CommentRow {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  user_profiles: { display_name: string | null; photo_url: string | null } | null;
}

interface PostRow {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[] | null;
  user_profiles: { display_name: string | null; photo_url: string | null } | null;
  ticket_tiers: { badge_label: string | null } | null;
}

interface Comment {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
}

interface Post {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[];
  author_name?: string | null;
  author_avatar?: string | null;
  author_badge?: string | null;
  comments: Comment[];
  likes_count: number;
  is_liked: boolean;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
}

export function CommentModal({ isOpen, onClose, eventId, eventTitle }: CommentModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) fetchPostsAndComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId]);

  const fetchPostsAndComments = async () => {
    setLoading(true);
    try {
      // Posts
      const { data: postRows, error: postsError } = await supabase
        .from('event_posts')
        .select(`
          id, text, author_user_id, created_at, media_urls,
          user_profiles!event_posts_author_user_id_fkey ( display_name, photo_url ),
          ticket_tiers!event_posts_ticket_tier_id_fkey ( badge_label )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      const ids = (postRows || []).map((p) => p.id);
      // Comments
      const { data: commentRows, error: commentsError } = await supabase
        .from('event_comments')
        .select(`
          id, text, author_user_id, created_at, post_id,
          user_profiles!event_comments_author_user_id_fkey ( display_name, photo_url )
        `)
        .in('post_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Likes for current user
      let likedSet = new Set<string>();
      if (user && ids.length) {
        const { data: myLikes } = await supabase
          .from('event_reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('kind', 'like')
          .in('post_id', ids);
        likedSet = new Set((myLikes ?? []).map((r) => r.post_id));
      }

      // Like counts - use the new counters from event_posts
      const { data: postsWithCounts } = await supabase
        .from('event_posts')
        .select('id, like_count, comment_count')
        .in('id', ids);

      const countsMap = (postsWithCounts ?? []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.id] = row.like_count ?? 0;
        return acc;
      }, {});

      const commentsByPost = (commentRows || []).reduce((acc: Record<string, Comment[]>, c: any) => {
        const list = acc[c.post_id] || [];
        list.push({
          id: c.id,
          text: c.text,
          author_user_id: c.author_user_id,
          created_at: c.created_at,
          author_name: c.user_profiles?.display_name ?? 'Anonymous',
          author_avatar: c.user_profiles?.photo_url ?? null,
        });
        acc[c.post_id] = list;
        return acc;
      }, {});

      const mapped: Post[] = (postRows as unknown as PostRow[]).map((p) => ({
        id: p.id,
        text: p.text,
        author_user_id: p.author_user_id,
        created_at: p.created_at,
        media_urls: p.media_urls ?? [],
        author_name: p.user_profiles?.display_name ?? 'Anonymous',
        author_avatar: p.user_profiles?.photo_url ?? null,
        author_badge: p.ticket_tiers?.badge_label ?? null,
        comments: commentsByPost[p.id] ?? [],
        likes_count: countsMap[p.id] ?? 0,
        is_liked: likedSet.has(p.id),
      }));

      setPosts(mapped);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to load comments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedPostId || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('event_comments').insert({
        post_id: selectedPostId,
        author_user_id: user.id,
        text: newComment.trim(),
      });

      if (error) throw error;

      setNewComment('');
      setSelectedPostId(null);
      await fetchPostsAndComments();
      toast({ title: 'Success', description: 'Comment added successfully!' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to add comment', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLikePost = async (postId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    try {
      if (post.is_liked) {
        await supabase.from('event_reactions').delete().eq('post_id', postId).eq('user_id', user.id).eq('kind', 'like');
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, is_liked: false, likes_count: Math.max(0, p.likes_count - 1) } : p
          )
        );
      } else {
        await supabase.from('event_reactions').insert({ post_id: postId, user_id: user.id, kind: 'like' });
        setPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, is_liked: true, likes_count: p.likes_count + 1 } : p))
        );
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to update like', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-background border shadow-xl">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Comments for {eventTitle}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
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
                    <AvatarImage src={post.author_avatar || undefined} />
                    <AvatarFallback className="text-xs">
                      {post.author_name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button 
                        onClick={() => navigate(routes.user(post.author_user_id))}
                        className="font-medium text-sm hover:text-primary transition-colors cursor-pointer"
                      >
                        {post.author_name}
                      </button>
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
                    onClick={() => toggleLikePost(post.id)}
                    className={`flex items-center gap-1 hover:text-foreground transition-colors ${post.is_liked ? 'text-red-500' : ''}`}
                  >
                    <Heart className={`w-3 h-3 ${post.is_liked ? 'fill-current' : ''}`} />
                    {post.likes_count}
                  </button>
                  <span>{post.comments.length} comments</span>
                </div>

                {/* Comments */}
                {post.comments.length > 0 && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    {post.comments.map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={comment.author_avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {comment.author_name?.charAt(0) || 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <button 
                              onClick={() => navigate(routes.user(comment.author_user_id))}
                              className="font-medium text-xs hover:text-primary transition-colors cursor-pointer"
                            >
                              {comment.author_name}
                            </button>
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
            <p className="text-sm text-center text-muted-foreground">Sign in to join the conversation</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
