import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, X, Trash2, ExternalLink, Link as LinkIcon, ChevronDown, Pin, Reply, MoreVertical, Flag, MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { routes } from '@/lib/routes';
import { ReportButton } from '@/components/ReportButton';
import { muxToHls } from '@/utils/media';
import { useRealtimeComments } from '@/hooks/useRealtimeComments';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAGE_SIZE = 25;
const MAX_LEN = 1000;

// Types mirrored from original component
export type CommentRow = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  post_id: string;
};

export type PostRow = {
  id: string;
  text: string;
  author_user_id: string;
  created_at: string;
  media_urls: string[] | null;
  like_count: number | null;
  comment_count: number | null;
  ticket_tier_id: string | null;
};

export type Comment = {
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
  is_pinned?: boolean;
  parent_comment_id?: string | null;
  mentions?: string[];
  reply_count?: number;
  replies?: Comment[];
};

export type Post = {
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
  comment_count: number;
};

export interface CommentModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  postId?: string; // focus a single post (preferred)
  mediaPlaybackId?: string; // fallback to resolve post by playback id
  onCommentCountChange?: (postId: string, newCount: number) => void;
  onPostDelete?: (postId: string) => void;
  onRequestUsername?: () => void;
  mode?: 'view' | 'comment';
}

// Helpers outside component to keep stable refs
function parseRichText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const matches = Array.from(text.matchAll(/(https?:\/\/[^\s]+)|(@\w+)/g));
  let last = 0;

  matches.forEach((m, i) => {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith('@')) {
      parts.push(
        <span key={`m-${i}`} className="text-primary font-medium" data-username={token.slice(1)}>
          {token}
        </span>
      );
    } else {
      parts.push(
        <a
          key={`u-${i}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {token}
        </a>
      );
    }
    last = m.index! + token.length;
  });

  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : [text];
}

function extractMentions(text: string): string[] {
  const out: string[] = [];
  const matches = text.matchAll(/@(\w+)/g);
  for (const m of matches) out.push(m[1]);
  return out;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
}

async function resolvePostIdFromMedia(eventId: string, playbackId: string) {
  console.log('🔍 [resolvePostIdFromMedia] Searching for playbackId:', playbackId, 'in event:', eventId);

  const { data, error } = await supabase
    .from('event_posts')
    .select('id, media_urls, text')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [resolvePostIdFromMedia] Error:', error);
    throw error;
  }

  console.log('📋 [resolvePostIdFromMedia] Found posts:', data?.length);

  for (const row of data ?? []) {
    const arr: string[] = row.media_urls ?? [];
    const hasMatch = arr.some((u) => {
      const exactMux = u === `mux:${playbackId}`;
      const inUrl = u.includes(`/${playbackId}/`) || u.includes(`/${playbackId}.`);
      return exactMux || inUrl;
    });

    if (hasMatch) {
      console.log('✅ [resolvePostIdFromMedia] MATCH FOUND:', row.id);
      return row.id;
    }
  }

  console.warn('⚠️ [resolvePostIdFromMedia] No match found for playbackId:', playbackId);
  return null;
}

// --- Memoized subcomponents -------------------------------------------------

type CommentItemProps = {
  comment: Comment;
  currentUserId?: string | null;
  mine: boolean;
  depth: number;
  onLike: (id: string) => void;
  onReply: (c: Comment) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  isOrganizer: boolean;
};

const CommentItem = memo(function CommentItem({
  comment: c,
  currentUserId,
  mine,
  depth,
  onLike,
  onReply,
  onDelete,
  onTogglePin,
  isOrganizer,
}: CommentItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLongComment = c.text.length > 200;
  const displayText = isLongComment && !isExpanded ? c.text.slice(0, 200) + '...' : c.text;
  
  return (
    <div className={depth > 0 ? 'ml-6 sm:ml-8 mt-3' : 'mb-4'}>
      <div
        className={`group flex items-start gap-2 sm:gap-3 ${mine ? 'flex-row-reverse text-right' : ''} ${
          c.pending ? 'opacity-70' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => window.open(routes.user(c.author_user_id), '_blank', 'noopener,noreferrer')}
          className={`mt-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary shrink-0 ${mine ? 'order-last' : ''}`}
          aria-label={`Open ${c.author_name || 'user'} profile in new tab`}
        >
          <Avatar className="w-8 h-8 sm:w-9 sm:h-9">
            <AvatarImage src={c.author_avatar || undefined} />
            <AvatarFallback className="text-xs sm:text-sm">{c.author_name?.charAt(0) || 'A'}</AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm leading-relaxed break-words shadow-sm ${
              mine ? 'bg-primary/10 text-foreground' : 'bg-muted/60 text-foreground'
            } ${c.pending ? 'opacity-70' : ''} ${c.is_pinned ? 'ring-2 ring-primary/40' : ''}`}
            title={c.pending ? 'Sending…' : undefined}
          >
            <div className="mb-1.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => window.open(routes.user(c.author_user_id), '_blank', 'noopener,noreferrer')}
                  className="font-semibold text-[11px] sm:text-xs hover:text-primary transition-colors"
                  title="View profile (new tab)"
                >
                  {c.author_name}
                </button>
                {c.is_pinned && (
                  <Badge variant="brand" size="sm" className="text-[9px] px-1.5 py-0 h-4 gap-0.5">
                    <Pin className="w-2.5 h-2.5" /> PINNED
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                {c.pending ? ' • sending…' : ''}
              </span>
            </div>
            <div className="whitespace-pre-wrap">{parseRichText(displayText)}</div>
            {isLongComment && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>

          <div
            className={`mt-1 flex items-center ${
              mine ? 'justify-end' : 'justify-start'
            } gap-3 text-[11px] text-muted-foreground flex-wrap`}
          >
            <button
              type="button"
              onClick={() => {
                if (!c.pending) onLike(c.id);
              }}
              className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                c.is_liked ? 'text-red-500' : ''
              } ${c.pending ? 'pointer-events-none opacity-60' : ''}`}
              aria-label={c.is_liked ? 'Unlike comment' : 'Like comment'}
              title={c.is_liked ? 'Unlike' : 'Like'}
            >
              <Heart className={`w-3 h-3 ${c.is_liked ? 'fill-current' : ''}`} />
              {c.likes_count}
            </button>

            {!c.pending && depth < 2 && (
              <button
                type="button"
                onClick={() => onReply(c)}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                aria-label="Reply to comment"
                title="Reply"
              >
                <Reply className="w-3 h-3" /> Reply
                {(c.reply_count ?? 0) > 0 && ` (${c.reply_count})`}
              </button>
            )}

            {isOrganizer && !c.pending && (
              <button
                type="button"
                onClick={() => onTogglePin(c.id, c.is_pinned ?? false)}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                aria-label={c.is_pinned ? 'Unpin comment' : 'Pin comment'}
                title={c.is_pinned ? 'Unpin' : 'Pin'}
              >
                <Pin className="w-3 h-3" /> {c.is_pinned ? 'Unpin' : 'Pin'}
              </button>
            )}

            {mine && !c.pending && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                className="inline-flex items-center gap-1 hover:text-destructive transition-colors"
                aria-label="Delete comment"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}

            {!c.pending && (
              <div className="inline-flex">
                <ReportButton targetType="comment" targetId={c.id} />
              </div>
            )}
          </div>

          {/* Replies */}
          {c.replies && c.replies.length > 0 && (
            <div className="mt-2 space-y-2 border-l-2 border-border/50 pl-2">
              {c.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  currentUserId={currentUserId}
                  mine={r.author_user_id === currentUserId}
                  depth={depth + 1}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                  isOrganizer={isOrganizer}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------

export default function CommentModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  postId,
  mediaPlaybackId,
  onCommentCountChange,
  onPostDelete,
  onRequestUsername,
  mode = 'view',
}: CommentModalProps) {
  const { user, profile } = useAuth();
  const isCommentMode = mode === 'comment';

  // layout/scroll refs
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  // data state
  const [posts, setPosts] = useState<Post[]>([]);
  const [activePostId, setActivePostId] = useState<string | null>(postId ?? null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageFrom, setPageFrom] = useState(0);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // compose state
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const overLimit = draft.length > MAX_LEN;

  // reply state
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);

  // organizer check for pin feature
  const [isOrganizer, setIsOrganizer] = useState(false);

  // single vs multi mode
  const singleMode = !!postId || !!mediaPlaybackId;
  const activePost = useMemo(
    () => posts.find((p) => p.id === activePostId) ?? posts[0],
    [posts, activePostId]
  );

  // Resolve target post once on open / changes
  useEffect(() => {
    if (!isOpen) {
      setActivePostId(null);
      setPosts([]);
      setReplyingTo(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        console.log('🔍 [CommentModal] Resolving post:', { postId, mediaPlaybackId, eventId });

        if (postId) {
          console.log('✅ [CommentModal] Using direct postId:', postId);
          if (!cancelled) setActivePostId(postId);
          return;
        }

        if (mediaPlaybackId) {
          console.log('🔍 [CommentModal] Resolving via mediaPlaybackId:', mediaPlaybackId);
          const id = await resolvePostIdFromMedia(eventId, mediaPlaybackId);
          console.log('✅ [CommentModal] Resolved to postId:', id);
          if (!cancelled) setActivePostId(id);
          return;
        }

        console.log('⚠️ [CommentModal] No postId or mediaPlaybackId, multi-mode');
        if (!cancelled) setActivePostId(null);
      } catch (e: any) {
        console.error('❌ [CommentModal] Error resolving post:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, eventId, postId, mediaPlaybackId]);

  // Pause & mute all videos while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    const state = videos.map((v) => ({ v, muted: v.muted, paused: v.paused }));
    videos.forEach((v) => {
      try {
        v.pause();
      } catch {}
      v.muted = true;
    });
    return () => {
      state.forEach(({ v, muted }) => {
        v.muted = muted;
      });
    };
  }, [isOpen]);

  // Check if user is organizer (for pin feature)
  useEffect(() => {
    if (!isOpen || !user?.id || !eventId) return;
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('created_by, owner_context_type, owner_context_id')
          .eq('id', eventId)
          .single();
        if (error) throw error;
        if (mounted) setIsOrganizer(data?.created_by === user.id);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isOpen, user?.id, eventId]);

  useEffect(() => {
    if (isOpen && isCommentMode) {
      composerRef.current?.focus();
    }
  }, [isOpen, isCommentMode]);

  const pinToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() =>
      bottomSentinelRef.current?.scrollIntoView({ behavior })
    );
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // Load posts (+ comments + profiles)
  const loadPage = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      let mounted = true;

      try {
        const from = reset ? 0 : pageFrom;
        const to = from + PAGE_SIZE - 1;

        let postQuery = supabase
          .from('event_posts')
          .select('id, text, author_user_id, created_at, media_urls, like_count, comment_count, ticket_tier_id');

        if (singleMode) {
          if (!activePostId) {
            loadingRef.current = false;
            setLoading(false);
            return;
          }
          postQuery = postQuery.eq('id', activePostId);
        } else {
          postQuery = postQuery
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })
            .range(from, to);
        }

        const { data: postRows, error: postsError } = await postQuery;
        if (postsError) throw postsError;

        if (singleMode && postRows?.length === 0) {
          if (mounted) {
            setLoading(false);
            loadingRef.current = false;
          }
          return;
        }

        const ids = (postRows || []).map((p) => p.id);
        setHasMore(!singleMode && (postRows || []).length === PAGE_SIZE);

        const authorIds = [...new Set((postRows || []).map((p) => p.author_user_id))];
        const tierIds = [
          ...new Set((postRows || []).map((p) => p.ticket_tier_id).filter(Boolean)),
        ] as string[];

        const [profilesRes, tiersRes, commentsRes] = await Promise.all([
          authorIds.length
            ? supabase
                .from('user_profiles')
                .select('user_id, display_name, photo_url')
                .in('user_id', authorIds)
            : Promise.resolve({ data: [], error: null }),
          tierIds.length
            ? supabase
                .from('ticket_tiers')
                .select('id, badge_label')
                .in('id', tierIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('event_comments')
            .select(
              'id, text, author_user_id, created_at, post_id, is_pinned, parent_comment_id, mentions, reply_count'
            )
            .in('post_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
            .is('deleted_at', null)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: true }),
        ]);

        if (commentsRes.error) throw commentsRes.error;
        if (profilesRes.error) throw profilesRes.error;
        if (tiersRes.error) throw tiersRes.error;

        const authorProfiles: Record<string, { display_name: string; photo_url?: string | null }> = (
          (profilesRes.data as any[]) ?? []
        ).reduce((acc, p) => {
          acc[p.user_id] = p;
          return acc;
        }, {} as Record<string, any>);

        const ticketTiers: Record<string, { badge_label?: string | null }> = (
          (tiersRes.data as any[]) ?? []
        ).reduce((acc, t) => {
          acc[t.id] = t;
          return acc;
        }, {} as Record<string, any>);

        const commentAuthorIds = [...new Set((commentsRes.data ?? []).map((c: any) => c.author_user_id))];
        let commentAuthorProfiles: Record<string, any> = {};
        if (commentAuthorIds.length) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, display_name, photo_url')
            .in('user_id', commentAuthorIds);
          commentAuthorProfiles = (profiles ?? []).reduce((acc: Record<string, any>, p: any) => {
            acc[p.user_id] = p;
            return acc;
          }, {});
        }

        const commentsByPost = ((commentsRes.data as any[]) ?? []).reduce(
          (acc: Record<string, Comment[]>, c: any) => {
            const comment: Comment = {
              id: c.id,
              text: c.text,
              author_user_id: c.author_user_id,
              created_at: c.created_at,
              author_name: commentAuthorProfiles[c.author_user_id]?.display_name ?? 'Anonymous',
              author_avatar: commentAuthorProfiles[c.author_user_id]?.photo_url ?? null,
              likes_count: 0,
              is_liked: false,
              is_pinned: c.is_pinned ?? false,
              parent_comment_id: c.parent_comment_id ?? null,
              mentions: c.mentions ?? [],
              reply_count: c.reply_count ?? 0,
              replies: [],
            };

            if (!acc[c.post_id]) acc[c.post_id] = [];
            if (!c.parent_comment_id) {
              acc[c.post_id].push(comment);
            } else {
              const parent = acc[c.post_id].find((p) => p.id === c.parent_comment_id);
              if (parent) {
                (parent.replies ??= []).push(comment);
              } else {
                acc[c.post_id].push(comment);
              }
            }
            return acc;
          },
          {}
        );

        const mapped = (postRows as PostRow[]).map<Post>((p) => ({
          id: p.id,
          text: p.text,
          author_user_id: p.author_user_id,
          created_at: p.created_at,
          media_urls: (p.media_urls ?? []).map(muxToHls),
          author_name: authorProfiles[p.author_user_id]?.display_name ?? 'Anonymous',
          author_avatar: authorProfiles[p.author_user_id]?.photo_url ?? null,
          author_badge: p.ticket_tier_id ? ticketTiers[p.ticket_tier_id]?.badge_label ?? null : null,
          author_is_organizer: false,
          comments: commentsByPost[p.id] ?? [],
          likes_count: p.like_count ?? 0,
          is_liked: false,
          comment_count: p.comment_count ?? 0,
        }));

        if (!mounted) return;

        setPosts((prev) => (reset ? mapped : [...prev, ...mapped]));

        if (!singleMode && reset && mapped[0] && !activePostId) setActivePostId(mapped[0].id);
        if (!singleMode) setPageFrom(to + 1);
        if (reset) pinToBottom('auto');
      } catch (e: any) {
        console.error(e);
        if (mounted) {
          toast({
            title: 'Error',
            description: e.message || 'Failed to load comments',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) setLoading(false);
        loadingRef.current = false;
      }
    },
    [activePostId, eventId, pageFrom, pinToBottom, singleMode]
  );

  // Reset & load when opened / target changes
  useEffect(() => {
    if (!isOpen || !activePostId) return;

    console.log('🔄 [CommentModal] Resetting and loading:', { activePostId, eventId, singleMode });
    setPosts([]);
    setPageFrom(0);
    setHasMore(false);
    setDraft('');
    setReplyingTo(null);
    void loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, eventId, activePostId, singleMode]);

  // Realtime subscriptions
  useRealtimeComments({
    postIds: singleMode && activePostId ? [activePostId] : undefined,
    eventId: !singleMode ? eventId : undefined,
    onCommentAdded: (comment) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== comment.post_id) return p;

          const existing = p.comments.find((c) => c.id === comment.id);
          if (existing) return p;

          const keyFor = (c: any) =>
            `${c.author_user_id}|${new Date(c.created_at).toISOString().slice(0, 19)}|${(c.text || '').slice(0, 64)}`;

          const pendingIdx = p.comments.findIndex(
            (c) =>
              c.pending &&
              ((c.client_id && comment.client_id && c.client_id === comment.client_id) || keyFor(c) === keyFor(comment))
          );

          if (pendingIdx !== -1) {
            const updated = p.comments.map((c, idx) =>
              idx === pendingIdx
                ? {
                    ...comment,
                    author_name: comment.author_name || 'User',
                    likes_count: 0,
                    is_liked: false,
                    pending: false,
                  }
                : c
            );
            return { ...p, comments: updated };
          }

          const newComment: Comment = {
            id: comment.id,
            text: comment.text,
            author_user_id: comment.author_user_id,
            created_at: comment.created_at,
            author_name: comment.author_name ?? 'Anonymous',
            author_avatar: null,
            likes_count: 0,
            is_liked: false,
            parent_comment_id: (comment as any).parent_comment_id ?? null,
            is_pinned: (comment as any).is_pinned ?? false,
            mentions: (comment as any).mentions ?? [],
            reply_count: 0,
            replies: [],
          };

          if (newComment.parent_comment_id) {
            const nestReply = (comments: Comment[]): Comment[] =>
              comments.map((c) => {
                if (c.id === newComment.parent_comment_id) {
                  return {
                    ...c,
                    replies: [...(c.replies || []), newComment],
                    reply_count: (c.reply_count || 0) + 1,
                  };
                }
                if (c.replies && c.replies.length > 0) {
                  return { ...c, replies: nestReply(c.replies) };
                }
                return c;
              });

            return {
              ...p,
              comments: nestReply(p.comments),
            };
          }

          const updatedPost = {
            ...p,
            comment_count: p.comment_count + 1,
            comments: [...p.comments, newComment],
          };

          onCommentCountChange?.(comment.post_id, updatedPost.comment_count);

          const scroller = scrollRef.current;
          if (scroller) {
            const nearBottom =
              scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
            if (nearBottom) pinToBottom('smooth');
          }
          return updatedPost;
        })
      );
    },
    onCommentDeleted: (comment) => {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== comment.post_id) return p;

          const deleteRecursive = (comments: Comment[]): Comment[] =>
            comments
              .filter((c) => c.id !== comment.id)
              .map((c) => {
                if (c.replies && c.replies.length > 0) {
                  const newReplies = deleteRecursive(c.replies);
                  const replyCountDiff = c.replies.length - newReplies.length;
                  return {
                    ...c,
                    replies: newReplies,
                    reply_count: Math.max(0, (c.reply_count || 0) - replyCountDiff),
                  };
                }
                return c;
              });

          const newComments = deleteRecursive(p.comments);
          const topLevelRemoved = p.comments.length - newComments.length;

          const updatedPost = {
            ...p,
            comment_count: Math.max(0, p.comment_count - topLevelRemoved),
            comments: newComments,
          };

          if (topLevelRemoved > 0) {
            onCommentCountChange?.(comment.post_id, updatedPost.comment_count);
          }

          return updatedPost;
        })
      );
    },
  });

  // --- actions --------------------------------------------------------------
  const handleDeletePost = useCallback(
    async (postIdToDelete: string) => {
      if (!user || deletingPostId) return;

      const postToDelete = posts.find((p) => p.id === postIdToDelete);
      if (!postToDelete || postToDelete.author_user_id !== user.id) {
        toast({
          title: 'Error',
          description: 'You can only delete your own posts',
          variant: 'destructive',
        });
        return;
      }

      if (!confirm('Delete this post? This action cannot be undone.')) {
        return;
      }

      setDeletingPostId(postIdToDelete);

      try {
        const { error } = await supabase
          .from('event_posts')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', postIdToDelete)
          .eq('author_user_id', user.id);
        if (error) throw error;

        toast({
          title: 'Post deleted',
          description: 'Your post has been removed',
          duration: 3000,
        });

        setPosts((prev) => prev.filter((p) => p.id !== postIdToDelete));
        onPostDelete?.(postIdToDelete);

        if (singleMode) {
          onClose();
        }
      } catch (error: any) {
        console.error('Error deleting post:', error);
        toast({
          title: 'Error',
          description: error.message || 'Failed to delete post',
          variant: 'destructive',
          duration: 3000,
        });
      } finally {
        setDeletingPostId(null);
      }
    },
    [user, posts, deletingPostId, singleMode, onClose, onPostDelete]
  );

  const submit = useCallback(async () => {
    if (!draft.trim() || !activePost?.id || overLimit) return;
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to comment',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.username) {
      setSubmitting(false);

      if (onRequestUsername) {
        onRequestUsername();
        return;
      }

      toast({
        title: 'One more step',
        description: 'Set your username to start commenting',
        variant: 'default',
        duration: 4000,
      });
      return;
    }

    setSubmitting(true);

    const clientId = `c_${crypto.randomUUID?.() ?? Date.now()}`;
    const mentions = extractMentions(draft.trim());
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
      parent_comment_id: replyingTo?.id ?? null,
      mentions,
      reply_count: 0,
    };

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== activePost.id) return p;

        if (replyingTo?.id) {
          const nestReply = (comments: Comment[]): Comment[] =>
            comments.map((c) => {
              if (c.id === replyingTo.id) {
                return {
                  ...c,
                  replies: [...(c.replies || []), optimistic],
                  reply_count: (c.reply_count || 0) + 1,
                };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: nestReply(c.replies) };
              }
              return c;
            });

          return {
            ...p,
            comments: nestReply(p.comments),
          };
        }

        const updatedPost = {
          ...p,
          comment_count: p.comment_count + 1,
          comments: [...p.comments, optimistic],
        };
        onCommentCountChange?.(activePost.id, updatedPost.comment_count);
        return updatedPost;
      })
    );
    setDraft('');

    try {
      const { data, error } = await supabase
        .from('event_comments')
        .insert({
          post_id: activePost.id,
          author_user_id: user.id,
          text: optimistic.text,
          client_id: clientId,
          parent_comment_id: replyingTo?.id ?? null,
          mentions,
        })
        .select('id, created_at, client_id')
        .single();
      if (error) throw error;

      setReplyingTo(null);

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== activePost.id) return p;

          const updatePending = (comments: Comment[]): Comment[] =>
            comments.map((c) => {
              if (c.client_id === clientId || c.id === clientId) {
                return { ...c, id: data.id, created_at: data.created_at, pending: false };
              }
              if (c.replies && c.replies.length > 0) {
                return { ...c, replies: updatePending(c.replies) };
              }
              return c;
            });

          return { ...p, comments: updatePending(p.comments) };
        })
      );

      pinToBottom('smooth');
    } catch (e: any) {
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== activePost.id) return p;

          const removePending = (comments: Comment[]): Comment[] =>
            comments
              .filter((c) => c.client_id !== clientId)
              .map((c) => {
                if (c.replies && c.replies.length > 0) {
                  return { ...c, replies: removePending(c.replies) };
                }
                return c;
              });

          return { ...p, comments: removePending(p.comments) };
        })
      );
      toast({
        title: 'Error',
        description: e.message || 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [activePost?.id, draft, onCommentCountChange, overLimit, pinToBottom, replyingTo?.id, user, profile?.username, onRequestUsername]);

  const toggleLikeComment = useCallback(
    async (commentId: string) => {
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to like comments',
          variant: 'destructive',
        });
        return;
      }

      let isLiked = false;
      const findComment = (comments: Comment[]): Comment | null => {
        for (const c of comments) {
          if (c.id === commentId) return c;
          if (c.replies && c.replies.length > 0) {
            const found = findComment(c.replies);
            if (found) return found;
          }
        }
        return null;
      };

      for (const p of posts) {
        const c = findComment(p.comments);
        if (c) {
          isLiked = c.is_liked;
          break;
        }
      }

      const optimistic = !isLiked;

      const updateLike = (comments: Comment[]): Comment[] =>
        comments.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              is_liked: optimistic,
              likes_count: Math.max(0, c.likes_count + (optimistic ? 1 : -1)),
            };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: updateLike(c.replies) };
          }
          return c;
        });

      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          comments: updateLike(p.comments),
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
      } catch {
        const rollbackLike = (comments: Comment[]): Comment[] =>
          comments.map((c) => {
            if (c.id === commentId) {
              return {
                ...c,
                is_liked: !optimistic,
                likes_count: Math.max(0, c.likes_count + (optimistic ? -1 : 1)),
              };
            }
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: rollbackLike(c.replies) };
            }
            return c;
          });

        setPosts((prev) =>
          prev.map((p) => ({
            ...p,
            comments: rollbackLike(p.comments),
          }))
        );
        toast({
          title: 'Error',
          description: 'Failed to update like',
          variant: 'destructive',
        });
      }
    },
    [posts, user]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!user) {
        toast({
          title: 'Sign in required',
          description: 'Please sign in to delete comments',
          variant: 'destructive',
        });
        return;
      }

      const findComment = (comments: Comment[]): Comment | null => {
        for (const c of comments) {
          if (c.id === commentId) return c;
          if (c.replies && c.replies.length > 0) {
            const found = findComment(c.replies);
            if (found) return found;
          }
        }
        return null;
      };

      let authorId: string | null = null;
      for (const p of posts) {
        const c = findComment(p.comments);
        if (c) {
          authorId = c.author_user_id;
          break;
        }
      }

      if (!authorId || authorId !== user.id) {
        toast({
          title: 'Not allowed',
          description: 'You can only delete your own comments.',
          variant: 'destructive',
        });
        return;
      }

      const snapshot = posts;

      const deleteRecursive = (comments: Comment[]): Comment[] =>
        comments
          .filter((c) => c.id !== commentId)
          .map((c) => {
            if (c.replies && c.replies.length > 0) {
              return { ...c, replies: deleteRecursive(c.replies) };
            }
            return c;
          });

      setPosts((prev) => prev.map((p) => ({ ...p, comments: deleteRecursive(p.comments) })));

      try {
        const { error } = await supabase
          .from('event_comments')
          .delete()
          .eq('id', commentId)
          .eq('author_user_id', user.id);
        if (error) throw error;
        toast({ title: 'Deleted', description: 'Your comment was removed.' });
      } catch {
        setPosts(snapshot);
        toast({
          title: 'Error',
          description: 'Failed to delete comment',
          variant: 'destructive',
        });
      }
    },
    [posts, user]
  );

  const togglePinComment = useCallback(
    async (commentId: string, currentlyPinned: boolean) => {
      if (!isOrganizer) {
        toast({
          title: 'Not allowed',
          description: 'Only organizers can pin comments.',
          variant: 'destructive',
        });
        return;
      }

      const snapshot = posts;

      const updatePin = (comments: Comment[]): Comment[] =>
        comments.map((c) => {
          if (c.id === commentId) {
            return { ...c, is_pinned: !currentlyPinned };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: updatePin(c.replies) };
          }
          return c;
        });

      setPosts((prev) =>
        prev.map((p) => ({
          ...p,
          comments: updatePin(p.comments),
        }))
      );

      try {
        const { error } = await supabase
          .from('event_comments')
          .update({ is_pinned: !currentlyPinned } as any)
          .eq('id', commentId);
        if (error) throw error;
        toast({
          title: !currentlyPinned ? 'Pinned' : 'Unpinned',
          description: !currentlyPinned ? 'Comment pinned to top' : 'Comment unpinned',
        });
      } catch (e: any) {
        setPosts(snapshot);
        toast({
          title: 'Error',
          description: e.message || 'Failed to pin comment',
          variant: 'destructive',
        });
      }
    },
    [isOrganizer, posts]
  );

  const startReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
    const textarea = document.querySelector(
      'textarea[placeholder*="comment"], textarea[placeholder*="Reply"]'
    ) as HTMLTextAreaElement | undefined;
    textarea?.focus();
  }, []);

  const cancelReply = useCallback(() => setReplyingTo(null), []);

  const topLevelComments = useMemo(
    () => (activePost ? activePost.comments.filter((c) => !c.parent_comment_id) : []),
    [activePost]
  );

  const renderFullMedia = useCallback((urls: string[]) => {
    if (!urls?.length) return null;
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        {urls.map((raw, idx) => {
          const isMuxHls = raw.includes('stream.mux.com') && raw.includes('.m3u8');
          const videoFile = /\.(mp4|mov|webm)$/i.test(raw);
          const imageFile = isImageUrl(raw);

          if (isMuxHls) {
            const playbackId = raw.split('/').pop()?.replace('.m3u8', '') || '';
            const posterUrl = `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1&width=800&fit_mode=smartcrop`;
            return (
              <div
                key={idx}
                className="relative w-full h-full max-h-[80vh] flex items-center justify-center"
              >
                <video
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  muted
                  preload="metadata"
                  poster={posterUrl}
                >
                  <source src={raw} type="application/x-mpegURL" />
                  <source src={`https://stream.mux.com/${playbackId}/medium.mp4`} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            );
          }

          if (videoFile) {
            return (
              <div
                key={idx}
                className="relative w-full h-full max-h-[80vh] flex items-center justify-center"
              >
                <video
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  muted
                  preload="metadata"
                  src={raw}
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            );
          }

          if (imageFile) {
            return (
              <div
                key={idx}
                className="relative w-full h-full max-h-[80vh] flex items-center justify-center"
              >
                <img src={raw} alt="Post media" className="w-full h-full object-contain" />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }, []);

  const dialogKey = useMemo(
    () => `comment-modal-${postId || mediaPlaybackId || eventId}-${activePostId || 'loading'}`,
    [postId, mediaPlaybackId, eventId, activePostId]
  );

  const hasMedia = !!(activePost && activePost.media_urls && activePost.media_urls.length > 0);
  const shouldShowMedia = !isCommentMode && hasMedia;

  // Shared post header card
  const postHeader = activePost ? (
    <div className="rounded-2xl border bg-card/40 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() =>
            window.open(routes.user(activePost.author_user_id), '_blank', 'noopener,noreferrer')
          }
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
              onClick={() =>
                window.open(routes.user(activePost.author_user_id), '_blank', 'noopener,noreferrer')
              }
              className="font-medium text-sm hover:text-primary transition-colors cursor-pointer"
              title="View profile (new tab)"
            >
              {activePost.author_name}
            </button>

            {activePost.author_is_organizer && (
              <Badge variant="brand" size="sm" className="text-[10px]">
                ORGANIZER
              </Badge>
            )}
            {activePost.author_badge && (
              <Badge variant="neutral" size="sm" className="text-[10px]">
                {activePost.author_badge}
              </Badge>
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

        {user && activePost.author_user_id === user.id && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 hover:bg-accent rounded-full transition-colors"
                aria-label="Post options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleDeletePost(activePost.id)}
                disabled={deletingPostId === activePost.id}
                className="text-red-400 hover:bg-white/10 cursor-pointer disabled:opacity-50"
              >
                <Flag className="h-4 w-4 mr-2" />
                {deletingPostId === activePost.id ? 'Deleting...' : 'Delete Post'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  ) : null;

  // Composer JSX (shared)
  const composer = (
    <>
      {user ? (
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={user.user_metadata?.photo_url || undefined} />
            <AvatarFallback className="text-sm font-medium">
              {user.user_metadata?.display_name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            {user && !profile?.username && (
              <div className="mb-2 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30">
                <div className="flex items-start gap-2">
                  <span className="text-sm text-foreground/90 flex-1">
                    👋 <span className="font-medium">One quick step:</span> Set your username to start
                    commenting
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="h-7 px-3 text-xs"
                    onClick={() => {
                      if (onRequestUsername) {
                        onRequestUsername();
                      } else {
                        toast({
                          title: 'Set Username',
                          description: 'Go to Settings → Profile to set your username',
                          duration: 5000,
                        });
                      }
                    }}
                  >
                    Set Username
                  </Button>
                </div>
              </div>
            )}

            {replyingTo && (
              <div className="mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                <Reply className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground flex-1 truncate">
                  Replying to{' '}
                  <span className="font-medium text-foreground">{replyingTo.author_name}</span>
                </span>
                <button
                  type="button"
                  onClick={cancelReply}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                  aria-label="Cancel reply"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <Textarea
              ref={composerRef}
              value={draft}
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= MAX_LEN + 200) setDraft(val);
              }}
              onClick={() => {
                if (user && !profile?.username) {
                  onRequestUsername?.();
                }
              }}
              placeholder={
                !profile?.username
                  ? '👋 Set your username to start commenting...'
                  : replyingTo
                  ? `Reply to ${replyingTo.author_name}...`
                  : activePost
                  ? 'Write your comment…'
                  : 'Select a post to comment'
              }
              disabled={!activePost || !profile?.username}
              className={`w-full min-h-[52px] max-h-[120px] resize-none text-base rounded-2xl px-4 py-3 ${
                overLimit ? 'border-destructive focus-visible:ring-destructive' : ''
              } ${!profile?.username ? 'cursor-pointer' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              aria-label="Write your comment"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className={`text-xs ${overLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {draft.length}/{MAX_LEN} {overLimit ? '— too long' : ''}
              </span>
              <div className="flex gap-2">
                {activePost?.id && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="min-h-[44px] px-4 rounded-2xl"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(
                          `${window.location.origin}${routes.event(eventId)}?tab=posts&post=${activePost.id}`
                        )
                        .then(() => toast({ title: 'Link copied' }));
                    }}
                    aria-label="Copy link to post"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" /> Copy link
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  className="min-h-[44px] px-6 rounded-2xl font-semibold"
                  onClick={() => {
                    if (!profile?.username) {
                      onRequestUsername?.();
                    } else {
                      submit();
                    }
                  }}
                  disabled={submitting || !activePost || (profile?.username && (!draft.trim() || overLimit))}
                >
                  {submitting ? 'Posting…' : !profile?.username ? 'Set Username' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-base text-center text-muted-foreground py-4">
          Sign in to join the conversation
        </p>
      )}
    </>
  );

  return (
    <Dialog key={dialogKey} open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[1200px] h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden bg-background border-2 border-border dark:border-white/20 shadow-[0_32px_96px_-16px_rgba(0,0,0,0.5)] ring-1 ring-black/10 dark:ring-white/10 rounded-2xl flex flex-col">
        {/* Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2 min-w-0 flex-1">
              <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
              <span className="shrink-0">Comments</span>
              {activePost && (
                <>
                  <span className="text-foreground/40 shrink-0">•</span>
                  <span className="truncate text-foreground/70 text-xs sm:text-sm font-normal">
                    {activePost.text?.substring(0, 40) || eventTitle}
                    {activePost.text && activePost.text.length > 40 ? '...' : ''}
                  </span>
                </>
              )}
            </DialogTitle>

            <div className="flex items-center gap-1 shrink-0">
              {!singleMode && posts.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {posts.indexOf(activePost!) + 1} / {posts.length}
                  </span>
                  <div className="relative">
                    <select
                      className="text-xs sm:text-sm bg-muted/40 hover:bg-muted/60 border border-border rounded-lg px-3 py-1.5 pr-7 cursor-pointer transition-colors"
                      value={activePost?.id ?? ''}
                      onChange={(e) => setActivePostId(e.target.value)}
                      aria-label="Choose a post"
                    >
                      {posts.map((p, idx) => (
                        <option key={p.id} value={p.id} title={p.text}>
                          Post {idx + 1}: {p.text?.slice(0, 30) || 'View'}{p.text && p.text.length > 30 ? '…' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/75" />
                  </div>
                </div>
              )}

              {singleMode && activePost?.id && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-foreground/60 hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`${window.location.origin}${routes.event(eventId)}?tab=posts&post=${activePost.id}`)
                      .then(() => toast({ title: 'Link copied' }));
                  }}
                  aria-label="Copy link to this post"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* BODY */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          {/* Media + caption column */}
          {shouldShowMedia && (
            <div className="lg:w-[52%] xl:w-[55%] flex flex-col border-b lg:border-b-0 lg:border-r border-border/60 bg-black shrink-0">
              <div className="flex items-center justify-center h-[180px] lg:flex-1 lg:h-auto lg:max-h-none">
                {activePost?.media_urls?.length ? renderFullMedia(activePost.media_urls) : null}
              </div>
              {postHeader && (
                <div className="bg-background px-3 sm:px-6 py-2 sm:py-3 border-t border-border/60 shrink-0">
                  {postHeader}
                </div>
              )}
            </div>
          )}

          {/* Comment column */}
          <div className="flex-1 flex flex-col min-h-0 bg-background">
            {!shouldShowMedia && postHeader && (
              <div className="bg-background px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border/60">
                {postHeader}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-6 min-h-0">
              <div className="space-y-5 max-w-[680px] mx-auto">
                {(!activePost || loading) && posts.length === 0 ? (
                  <div className="space-y-3" aria-live="polite">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="border rounded-lg p-4" aria-busy>
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
                    <div className="space-y-3" aria-live="polite">
                      {topLevelComments.map((comment) => (
                        <CommentItem
                          key={comment.id}
                          comment={comment}
                          currentUserId={user?.id}
                          mine={user?.id === comment.author_user_id}
                          depth={0}
                          onLike={toggleLikeComment}
                          onReply={startReply}
                          onDelete={deleteComment}
                          onTogglePin={togglePinComment}
                          isOrganizer={isOrganizer}
                        />
                      ))}
                      {topLevelComments.length === 0 && (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          Be the first to comment.
                        </div>
                      )}
                      <div ref={bottomSentinelRef} />
                    </div>

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
            </div>

            <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border safe-bottom px-4 sm:px-6 py-4 sm:py-5">
              <div className="max-w-[680px] mx-auto">{composer}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
