import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { X, Reply, MessageCircle, Link as LinkIcon, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { Comment, Post } from "@/domain/posts";
import { CommentItem } from "./CommentItem";
import { useCommentActions } from '@/features/comments/hooks/useCommentActions';
import { routes } from "@/lib/routes";

const MAX_LEN = 1000;

// Skeleton component for loading states
function CommentSkeleton() {
  return (
    <div className="flex items-start gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-4 w-24 bg-muted rounded" />
          <div className="h-3 w-16 bg-muted rounded" />
        </div>
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-3/4 bg-muted rounded" />
      </div>
    </div>
  );
}

function PostHeaderSkeleton() {
  return (
    <div className="rounded-2xl border bg-card/40 p-3 sm:p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
        </div>
      </div>
    </div>
  );
}

export type CommentsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  post: Post | null;
  setPost: React.Dispatch<React.SetStateAction<Post | null>>;
  user: any;
  profileUsername?: string | null;
  isOrganizer: boolean;
  onRequestUsername?: () => void;
  /** Show loading skeleton while post data is being fetched */
  loading?: boolean;
};

export function CommentsSheet({
  open,
  onOpenChange,
  eventId,
  post,
  setPost,
  user,
  profileUsername,
  isOrganizer,
  onRequestUsername,
  loading = false,
}: CommentsSheetProps) {
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  // ✅ internal mount state so we can animate out before unmounting
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
    } else {
      // match this with duration-200 below
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const overLimit = draft.length > MAX_LEN;
  const canComment = !!profileUsername;
  const { submit, submitting, toggleLikeComment, deleteComment } =
    useCommentActions({
      post,
      setPost,
      user,
      profileUsername,
      onRequestUsername,
    });

  // Scroll to bottom after a comment is posted / sheet opened
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
    return () => clearTimeout(t);
  }, [open, post?.comment_count]);

  const topLevelComments = useMemo(
    () => (post ? post.comments.filter((c) => !c.parent_comment_id) : []),
    [post],
  );

  const startReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
    const textarea = document.querySelector(
      'textarea[aria-label="Write your comment"]',
    ) as HTMLTextAreaElement | null;
    textarea?.focus();
  }, []);

  const cancelReply = useCallback(() => setReplyingTo(null), []);

  const copyPostLink = useCallback(() => {
    if (!post?.id) return;
    const url = `${window.location.origin}${routes.event(
      eventId,
    )}?tab=posts&post=${post.id}`;
    navigator.clipboard.writeText(url).then(() =>
      toast({ title: "Link copied", duration: 2000 }),
    );
  }, [post?.id, eventId]);

  const handleSubmit = useCallback(() => {
    if (!post || !draft.trim() || overLimit) return;
    submit(draft, replyingTo);
    setDraft("");
    setReplyingTo(null);

    setTimeout(() => {
      bottomSentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  }, [post, draft, overLimit, submit, replyingTo]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // ⛔️ fully unmount only after exit animation
  if (!visible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-[70] flex items-end justify-center
        transition-opacity duration-200
        ${open ? "opacity-100" : "pointer-events-none opacity-0"}
      `}
    >
      {/* Backdrop */}
      <div
        className={`
          absolute inset-0 bg-black/60 backdrop-blur-sm
          transition-opacity duration-200
          ${open ? "opacity-100" : "opacity-0"}
        `}
        onClick={() => onOpenChange(false)}
      />

      {/* Align sheet with viewer frame: full-width mobile, constrained on tablet/desktop */}
      <div className="relative z-[71] mx-auto flex w-full max-w-full justify-center px-0 sm:px-4 lg:max-w-6xl lg:justify-end">
        {/* Sheet - responsive sizing */}
        <div
          ref={sheetRef}
          className={`
            relative z-[72] flex w-full flex-col overflow-hidden
            rounded-t-2xl border border-border/80 bg-card
            shadow-[0_-20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl
            max-h-[85vh] sm:max-h-[80vh]
            sm:mb-4 sm:max-w-[440px] sm:rounded-2xl
            md:max-w-[480px] lg:max-w-[420px]
            transform transition-transform duration-200 ease-out
            ${open ? "translate-y-0" : "translate-y-full"}
          `}
        >
          {/* Grab handle */}
          <div className="flex items-center justify-center pt-2 pb-1">
            <div className="h-1.5 w-10 rounded-full bg-border" />
          </div>

          {/* Header - matches CommentModal styling */}
          <div className="flex items-center justify-between gap-3 border-b border-border/80 bg-background/95 backdrop-blur-md px-3 sm:px-4 pb-2.5 sm:pb-3 pt-2.5 sm:pt-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                ) : (
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Comments
                </span>
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {loading ? (
                    <span className="inline-block w-16 h-3 bg-muted rounded animate-pulse" />
                  ) : (
                    <>
                      {post?.comment_count ?? topLevelComments.length} comment{(post?.comment_count ?? topLevelComments.length) === 1 ? '' : 's'}
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              {post?.id && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-foreground/60 hover:text-foreground transition-colors"
                  onClick={copyPostLink}
                  aria-label="Copy link to this post"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 sm:h-8 sm:w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                onClick={() => onOpenChange(false)}
                aria-label="Close comments"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Post author card - matches CommentModal styling */}
          <div className="border-b border-border/60 bg-background px-3 sm:px-4 py-2.5 sm:py-3">
            {loading ? (
              <PostHeaderSkeleton />
            ) : post ? (
              <div className="rounded-xl sm:rounded-2xl border bg-card/40 p-2.5 sm:p-4">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <Avatar className="w-8 h-8 sm:w-9 sm:h-9 shrink-0">
                    <AvatarImage src={post.author_avatar || undefined} />
                    <AvatarFallback className="text-xs bg-primary/20 text-primary">
                      {post.author_name?.charAt(0) || 'A'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                        {post.author_name || 'Anonymous'}
                      </span>
                      {post.author_is_organizer && (
                        <Badge variant="default" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4">
                          ORGANIZER
                        </Badge>
                      )}
                      {post.author_badge && (
                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0 h-4">
                          {post.author_badge}
                        </Badge>
                      )}
                      <span className="text-[10px] sm:text-xs text-muted-foreground">
                        {post.created_at ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true }) : ''}
                      </span>
                    </div>

                    {post.text && (
                      <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm text-foreground/90 leading-relaxed line-clamp-3 whitespace-pre-wrap break-words">
                        {post.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border bg-card/40 p-4 text-center">
                <p className="text-sm text-muted-foreground">No post selected</p>
              </div>
            )}
          </div>

          {/* Comments scroll area */}
          <div className="flex-1 overflow-y-auto bg-background px-3 sm:px-4 py-3 sm:py-4 min-h-0">
            <div className="space-y-2 sm:space-y-3">
              {loading ? (
                // Loading skeletons
                <div className="space-y-4">
                  <CommentSkeleton />
                  <CommentSkeleton />
                  <CommentSkeleton />
                </div>
              ) : topLevelComments.length > 0 ? (
                topLevelComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    currentUserId={user?.id}
                    depth={0}
                    isOrganizer={isOrganizer}
                    onLike={toggleLikeComment}
                    onReply={startReply}
                    onDelete={deleteComment}
                    onTogglePin={() => {
                      // pin/unpin not wired here; reuse your existing pin logic if needed
                    }}
                  />
                ))
              ) : (
                // Empty state
                <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                  <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-muted/50 mb-3">
                    <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No comments yet</p>
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    Be the first to share your thoughts!
                  </p>
                </div>
              )}

              <div ref={bottomSentinelRef} className="h-1" />
            </div>
          </div>

          {/* Composer - sticky bottom with safe area */}
          <div className="border-t border-border bg-background/95 backdrop-blur-xl px-3 sm:px-4 py-3 sm:py-4 safe-bottom">
            {user ? (
              <div className="space-y-2">
                {user && !canComment && (
                  <div className="mb-2 rounded-lg sm:rounded-xl border border-primary/30 bg-primary/5 px-2.5 sm:px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      <span className="flex-1 text-[11px] sm:text-xs font-medium text-foreground">
                        Set a username to start commenting
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-6 sm:h-7 px-2.5 sm:px-3 text-[10px] sm:text-xs font-semibold shadow-sm"
                        onClick={() => {
                          onRequestUsername?.();
                        }}
                      >
                        Set username
                      </Button>
                    </div>
                  </div>
                )}

                {replyingTo && (
                  <div className="mb-1 flex items-center gap-2 rounded-lg sm:rounded-xl border border-border bg-muted/40 px-2.5 sm:px-3 py-2 backdrop-blur-sm">
                    <Reply className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-[11px] sm:text-xs text-muted-foreground">
                      Replying to{" "}
                      <span className="font-semibold text-foreground">
                        {replyingTo.author_name}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={cancelReply}
                      className="rounded-md p-1 sm:p-1.5 transition-all duration-200 hover:bg-muted"
                      aria-label="Cancel reply"
                    >
                      <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 ring-2 ring-border">
                    <AvatarImage
                      src={user.user_metadata?.photo_url || undefined}
                    />
                    <AvatarFallback className="bg-primary/20 text-primary text-[10px] sm:text-xs font-semibold">
                      {user.user_metadata?.display_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-1.5 sm:space-y-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.length <= MAX_LEN + 200) setDraft(val);
                      }}
                      onClick={() => {
                        if (user && !canComment) {
                          onRequestUsername?.();
                        }
                      }}
                      placeholder={
                        !canComment
                          ? "Set your username to comment…"
                          : replyingTo
                          ? `Reply to ${replyingTo.author_name}…`
                          : post
                          ? "Write your comment…"
                          : "No post selected"
                      }
                      disabled={!post || !canComment || loading}
                      className={`w-full min-h-[40px] sm:min-h-[44px] max-h-[80px] sm:max-h-[100px] resize-none rounded-lg sm:rounded-xl border px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition-all ${
                        overLimit
                          ? "border-destructive focus-visible:ring-destructive"
                          : "border-border/60 focus-visible:border-primary/60"
                      } ${
                        !canComment || loading
                          ? "cursor-pointer bg-muted/30"
                          : "bg-background"
                      }`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit();
                        }
                      }}
                      aria-label="Write your comment"
                    />

                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] sm:text-[11px] font-medium ${
                          overLimit
                            ? "text-destructive"
                            : draft.length > MAX_LEN * 0.9
                            ? "text-yellow-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {draft.length}/{MAX_LEN}
                        {overLimit && (
                          <span className="hidden sm:inline"> — Character limit exceeded</span>
                        )}
                      </span>

                      <Button
                        type="button"
                        size="sm"
                        className="h-8 sm:h-9 rounded-lg sm:rounded-xl px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-sm min-w-[60px]"
                        onClick={() => {
                          if (!canComment) {
                            onRequestUsername?.();
                          } else {
                            handleSubmit();
                          }
                        }}
                        disabled={
                          submitting ||
                          loading ||
                          !post ||
                          (canComment && (!draft.trim() || overLimit))
                        }
                      >
                        {submitting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : !canComment ? (
                          "Set username"
                        ) : (
                          "Post"
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-3 sm:py-4 text-center">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Sign in to join the conversation
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
