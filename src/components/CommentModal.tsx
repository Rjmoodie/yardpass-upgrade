import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Send, X, Play, ExternalLink, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { routes } from '@/lib/routes';
import { ReportButton } from '@/components/ReportButton';

const PAGE_SIZE = 10; // used only in multi-post mode

interface CommentRow {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  post_id: string;
}

interface PostRow {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;
  ticket_tier_id: string | null;
}

interface Comment {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  author_name?: string | null;
  author_avatar?: string | null;
  likes_count: number;
  is_liked: boolean;
}

interface Post {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[];
  author_name?: string | null;
  author_avatar?: string | null;
  author_badge?: string | null;     // ticket tier label
  author_is_organizer?: boolean;    // reserved for future
  comments: Comment[];
  likes_count: number;
  is_liked: boolean;
}

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  /** If provided, the modal locks to this single post (no other posts, no pagination) */
  postId?: string;
}

export default function CommentModal({ isOpen, onClose, eventId, eventTitle, postId }: CommentModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // pagination (used only in multi-post mode)
  const [pageFrom, setPageFrom] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const singleMode = !!postId; // 🔒 when true, we only show the clicked post

  // derived: ids of loaded posts for realtime filter
  const postIdSet = useMemo(() => new Set(posts.map((p) => p.id)), [posts]);

  // reset & load when opened
  useEffect(() => {
    if (!isOpen) return;
    setPosts([]);
    setPageFrom(0);
    setHasMore(!singleMode);
    setSelectedPostId(postId ?? null);
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId, postId]);

  // --- Realtime: only subscribe to the target (post or event) ---
  useEffect(() => {
    if (!isOpen) return;

    // Prefer row-level filter when we know the postId to reduce traffic
    const channel = supabase
      .channel(`comments-${singleMode ? postId : eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_comments',
          ...(singleMode ? { filter: `post_id=eq.${postId}` } : {}), // ✅ only this post in single-mode
        },
        (payload) => {
          const c = payload.new as CommentRow;
          // If multi-mode: ensure we only append to posts we loaded
          if (!singleMode && !postIdSet.has(c.post_id)) return;

          setPosts((prev) =>
            prev.map((p) =>
              p.id === c.post_id
                ? {
                    ...p,
                    comments: [
                      ...p.comments,
                      {
                        id: c.id,
                        text: c.text,
                        author_user_id: c.author_user_id,
                        created_at: c.created_at,
                        author_name: 'Anonymous', // could be enriched via another fetch if needed
                        author_avatar: null,
                        likes_count: 0,
                        is_liked: false,
                      },
                    ],
                  }
                : p
            )
          );
        }
      );

    channel.subscribe();
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [isOpen, eventId, singleMode, postId, postIdSet]);

  // Load posts (+ comments, likes, profiles). In singleMode we load only that one post.
  const loadPage = async (reset = false) => {
    if (loading) return;
    setLoading(true);

    try {
      const from = reset ? 0 : pageFrom;
      const to = from + PAGE_SIZE - 1;

      // 1) Fetch posts
      let postQuery = supabase
        .from('event_posts')
        .select('id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id');

      if (singleMode && postId) {
        postQuery = postQuery.eq('id', postId); // ✅ just this post
      } else {
        postQuery = postQuery.eq('event_id', eventId).order('created_at', { ascending: false }).range(from, to);
      }

      const { data: postRows, error: postsError } = await postQuery;
      if (postsError) throw postsError;

      const postIds = (postRows || []).map((p) => p.id);
      setHasMore(!singleMode && (postRows || []).length === PAGE_SIZE); // no load more in single-mode

      // 2) Profiles for post authors
      const authorIds = [...new Set((postRows || []).map((p) => p.author_user_id))];
      let authorProfiles: Record<string, any> = {};
      if (authorIds.length) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', authorIds);

        authorProfiles = (profiles || []).reduce((acc: Record<string, any>, p: any) => {
          acc[p.user_id] = p;
          return acc;
        }, {});
      }

      // 3) Ticket tiers for badges
      const tierIds = [...new Set((postRows || []).map((p) => p.ticket_tier_id).filter(Boolean))];
      let ticketTiers: Record<string, any> = {};
      if (tierIds.length) {
        const { data: tiers } = await supabase
          .from('ticket_tiers')
          .select('id, badge_label')
          .in('id', tierIds as string[]);

        ticketTiers = (tiers || []).reduce((acc: Record<string, any>, t: any) => {
          acc[t.id] = t;
          return acc;
        }, {});
      }

      // 4) Comments for these posts
      const { data: commentRows, error: commentsError } = await supabase
        .from('event_comments')
        .select('id, text, author_user_id, created_at, post_id')
        .in('post_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // 5) Profiles for comment authors
      const commentAuthorIds = [...new Set((commentRows || []).map((c) => c.author_user_id))];
      let commentAuthorProfiles: Record<string, any> = {};
      if (commentAuthorIds.length) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', commentAuthorIds);

        commentAuthorProfiles = (profiles || []).reduce((acc: Record<string, any>, p: any) => {
          acc[p.user_id] = p;
          return acc;
        }, {});
      }

      const commentIds = (commentRows || []).map((c) => c.id);

      // 6) Current user's likes for these posts
      let likedPostSet = new Set<string>();
      if (user && postIds.length) {
        const { data: myLikes } = await supabase
          .from('event_reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('kind', 'like')
          .in('post_id', postIds);

        likedPostSet = new Set((myLikes ?? []).map((r: any) => r.post_id));
      }

      // 7) Comment like counts & which comments the user liked
      let commentLikeCounts: Record<string, number> = {};
      let likedCommentSet = new Set<string>();
      if (commentIds.length) {
        const { data: allCR } = await supabase
          .from('event_comment_reactions')
          .select('comment_id')
          .in('comment_id', commentIds);

        commentLikeCounts = (allCR ?? []).reduce((acc: Record<string, number>, r: any) => {
          acc[r.comment_id] = (acc[r.comment_id] || 0) + 1;
          return acc;
        }, {});

        if (user) {
          const { data: myCR } = await supabase
            .from('event_comment_reactions')
            .select('comment_id')
            .eq('user_id', user.id)
            .in('comment_id', commentIds);
          likedCommentSet = new Set((myCR ?? []).map((r: any) => r.comment_id));
        }
      }

      const commentsByPost = (commentRows || []).reduce((acc: Record<string, Comment[]>, c: any) => {
        const list = acc[c.post_id] || [];
        list.push({
          id: c.id,
          text: c.text,
          author_user_id: c.author_user_id,
          created_at: c.created_at,
          author_name: commentAuthorProfiles[c.author_user_id]?.display_name ?? 'Anonymous',
          author_avatar: commentAuthorProfiles[c.author_user_id]?.photo_url ?? null,
          likes_count: commentLikeCounts[c.id] ?? 0,
          is_liked: likedCommentSet.has(c.id),
        });
        acc[c.post_id] = list;
        return acc;
      }, {});

      const mapped = (postRows as PostRow[]).map<Post>((p) => ({
        id: p.id,
        text: p.text,
        author_user_id: p.author_user_id,
        created_at: p.created_at,
        media_urls: p.media_urls ?? [],
        author_name: authorProfiles[p.author_user_id]?.display_name ?? 'Anonymous',
        author_avatar: authorProfiles[p.author_user_id]?.photo_url ?? null,
        author_badge: p.ticket_tier_id ? (ticketTiers[p.ticket_tier_id]?.badge_label ?? null) : null,
        author_is_organizer: false,
        comments: commentsByPost[p.id] ?? [],
        likes_count: p.like_count ?? 0,
        is_liked: likedPostSet.has(p.id),
      }));

      // 🛡️ enforce single-post mode
      const finalMapped = singleMode && postId
        ? mapped.filter(p => p.id === postId)
        : mapped;

      setPosts((prev) => (reset ? finalMapped : [...prev, ...finalMapped]));

      // In single-mode, auto-select this post for the composer
      if (singleMode && finalMapped[0]?.id) setSelectedPostId(finalMapped[0].id);

      if (!singleMode) setPageFrom(to + 1);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to load comments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedPostId) return;
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to comment', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('event_comments').insert({
        post_id: selectedPostId,
        author_user_id: user.id,
        text: newComment.trim(),
      });
      if (error) throw error;

      // optimistic append
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPostId
            ? {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    id: `temp-${Date.now()}`,
                    text: newComment.trim(),
                    author_user_id: user.id,
                    created_at: new Date().toISOString(),
                    author_name: (user.user_metadata?.display_name as string) || 'You',
                    author_avatar: null,
                    likes_count: 0,
                    is_liked: false,
                  },
                ],
              }
            : p
        )
      );

      setNewComment('');
      // In single-mode, keep the selection on this post
      if (!singleMode) setSelectedPostId(null);

      toast({ title: 'Success', description: 'Comment added successfully!' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to add comment', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLikePost = async (postIdToToggle: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like posts', variant: 'destructive' });
      return;
    }

    const post = posts.find((p) => p.id === postIdToToggle);
    if (!post) return;

    const optimistic = !post.is_liked;

    // optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postIdToToggle ? { ...p, is_liked: optimistic, likes_count: p.likes_count + (optimistic ? 1 : -1) } : p
      )
    );

    try {
      if (optimistic) {
        const { error } = await supabase
          .from('event_reactions')
          .insert({ post_id: postIdToToggle, user_id: user.id, kind: 'like' });
        if (error && (error as any).code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('event_reactions')
          .delete()
          .eq('post_id', postIdToToggle)
          .eq('user_id', user.id)
          .eq('kind', 'like');
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      // rollback
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postIdToToggle
            ? { ...p, is_liked: !optimistic, likes_count: p.likes_count + (optimistic ? -1 : 1) }
            : p
        )
      );
      toast({ title: 'Error', description: 'Failed to update like', variant: 'destructive' });
    }
  };

  const toggleLikeComment = async (commentId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like comments', variant: 'destructive' });
      return;
    }

    // find current state
    let isLiked = false;
    for (const p of posts) {
      const c = p.comments.find((cc) => cc.id === commentId);
      if (c) {
        isLiked = c.is_liked;
        break;
      }
    }

    const optimistic = !isLiked;

    // optimistic
    setPosts((prev) =>
      prev.map((p) => ({
        ...p,
        comments: p.comments.map((c) =>
          c.id === commentId ? { ...c, is_liked: optimistic, likes_count: Math.max(0, c.likes_count + (optimistic ? 1 : -1)) } : c
        ),
      }))
    );

    try {
      if (optimistic) {
        const { error } = await supabase
          .from('event_comment_reactions')
          .insert({ comment_id: commentId, user_id: user.id, kind: 'like' });
        if (error && (error as any).code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('event_comment_reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id)
          .eq('kind', 'like');
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      // rollback
      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          comments: p.comments.map((c) =>
            c.id === commentId
              ? { ...c, is_liked: !optimistic, likes_count: Math.max(0, c.likes_count + (optimistic ? -1 : 1)) }
              : c
          ),
        }))
      );
      toast({ title: 'Error', description: 'Failed to update like', variant: 'destructive' });
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to delete comments', variant: 'destructive' });
      return;
    }

    // find author
    let authorId: string | null = null;
    for (const p of posts) {
      const c = p.comments.find((cc) => cc.id === commentId);
      if (c) {
        authorId = c.author_user_id;
        break;
      }
    }

    if (!authorId) return;
    if (authorId !== user.id) {
      toast({ title: 'Not allowed', description: 'You can only delete your own comments.', variant: 'destructive' });
      return;
    }

    const snapshot = posts;
    setPosts((prev) => prev.map((p) => ({ ...p, comments: p.comments.filter((c) => c.id !== commentId) })));

    try {
      const { error } = await supabase.from('event_comments').delete().eq('id', commentId).eq('author_user_id', user.id);
      if (error) throw error;

      toast({ title: 'Deleted', description: 'Your comment was removed.' });
    } catch (e) {
      console.error(e);
      setPosts(snapshot);
      toast({ title: 'Error', description: 'Failed to delete comment', variant: 'destructive' });
    }
  };

  const openPost = (id: string) => {
    navigate(`${routes.event(eventId)}?tab=posts&post=${id}`);
  };

  const mediaThumb = (urls: string[]) => {
    if (!urls?.length) return null;
    const url = urls[0];
    const isVideo = /mux|\.mp4$|\.mov$|\.m3u8$/i.test(url);

    return (
      <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border">
        {isVideo ? (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center">
            <Play className="w-5 h-5 text-muted-foreground" />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute bottom-1 right-1 bg-black/60 text-white rounded px-1 py-0.5 text-[10px]">
          {isVideo ? 'Video' : 'Image'}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-background border shadow-xl">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {singleMode ? 'Comments' : 'Posts & Comments'} • {eventTitle}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 p-1">
          {loading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <p className="font-medium">No {singleMode ? 'comments' : 'posts'} yet.</p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className={`border rounded-lg p-4 space-y-3 transition-all ${
                  selectedPostId === post.id ? 'ring-2 ring-primary border-primary' : ''
                }`}
              >
                {/* Post Header */}
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => navigate(routes.user(post.author_user_id))}
                    className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Open ${post.author_name || 'user'} profile`}
                  >
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={post.author_avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {post.author_name?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <button
                        onClick={() => navigate(routes.user(post.author_user_id))}
                        className="font-medium text-sm hover:text-primary transition-colors cursor-pointer"
                        title="View profile"
                      >
                        {post.author_name}
                      </button>

                      {post.author_is_organizer && (
                        <Badge variant="outline" className="text-[10px]">
                          ORGANIZER
                        </Badge>
                      )}

                      {post.author_badge && (
                        <Badge variant="outline" className="text-[10px]">
                          {post.author_badge}
                        </Badge>
                      )}

                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed">{post.text}</p>
                  </div>

                  {/* Media thumb */}
                  {mediaThumb(post.media_urls)}
                </div>

                {/* Post Actions */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <button
                    onClick={() => toggleLikePost(post.id)}
                    className={`flex items-center gap-1 hover:text-foreground transition-colors ${
                      post.is_liked ? 'text-red-500' : ''
                    }`}
                    aria-label={post.is_liked ? 'Unlike post' : 'Like post'}
                    title={post.is_liked ? 'Unlike' : 'Like'}
                  >
                    <Heart className={`w-3 h-3 ${post.is_liked ? 'fill-current' : ''}`} />
                    {post.likes_count}
                  </button>

                  <button
                    onClick={() => openPost(post.id)}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    aria-label="Open post"
                    title="Open post"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View post
                  </button>

                  <span>{post.comments.length} comments</span>
                </div>

                {/* Comments */}
                {post.comments.length > 0 && (
                  <div className="space-y-3 pl-4 border-l-2 border-muted">
                    {post.comments.map((comment) => {
                      const canDelete = user?.id === comment.author_user_id;
                      return (
                        <div key={comment.id} className="flex items-start gap-3">
                          <button
                            onClick={() => navigate(routes.user(comment.author_user_id))}
                            className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label={`Open ${comment.author_name || 'user'} profile`}
                          >
                            <Avatar className="w-6 h-6">
                              <AvatarImage src={comment.author_avatar || undefined} />
                              <AvatarFallback className="text-xs">
                                {comment.author_name?.charAt(0) || 'A'}
                              </AvatarFallback>
                            </Avatar>
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <button
                                onClick={() => navigate(routes.user(comment.author_user_id))}
                                className="font-medium text-xs hover:text-primary transition-colors cursor-pointer"
                                title="View profile"
                              >
                                {comment.author_name}
                              </button>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed">{comment.text}</p>

                            {/* Comment action row */}
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                              <button
                                onClick={() => toggleLikeComment(comment.id)}
                                className={`flex items-center gap-1 hover:text-foreground transition-colors ${
                                  comment.is_liked ? 'text-red-500' : ''
                                }`}
                                aria-label={comment.is_liked ? 'Unlike comment' : 'Like comment'}
                                title={comment.is_liked ? 'Unlike' : 'Like'}
                              >
                                <Heart className={`w-3 h-3 ${comment.is_liked ? 'fill-current' : ''}`} />
                                {comment.likes_count}
                              </button>

                              {canDelete && (
                                <button
                                  onClick={() => deleteComment(comment.id)}
                                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                                  aria-label="Delete comment"
                                  title="Delete comment"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              )}

                              <div className="inline-flex">
                                <ReportButton targetType="comment" targetId={comment.id} />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
                      {selectedPostId === post.id && (
                        <div className="text-xs text-primary font-medium flex items-center gap-1">
                          <div className="w-2 h-2 bg-primary rounded-full"></div>
                          Commenting on this post
                        </div>
                      )}
                      <Textarea
                        placeholder="Write your comment…"
                        value={selectedPostId === post.id ? newComment : ''}
                        onChange={(e) => {
                          setNewComment(e.target.value);
                          setSelectedPostId(post.id); // lock to this post
                        }}
                        onFocus={() => setSelectedPostId(post.id)} // lock to this post
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
                          disabled={!newComment.trim() || submitting || selectedPostId !== post.id}
                          className="h-8 px-3"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {submitting && selectedPostId === post.id ? 'Posting…' : 'Post'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Load more (hidden in single-post mode) */}
          {!singleMode && hasMore && (
            <div className="flex justify-center py-3">
              <Button variant="outline" onClick={() => loadPage(false)} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
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