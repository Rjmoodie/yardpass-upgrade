// src/components/CommentModal.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, X, Trash2, Play, ExternalLink, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { routes } from '@/lib/routes';
import { ReportButton } from '@/components/ReportButton';
import { muxToHls } from '@/utils/media';
import { useRealtimeComments } from '@/hooks/useRealtimeComments';

const PAGE_SIZE = 25;
const MAX_LEN = 1000;

type CommentRow = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  post_id: string;
};

type PostRow = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;
  ticket_tier_id: string | null;
};

type Comment = {
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
};

type Post = {
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
};

interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  postId?: string;            // focus a single post (preferred)
  mediaPlaybackId?: string;   // fallback to resolve post by playback id
  // onSuccess removed - rely on realtime updates only
}

export default function CommentModal({
  isOpen, onClose, eventId, eventTitle, postId, mediaPlaybackId,
}: CommentModalProps) {
  const { user } = useAuth();

  // layout/scroll refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // data state
  const [posts, setPosts] = useState<Post[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(postId ?? null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageFrom, setPageFrom] = useState(0);

  // compose state (single, bottom composer)
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const overLimit = draft.length > MAX_LEN;

  // single vs multi mode
  const singleMode = !!postId || !!mediaPlaybackId;
  const activePost = useMemo(
    () => posts.find(p => p.id === activePostId) ?? posts[0],
    [posts, activePostId]
  );

  function openInNewTab(href: string) {
    try { window.open(href, '_blank', 'noopener,noreferrer'); } catch {}
  }

  async function resolvePostIdFromMedia(eventId: string, playbackId: string) {
    const { data } = await supabase
      .from('event_posts')
      .select('id, media_urls')
      .eq('event_id', eventId);
    for (const row of data ?? []) {
      const arr: string[] = row.media_urls ?? [];
      if (arr.some(u => u === `mux:${playbackId}` || u.includes(playbackId))) return row.id;
    }
    return null;
  }

  // Resolve target post once on open
  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      if (postId) {
        setActivePostId(postId);
        return;
      }
      if (mediaPlaybackId) {
        const id = await resolvePostIdFromMedia(eventId, mediaPlaybackId);
        setActivePostId(id);
        return;
      }
      setActivePostId(null);
    })();
  }, [isOpen, eventId, postId, mediaPlaybackId]);

  // Pause & mute all videos while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    const state = videos.map(v => ({ v, muted: v.muted }));
    videos.forEach(v => { try { v.pause(); } catch {} v.muted = true; });
    return () => { state.forEach(({ v, muted }) => { v.muted = muted; }); };
  }, [isOpen]);

  // Reset & load when opened / target changes
  useEffect(() => {
    if (!isOpen) return;
    setPosts([]);
    setPageFrom(0);
    setHasMore(false);
    setDraft('');
    void loadPage(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId, activePostId, singleMode]);

  // Realtime: narrow subscription using useRealtimeComments hook
  useRealtimeComments({
    postIds: singleMode && activePostId ? [activePostId] : undefined,
    eventId: !singleMode ? eventId : undefined,
    onCommentAdded: (comment) => {
      setPosts(prev => prev.map(p => {
        if (p.id !== comment.post_id) return p;
        return {
          ...p,
          comments: [
            ...p.comments,
            {
              id: comment.id,
              text: comment.text,
              author_user_id: comment.author_user_id,
              created_at: comment.created_at,
              author_name: comment.author_name ?? 'Anonymous',
              author_avatar: null,
              likes_count: 0,
              is_liked: false,
            }
          ]
        };
      }));

      // keep scrolled to bottom if user is near bottom
      const scroller = scrollRef.current;
      if (scroller) {
        const nearBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
        if (nearBottom) requestAnimationFrame(() => bottomSentinelRef.current?.scrollIntoView({ behavior: 'smooth' }));
      }
    },
    onCommentDeleted: (comment) => {
      setPosts(prev => prev.map(p => ({
        ...p,
        comments: p.comments.filter(c => c.id !== comment.id)
      })));
    }
  });

  // Load posts (+ comments + profiles), then pin scroll to bottom
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
        if (!activePostId) { setLoading(false); return; }
        postQuery = postQuery.eq('id', activePostId);
      } else {
        postQuery = postQuery.eq('event_id', eventId).order('created_at', { ascending: false }).range(from, to);
      }

      const { data: postRows, error: postsError } = await postQuery;
      if (postsError) throw postsError;

      const ids = (postRows || []).map(p => p.id);
      setHasMore(!singleMode && (postRows || []).length === PAGE_SIZE);

      // Profiles for post authors
      const authorIds = [...new Set((postRows || []).map(p => p.author_user_id))];
      let authorProfiles: Record<string, { display_name: string; photo_url?: string | null }> = {};
      if (authorIds.length) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', authorIds);
        authorProfiles = (profiles ?? []).reduce((acc, p: any) => { acc[p.user_id] = p; return acc; }, {});
      }

      // Ticket tiers (badges)
      const tierIds = [...new Set((postRows || []).map(p => p.ticket_tier_id).filter(Boolean))] as string[];
      let ticketTiers: Record<string, { badge_label?: string | null }> = {};
      if (tierIds.length) {
        const { data: tiers } = await supabase
          .from('ticket_tiers')
          .select('id, badge_label')
          .in('id', tierIds);
        ticketTiers = (tiers ?? []).reduce((acc: Record<string, any>, t: any) => { acc[t.id] = t; return acc; }, {});
      }

      // Comments for these posts
      const { data: commentRows, error: commentsError } = await supabase
        .from('event_comments')
        .select('id, text, author_user_id, created_at, post_id')
        .in('post_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
        .order('created_at', { ascending: true });
      if (commentsError) throw commentsError;

      const commentAuthorIds = [...new Set((commentRows ?? []).map(c => c.author_user_id))];
      let commentAuthorProfiles: Record<string, any> = {};
      if (commentAuthorIds.length) {
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('user_id, display_name, photo_url')
          .in('user_id', commentAuthorIds);
        commentAuthorProfiles = (profiles ?? []).reduce((acc: Record<string, any>, p: any) => { acc[p.user_id] = p; return acc; }, {});
      }

      const commentsByPost = (commentRows ?? []).reduce((acc: Record<string, Comment[]>, c: any) => {
        const list = acc[c.post_id] ?? [];
        list.push({
          id: c.id,
          text: c.text,
          author_user_id: c.author_user_id,
          created_at: c.created_at,
          author_name: commentAuthorProfiles[c.author_user_id]?.display_name ?? 'Anonymous',
          author_avatar: commentAuthorProfiles[c.author_user_id]?.photo_url ?? null,
          likes_count: 0,
          is_liked: false,
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
        is_liked: false,
      }));

      setPosts(prev => reset ? mapped : [...prev, ...mapped]);

      // set default active post in multi-mode
      if (!singleMode && reset && mapped[0] && !activePostId) {
        setActivePostId(mapped[0].id);
      }

      if (!singleMode) setPageFrom(to + 1);

      // pin to bottom on initial load in single-mode
      if (reset) {
        requestAnimationFrame(() => bottomSentinelRef.current?.scrollIntoView({ behavior: 'auto' }));
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Error', description: e.message || 'Failed to load comments', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // --- actions ---
  const submit = async () => {
    console.log('🔥 CommentModal: Starting comment submission', {
      activePost: activePost?.id,
      eventId,
      draft: draft.trim(),
      singleMode
    });
    
    if (!draft.trim() || !activePost?.id || overLimit) return;
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to comment', variant: 'destructive' });
      return;
    }

    setSubmitting(true);

    const clientId = `c_${Date.now()}`;
    const optimistic: Comment = {
      id: clientId,
      client_id: clientId,
      text: draft.trim(),
      author_user_id: user.id,
      created_at: new Date().toISOString(),
      author_name: (user.user_metadata?.display_name as string) || 'You',
      author_avatar: null,
      likes_count: 0,
      is_liked: false,
      pending: true,
    };

    console.log('🔥 CommentModal: Adding optimistic comment', { clientId, postId: activePost.id });
    setPosts(prev => prev.map(p => p.id === activePost.id ? { ...p, comments: [...p.comments, optimistic] } : p));
    setDraft('');

    try {
      console.log('🔥 CommentModal: Inserting comment to DB', { postId: activePost.id, text: optimistic.text });
      const { data, error } = await supabase
        .from('event_comments')
        .insert({ post_id: activePost.id, author_user_id: user.id, text: optimistic.text })
        .select('id, created_at')
        .single();
      if (error) throw error;

      console.log('🔥 CommentModal: Comment inserted successfully', { commentId: data.id });
      setPosts(prev => prev.map(p => {
        if (p.id !== activePost.id) return p;
        const idx = p.comments.findIndex(c => c.client_id === clientId || c.id === clientId);
        if (idx < 0) return p;
        const updated = [...p.comments];
        updated[idx] = { ...updated[idx], id: data.id, created_at: data.created_at, pending: false };
        return { ...p, comments: updated };
      }));

      console.log('🔥 CommentModal: Comment successfully posted - no callback needed');
      console.log('🔥 CommentModal: Scrolling to bottom');
      requestAnimationFrame(() => bottomSentinelRef.current?.scrollIntoView({ behavior: 'smooth' }));
    } catch (e: any) {
      console.error('🔥 CommentModal: Error submitting comment', e);
      setPosts(prev => prev.map(p =>
        p.id === activePost.id ? { ...p, comments: p.comments.filter(c => c.client_id !== clientId) } : p
      ));
      toast({ title: 'Error', description: e.message || 'Failed to add comment', variant: 'destructive' });
    } finally {
      console.log('🔥 CommentModal: Comment submission finished');
      setSubmitting(false);
    }
  };

  const toggleLikeComment = async (commentId: string) => {
    if (!user) {
      toast({ title: 'Sign in required', description: 'Please sign in to like comments', variant: 'destructive' });
      return;
    }
    let isLiked = false;
    for (const p of posts) {
      const c = p.comments.find(cc => cc.id === commentId);
      if (c) { isLiked = c.is_liked; break; }
    }
    const optimistic = !isLiked;
    setPosts(prev => prev.map(p => ({
      ...p,
      comments: p.comments.map(c =>
        c.id === commentId
          ? { ...c, is_liked: optimistic, likes_count: Math.max(0, c.likes_count + (optimistic ? 1 : -1)) }
          : c
      )
    })));
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
          .eq('comment_id', commentId).eq('user_id', user.id).eq('kind', 'like');
        if (error) throw error;
      }
    } catch {
      setPosts(prev => prev.map(p => ({
        ...p,
        comments: p.comments.map(c =>
          c.id === commentId
            ? { ...c, is_liked: !optimistic, likes_count: Math.max(0, c.likes_count + (optimistic ? -1 : 1)) }
            : c
        )
      })));
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
      const c = p.comments.find(cc => cc.id === commentId);
      if (c) { authorId = c.author_user_id; break; }
    }
    if (!authorId || authorId !== user.id) {
      toast({ title: 'Not allowed', description: 'You can only delete your own comments.', variant: 'destructive' });
      return;
    }
    const snapshot = posts;
    setPosts(prev => prev.map(p => ({ ...p, comments: p.comments.filter(c => c.id !== commentId) })));
    try {
      const { error } = await supabase.from('event_comments').delete().eq('id', commentId).eq('author_user_id', user.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Your comment was removed.' });
    } catch {
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
      {/* NOTE: parent container uses flex/column with min-h-0; body gets the scroll */}
      <DialogContent className="w-[min(100vw,880px)] max-h-[84vh] p-0 gap-0 overflow-hidden bg-background border shadow-xl rounded-2xl flex flex-col">
        {/* Header (sticky) */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <span className="truncate">{singleMode ? 'Comments' : 'Posts & Comments'}</span>
              <span className="text-muted-foreground">•</span>
              <span className="truncate text-muted-foreground">{eventTitle}</span>
            </DialogTitle>

            <div className="flex items-center gap-2">
              {/* Multi-post selector (compact) */}
              {!singleMode && posts.length > 1 && (
                <div className="relative">
                  <select
                    className="text-sm bg-muted/40 border rounded-md px-2 py-1 pr-6"
                    value={activePost?.id ?? ''}
                    onChange={(e) => setActivePostId(e.target.value)}
                  >
                    {posts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.text?.slice(0, 28) || 'Post'} {p.text && p.text.length > 28 ? '…' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
                </div>
              )}

              {singleMode && activePost?.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`${window.location.origin}${routes.event(eventId)}?tab=posts&post=${activePost.id}`)
                      .then(() => toast({ title: 'Link copied' }));
                  }}
                  aria-label="Copy link to this post"
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

        {/* Body (scrollable) */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {(!activePost || loading) && posts.length === 0 ? (
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
          ) : activePost ? (
            <>
              {/* Post header */}
              <div className="rounded-2xl border bg-card/40 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => openInNewTab(routes.user(activePost.author_user_id))}
                    className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
                    aria-label={`Open ${activePost.author_name || 'user'} profile in new tab`}
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={activePost.author_avatar || undefined} />
                      <AvatarFallback className="text-xs">
                        {activePost.author_name?.charAt(0) || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openInNewTab(routes.user(activePost.author_user_id))}
                        className="font-medium text-sm hover:text-primary transition-colors cursor-pointer"
                        title="View profile (new tab)"
                      >
                        {activePost.author_name}
                      </button>

                      {activePost.author_is_organizer && (
                        <Badge variant="outline" className="text-[10px]">ORGANIZER</Badge>
                      )}
                      {activePost.author_badge && (
                        <Badge variant="outline" className="text-[10px]">{activePost.author_badge}</Badge>
                      )}

                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(activePost.created_at), { addSuffix: true })}
                      </span>
                    </div>

                    {activePost.text && (
                      <p className="mt-1 text-sm leading-relaxed text-foreground/95 whitespace-pre-wrap">
                        {activePost.text}
                      </p>
                    )}
                  </div>

                  {mediaThumb(activePost.media_urls)}
                </div>
              </div>

              {/* Comments list */}
              <div className="space-y-2">
                {activePost.comments.map((comment) => {
                  const mine = user?.id === comment.author_user_id;
                  return (
                    <div
                      key={comment.id}
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

                      <div className="max-w-[85%] sm:max-w-[70%]">
                        <div
                          className={`rounded-2xl px-3 py-2 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap shadow-sm
                          ${mine ? 'bg-primary/10 text-foreground' : 'bg-muted/60 text-foreground'}
                          ${comment.pending ? 'opacity-70' : ''}`}
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

                        <div className={`mt-1 flex items-center ${mine ? 'justify-end' : 'justify-start'} gap-3 text-[11px] text-muted-foreground`}>
                          <button
                            type="button"
                            onClick={() => { if (!comment.pending) toggleLikeComment(comment.id); }}
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
                              onClick={() => deleteComment(comment.id)}
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

                {/* sentinel for scroll-to-bottom */}
                <div ref={bottomSentinelRef} />
              </div>

              {/* Load more (multi-post lists) */}
              {!singleMode && hasMore && (
                <div className="flex justify-center pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadPage(false)}
                    disabled={loading}
                    className="rounded-full"
                  >
                    {loading ? 'Loading…' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p className="font-medium">No post found.</p>
            </div>
          )}
        </div>

        {/* Footer / single composer (sticky) */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-4 sm:px-6 py-3">
          {user ? (
            <div className="flex items-end gap-3">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.user_metadata?.photo_url || undefined} />
                <AvatarFallback className="text-xs">
                  {user.user_metadata?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <Textarea
                  value={draft}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length <= MAX_LEN + 200) setDraft(val);
                  }}
                  placeholder={activePost ? 'Write your comment…' : 'Select a post to comment'}
                  disabled={!activePost}
                  className={`w-full min-h-[44px] max-h-[160px] resize-none text-sm ${overLimit ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                <div className="mt-1 flex items-center justify-between">
                  <span className={`text-[11px] ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {draft.length}/{MAX_LEN} {overLimit ? '— too long' : ''}
                  </span>
                  <div className="flex gap-2">
                    {activePost?.id && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(`${window.location.origin}${routes.event(eventId)}?tab=posts&post=${activePost.id}`)
                            .then(() => toast({ title: 'Link copied' }));
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" />
                        Copy link
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={submit}
                      disabled={!draft.trim() || submitting || !activePost || overLimit}
                    >
                      {submitting ? 'Posting…' : 'Post'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-center text-muted-foreground">Sign in to join the conversation</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
