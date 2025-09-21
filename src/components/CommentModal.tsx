// src/components/CommentModal.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Send, X, Play, ExternalLink, Trash2, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { routes } from '@/lib/routes';
import { ReportButton } from '@/components/ReportButton';
import { muxToHls } from '@/utils/media';

const PAGE_SIZE = 10;
const MAX_LEN = 1000;

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
  pending?: boolean;
  client_id?: string;
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
  author_is_organizer?: boolean;
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
  /** Fallback: if postId is missing, resolve from this Mux playback ID */
  mediaPlaybackId?: string;
  /** Called when a comment is successfully added */
  onSuccess?: () => void;
}

export default function CommentModal({
  isOpen, onClose, eventId, eventTitle, postId, mediaPlaybackId, onSuccess,
}: CommentModalProps) {
  const { user } = useAuth();
  const isMounted = useRef(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const newestCommentRef = useRef<HTMLDivElement | null>(null);
  const composerRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // pagination (used only in multi-post mode)
  const [pageFrom, setPageFrom] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const singleMode = !!postId || !!mediaPlaybackId;
  const [resolvedPostId, setResolvedPostId] = useState<string | null>(postId ?? null);

  // derived: ids of loaded posts for realtime filter
  const postIdSet = useMemo(() => new Set(posts.map((p) => p.id)), [posts]);

  // Smoothly jump to the active (or provided) post's composer and focus it
  const jumpToComposer = (postId?: string) => {
    const id = postId || selectedPostId || posts[0]?.id;
    if (!id) return;

    const el = composerRefs.current[id];
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // ensure focus after scroll finishes
    setTimeout(() => {
      el.focus();
      // move caret to the end
      try { el.selectionStart = el.selectionEnd = el.value.length; } catch {}
    }, 250);
  };

  function openInNewTab(href: string) {
    try { window.open(href, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
  }

  async function resolvePostIdFromMedia(eventId: string, playbackId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('event_posts')
      .select('id, media_urls')
      .eq('event_id', eventId);

    if (error) return null;
    for (const row of data ?? []) {
      const arr: string[] = row.media_urls ?? [];
      const hit = arr.some((u) => u === `mux:${playbackId}` || u.includes(playbackId));
      if (hit) return row.id;
    }
    return null;
  }

  // Resolve postId (when opening)
  useEffect(() => {
    if (!isOpen) return;
    isMounted.current = true;
    (async () => {
      if (postId) { setResolvedPostId(postId); return; }
      if (mediaPlaybackId) {
        const id = await resolvePostIdFromMedia(eventId, mediaPlaybackId);
        if (isMounted.current) setResolvedPostId(id);
        return;
      }
      setResolvedPostId(null);
    })();
    return () => { isMounted.current = false; };
  }, [isOpen, eventId, postId, mediaPlaybackId]);

  // Pause/mute all videos when modal opens; restore only mute state on close
  useEffect(() => {
    if (!isOpen) return;
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    const state = videos.map(v => ({ v, muted: v.muted }));
    videos.forEach(v => { try { v.pause(); } catch {} v.muted = true; });

    return () => { state.forEach(({ v, muted }) => { v.muted = muted; }); };
  }, [isOpen]);

  // Reset & load when opened
  useEffect(() => {
    if (!isOpen) return;
    setPosts([]);
    setPageFrom(0);
    setHasMore(!singleMode);
    setSelectedPostId(resolvedPostId ?? null);
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId, resolvedPostId, singleMode]);

  // Auto-jump to composer when opening in single-post mode
  useEffect(() => {
    if (!isOpen) return;
    if (singleMode) {
      // wait for the first render after posts load
      const t = setTimeout(() => jumpToComposer(resolvedPostId || undefined), 450);
      return () => clearTimeout(t);
    }
  }, [isOpen, singleMode, resolvedPostId, posts.length]);

  // Realtime (scoped)
  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase
      .channel(`comments-${singleMode ? resolvedPostId ?? 'unknown' : eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'event_comments',
          ...(singleMode && resolvedPostId ? { filter: `post_id=eq.${resolvedPostId}` } : {}),
        },
        (payload) => {
          const c = payload.new as CommentRow;
          if (!singleMode && !postIdSet.has(c.post_id)) return;

          setPosts((prev) =>
            prev.map((p) => {
              if (p.id !== c.post_id) return p;

              const idx = p.comments.findIndex(
                (cm) =>
                  cm.pending &&
                  cm.author_user_id === c.author_user_id &&
                  cm.text.trim() === c.text.trim()
              );

              if (idx >= 0) {
                const updated = [...p.comments];
                updated[idx] = {
                  ...updated[idx],
                  id: c.id,
                  created_at: c.created_at,
                  pending: false,
                };
                return { ...p, comments: updated };
              }

              return {
                ...p,
                comments: [
                  ...p.comments,
                  {
                    id: c.id,
                    text: c.text,
                    author_user_id: c.author_user_id,
                    created_at: c.created_at,
                    author_name: 'Anonymous',
                    author_avatar: null,
                    likes_count: 0,
                    is_liked: false,
                  },
                ],
              };
            })
          );
        }
      )
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [isOpen, eventId, singleMode, resolvedPostId, postIdSet]);

  // Load posts (+ comments, likes, profiles)
  async function loadPage(reset = false) {
    if (loading) return;
    setLoading(true);

    try {
      const from = reset ? 0 : pageFrom;
      const to = from + PAGE_SIZE - 1;

      let postQuery = supabase
        .from('event_posts')
        .select('id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id');

      if (singleMode) {
        if (!resolvedPostId) { setLoading(false); return; }
        postQuery = postQuery.eq('id', resolvedPostId);
      } else {
        postQuery = postQuery.eq('event_id', eventId).order('created_at', { ascending: false }).range(from, to);
      }

      const { data: postRows, error: postsError } = await postQuery;
      if (postsError) throw postsError;

      const postIds = (postRows || []).map((p) => p.id);
      setHasMore(!singleMode && (postRows || []).length === PAGE_SIZE);

      // Profiles for post authors
      const authorIds = [...new Set((postRows || []).map((p) => p.author_user_id))];
      let authorProfiles: Record<string, { display_name: string; photo_url?: string | null }> = {};
      if (authorIds.length) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', authorIds);
        authorProfiles = (profiles || []).reduce((acc, p: any) => {
          acc[p.user_id] = p;
          return acc;
        }, {} as Record<string, any>);
      }

      // Ticket tiers for badges
      const tierIds = [...new Set((postRows || []).map((p) => p.ticket_tier_id).filter(Boolean))] as string[];
      let ticketTiers: Record<string, { badge_label?: string | null }> = {};
      if (tierIds.length) {
        const { data: tiers } = await supabase
          .from('ticket_tiers')
          .select('id, badge_label')
          .in('id', tierIds);
        ticketTiers = (tiers || []).reduce((acc: Record<string, any>, t: any) => {
          acc[t.id] = t; return acc;
        }, {});
      }

      // Comments for these posts
      const { data: commentRows, error: commentsError } = await supabase
        .from('event_comments')
        .select('id, text, author_user_id, created_at, post_id')
        .in('post_id', postIds.length ? postIds : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: true });
      if (commentsError) throw commentsError;

      // Profiles for comment authors
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

      // Post likes (mine)
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

      // Comment like counts & which comments I liked
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
        media_urls: (p.media_urls ?? []).map(muxToHls),
        author_name: authorProfiles[p.author_user_id]?.display_name ?? 'Anonymous',
        author_avatar: authorProfiles[p.author_user_id]?.photo_url ?? null,
        author_badge: p.ticket_tier_id ? (ticketTiers[p.ticket_tier_id]?.badge_label ?? null) : null,
        author_is_organizer: false,
        comments: commentsByPost[p.id] ?? [],
        likes_count: p.like_count ?? 0,
        is_liked: likedPostSet.has(p.id),
      }));

      const finalMapped = singleMode && resolvedPostId ? mapped.filter((p) => p.id === resolvedPostId) : mapped;

      setPosts((prev) => (reset ? finalMapped : [...prev, ...finalMapped]));
      if (singleMode && resolvedPostId) setSelectedPostId(resolvedPostId);
      if (!singleMode) setPageFrom(to + 1);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to load comments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  const overLimit = newComment.length > MAX_LEN;

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedPostId || overLimit) return;
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to comment', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const clientId = `c_${Date.now()}`;
    const optimistic: Comment = {
      id: clientId,
      client_id: clientId,
      text: newComment.trim(),
      author_user_id: user.id,
      created_at: new Date().toISOString(),
      author_name: (user.user_metadata?.display_name as string) || 'You',
      author_avatar: null,
      likes_count: 0,
      is_liked: false,
      pending: true,
    };

    setPosts((prev) =>
      prev.map((p) => (p.id === selectedPostId ? { ...p, comments: [...p.comments, optimistic] } : p))
    );
    setNewComment('');

    try {
      const { data, error } = await supabase
        .from('event_comments')
        .insert({
          post_id: selectedPostId,
          author_user_id: user.id,
          text: optimistic.text,
        })
        .select('id, created_at')
        .single();

      if (error) throw error;

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== selectedPostId) return p;
          const idx = p.comments.findIndex((c) => c.client_id === clientId || c.id === clientId);
          if (idx < 0) return p;

          const updated = [...p.comments];
          updated[idx] = {
            ...updated[idx],
            id: data.id,
            created_at: data.created_at,
            pending: false,
          };
          return { ...p, comments: updated };
        })
      );

      onSuccess?.();
      setTimeout(() => {
        newestCommentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 0);
    } catch (e: any) {
      console.error(e);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPostId ? { ...p, comments: p.comments.filter((c) => c.client_id !== clientId) } : p
        )
      );
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
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postIdToToggle
          ? { ...p, is_liked: optimistic, likes_count: Math.max(0, p.likes_count + (optimistic ? 1 : -1)) }
          : p
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
      onSuccess?.();
    } catch (e) {
      console.error(e);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postIdToToggle
            ? { ...p, is_liked: !optimistic, likes_count: Math.max(0, p.likes_count + (optimistic ? -1 : 1)) }
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

    let isLiked = false;
    for (const p of posts) {
      const c = p.comments.find((cc) => cc.id === commentId);
      if (c) { isLiked = c.is_liked; break; }
    }

    const optimistic = !isLiked;

    setPosts((prev) =>
      prev.map((p) => ({
        ...p,
        comments: p.comments.map((c) =>
          c.id === commentId
            ? { ...c, is_liked: optimistic, likes_count: Math.max(0, c.likes_count + (optimistic ? 1 : -1)) }
            : c
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

    let authorId: string | null = null;
    for (const p of posts) {
      const c = p.comments.find((cc) => cc.id === commentId);
      if (c) { authorId = c.author_user_id; break; }
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

  const mediaThumb = (urls: string[]) => {
    if (!urls?.length) return null;
    const raw = urls[0];
    const url = muxToHls(raw);
    const isVideo = /\.m3u8$|\.mp4$|\.mov$|\.webm$/i.test(url);

    return (
      <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border bg-muted/30">
        {isVideo ? (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center">
            <Play className="w-5 h-5 text-muted-foreground" />
          </div>
        ) : (
          // eslint-disable-next-line jsx-a11y/alt-text
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
      <DialogContent
        className="w-[min(100vw,880px)] max-h-[84vh] p-0 gap-0 overflow-hidden bg-background border shadow-xl rounded-2xl"
      >
        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <span className="truncate">{singleMode ? 'Comments' : 'Posts & Comments'}</span>
              <span className="text-muted-foreground">•</span>
              <span className="truncate text-muted-foreground">{eventTitle}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {user && posts.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); jumpToComposer(); }}
                  className="h-8"
                >
                  Write a comment
                </Button>
              )}
              {singleMode && resolvedPostId && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    navigator.clipboard.writeText(`${window.location.origin}${routes.event(eventId)}?tab=posts&post=${resolvedPostId}`)
                      .then(() => toast({ title: 'Link copied' }))
                      .catch(() => {});
                  }}
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading && posts.length === 0 ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                      <div className="h-4 w-full bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="font-medium">No {singleMode ? 'comments' : 'posts'} yet.</p>
              <p className="text-sm">Be the first to start the conversation.</p>
            </div>
          ) : (
            posts.map((post) => {
              const isSelected = selectedPostId === post.id;
              return (
                <div
                  key={post.id}
                  className={`rounded-2xl border bg-card/40 p-4 sm:p-5 transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}
                >
                  {/* Post meta */}
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => openInNewTab(routes.user(post.author_user_id))}
                      className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={`Open ${post.author_name || 'user'} profile in new tab`}
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={post.author_avatar || undefined} />
                        <AvatarFallback className="text-xs">
                          {post.author_name?.charAt(0) || 'A'}
                        </AvatarFallback>
                      </Avatar>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openInNewTab(routes.user(post.author_user_id))}
                          className="font-medium text-sm hover:text-primary transition-colors cursor-pointer"
                          title="View profile (new tab)"
                        >
                          {post.author_name}
                        </button>

                        {post.author_is_organizer && (
                          <Badge variant="outline" className="text-[10px]">ORGANIZER</Badge>
                        )}

                        {post.author_badge && (
                          <Badge variant="outline" className="text-[10px]">{post.author_badge}</Badge>
                        )}

                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                        </span>
                      </div>

                      {post.text && (
                        <p className="mt-1 text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap">
                          {post.text}
                        </p>
                      )}
                    </div>

                    {mediaThumb(post.media_urls)}
                  </div>

                  {/* Post actions */}
                  <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleLikePost(post.id); }}
                      className={`flex items-center gap-1 hover:text-foreground transition-colors ${post.is_liked ? 'text-red-500' : ''}`}
                      aria-label={post.is_liked ? 'Unlike post' : 'Like post'}
                      title={post.is_liked ? 'Unlike' : 'Like'}
                    >
                      <Heart className={`w-3 h-3 ${post.is_liked ? 'fill-current' : ''}`} />
                      {post.likes_count}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        openInNewTab(`${routes.event(eventId)}?tab=posts&post=${post.id}`);
                      }}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      aria-label="Open post in new tab"
                      title="Open post in new tab"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View post
                    </button>

                    <span className="text-muted-foreground">
                      {post.comments.length} comment{post.comments.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Comments list (chat style) */}
                  {post.comments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {post.comments.map((comment, idx, arr) => {
                        const mine = user?.id === comment.author_user_id;
                        const isNewest = idx === arr.length - 1;

                        return (
                          <div
                            key={comment.id}
                            ref={isNewest ? newestCommentRef : undefined}
                            className={`group flex items-start gap-2 sm:gap-3 ${mine ? 'flex-row-reverse text-right' : ''}`}
                          >
                            <button
                              type="button"
                              onClick={() => openInNewTab(routes.user(comment.author_user_id))}
                              className={`mt-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary ${mine ? 'order-last' : ''}`}
                              aria-label={`Open ${comment.author_name || 'user'} profile in new tab`}
                            >
                              <Avatar className="w-7 h-7">
                                <AvatarImage src={comment.author_avatar || undefined} />
                                <AvatarFallback className="text-xs">
                                  {comment.author_name?.charAt(0) || 'A'}
                                </AvatarFallback>
                              </Avatar>
                            </button>

                            <div className={`max-w-[85%] sm:max-w-[70%]`}>
                              <div
                                className={`rounded-2xl px-3 py-2 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm
                                ${mine ? 'bg-primary/10 text-foreground' : 'bg-muted/60 text-foreground'}
                                ${comment.pending ? 'opacity-70' : ''}
                                `}
                                title={comment.pending ? 'Sending…' : undefined}
                              >
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openInNewTab(routes.user(comment.author_user_id))}
                                    className="font-medium text-[11px] sm:text-xs hover:text-primary transition-colors"
                                    title="View profile (new tab)"
                                  >
                                    {comment.author_name}
                                  </button>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                    {comment.pending ? ' • sending…' : ''}
                                  </span>
                                </div>
                                {comment.text}
                              </div>

                              {/* Bubble actions */}
                              <div className={`mt-1 flex items-center ${mine ? 'justify-end' : 'justify-start'} gap-3 text-[11px] text-muted-foreground`}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!comment.pending) toggleLikeComment(comment.id); }}
                                  className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${comment.is_liked ? 'text-red-500' : ''} ${comment.pending ? 'pointer-events-none opacity-60' : ''}`}
                                  aria-label={comment.is_liked ? 'Unlike comment' : 'Like comment'}
                                  title={comment.is_liked ? 'Unlike' : 'Like'}
                                >
                                  <Heart className={`w-3 h-3 ${comment.is_liked ? 'fill-current' : ''}`} />
                                  {comment.likes_count}
                                </button>

                                {user?.id === comment.author_user_id && !comment.pending && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteComment(comment.id); }}
                                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                                    aria-label="Delete comment"
                                    title="Delete comment"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Delete
                                  </button>
                                )}

                                {!comment.pending && (
                                  <div className="inline-flex">
                                    <ReportButton targetType="comment" targetId={comment.id} />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Composer (pinned within each post card) */}
                  {user && (
                    <div className="mt-3 border-t pt-3">
                      {selectedPostId === post.id && (
                        <div className="mb-1 text-[11px] text-primary font-medium flex items-center gap-1">
                          <div className="w-2 h-2 bg-primary rounded-full" />
                          Commenting on this post
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-xs">
                            {user.user_metadata?.display_name?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 space-y-2">
                          <Textarea
                            ref={(el) => { composerRefs.current[post.id] = el; }}
                            placeholder="Write your comment…"
                            value={selectedPostId === post.id ? newComment : ''}
                            onChange={(e) => {
                              if (e.target.value.length <= MAX_LEN + 200) { // soft guard to allow paste then show counter
                                setNewComment(e.target.value);
                              }
                              setSelectedPostId(post.id);
                            }}
                            onFocus={() => setSelectedPostId(post.id)}
                            className={`min-h-[60px] resize-none text-sm ${overLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            onKeyDown={(e) => {
                              const metaEnter = (e.key === 'Enter' && (e.metaKey || e.ctrlKey));
                              if ((e.key === 'Enter' && !e.shiftKey) || metaEnter) {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSubmitComment();
                              }
                            }}
                          />

                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                              {newComment.length}/{MAX_LEN} {overLimit ? '— too long' : ''}
                              <span className="mx-1">·</span>
                              Press <kbd className="px-1 py-0.5 border rounded">Enter</kbd> to send
                              <span className="mx-1">·</span>
                              <kbd className="px-1 py-0.5 border rounded">Shift</kbd>+<kbd className="px-1 py-0.5 border rounded">Enter</kbd> for a new line
                            </span>

                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-8"
                                onClick={(e) => {
                                  e.preventDefault(); e.stopPropagation();
                                  navigator.clipboard.writeText(`${window.location.origin}${routes.event(eventId)}?tab=posts&post=${post.id}`)
                                    .then(() => toast({ title: 'Link copied' }))
                                    .catch(() => {});
                                }}
                              >
                                <LinkIcon className="w-3.5 h-3.5 mr-1" />
                                Copy link
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSubmitComment(); }}
                                disabled={!newComment.trim() || submitting || selectedPostId !== post.id || overLimit}
                                className="h-8 px-3"
                              >
                                <Send className="w-3.5 h-3.5 mr-1" />
                                {submitting && selectedPostId === post.id ? 'Posting…' : 'Post'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Load more (hidden in single-post mode) */}
          {!singleMode && hasMore && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); loadPage(false); }}
                disabled={loading}
                className="rounded-full"
              >
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          )}
        </div>

        {/* Floating "Add comment" FAB (nice on mobile) */}
        {user && posts.length > 0 && (
          <div className="pointer-events-none">
            <div className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-[60]">
              <Button
                type="button"
                size="sm"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); jumpToComposer(); }}
                className="pointer-events-auto shadow-lg"
              >
                Write a comment
              </Button>
            </div>
          </div>
        )}

        {/* Footer (auth hint) */}
        {!user && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-4 sm:px-6 py-3">
            <p className="text-sm text-center text-muted-foreground">Sign in to join the conversation</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}