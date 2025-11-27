import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { X, Reply, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { Comment, Post } from "@/domain/posts";
import { CommentItem } from "./CommentItem";
import { useCommentActions } from '@/features/comments/hooks/useCommentActions';
import { routes } from "@/lib/routes";

const MAX_LEN = 1000;

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

      {/* Align sheet with viewer frame: full-width mobile, right side on desktop */}
      <div className="relative z-[71] mx-auto flex w-full max-w-full justify-center px-0 sm:max-w-6xl sm:justify-end sm:px-4">
        {/* Sheet */}
        <div
          ref={sheetRef}
          className={`
            relative z-[72] flex w-full max-w-full flex-col overflow-hidden
            rounded-t-2xl border-2 border-border/90 bg-card
            shadow-[0_-20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl
            max-h-[78vh]
            sm:mb-6 sm:max-w-[420px] sm:rounded-2xl
            transform transition-transform duration-200 ease-out
            ${open ? "translate-y-0" : "translate-y-full"}
          `}
        >
          {/* Grab handle */}
          <div className="flex items-center justify-center pt-2 pb-1">
            <div className="h-1.5 w-10 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b-2 border-border bg-muted/30 px-4 pb-3 pt-3 sm:pt-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-base font-bold tracking-tight text-foreground">Comments</h2>
              {post?.comment_count !== undefined && (
                <span className="text-xs font-medium text-muted-foreground">
                  {post.comment_count} total
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {post?.id && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={copyPostLink}
                  aria-label="Copy link to this post"
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
                aria-label="Close comments"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Caption inside sheet */}
          {post?.text && (
            <div className="border-b-2 border-border/80 bg-muted/40 px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Caption
              </p>
              <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm font-medium text-foreground leading-relaxed">
                {post.text}
              </p>
            </div>
          )}

          {/* Comments scroll area */}
          <div className="flex-1 overflow-y-auto bg-background px-4 py-4 sm:px-5 sm:py-5">
            <div className="space-y-2">
              {topLevelComments.map((comment) => (
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
              ))}

              {topLevelComments.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Be the first to comment.
                </div>
              )}

              <div ref={bottomSentinelRef} />
            </div>
          </div>

          {/* Composer */}
          <div className="border-t-2 border-border bg-muted/30 px-4 py-4 backdrop-blur-xl sm:px-5">
            {user ? (
              <div className="space-y-2">
                {user && !canComment && (
                  <div className="mb-2 rounded-xl border-2 border-primary/30 bg-primary/10 px-3 py-2 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex-1 text-xs font-medium text-foreground">
                        Set a username to start commenting
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-7 px-3 text-xs font-semibold shadow-sm"
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
                  <div className="mb-1 flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2.5 backdrop-blur-sm">
                    <Reply className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-xs text-muted-foreground">
                      Replying to{" "}
                      <span className="font-semibold text-foreground">
                        {replyingTo.author_name}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={cancelReply}
                      className="rounded-lg p-1.5 transition-all duration-200 hover:bg-muted"
                      aria-label="Cancel reply"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Avatar className="h-9 w-9 flex-shrink-0 ring-2 ring-border">
                    <AvatarImage
                      src={user.user_metadata?.photo_url || undefined}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary/40 text-xs font-semibold">
                      {user.user_metadata?.display_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-2">
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
                          ? "Set your username to start commenting…"
                          : replyingTo
                          ? `Reply to ${replyingTo.author_name}…`
                          : post
                          ? "Write your comment…"
                          : "No post selected"
                      }
                      disabled={!post || !canComment}
                      className={`w-full min-h-[44px] max-h-[100px] resize-none rounded-xl border-2 px-3 py-2 text-sm transition-all ${
                        overLimit
                          ? "border-destructive focus-visible:ring-destructive"
                          : "border-border/60 focus-visible:border-primary/60"
                      } ${
                        !canComment
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
                        className={`text-[11px] font-medium ${
                          overLimit
                            ? "text-destructive"
                            : draft.length > MAX_LEN * 0.9
                            ? "text-yellow-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {draft.length}/{MAX_LEN}
                        {overLimit && " — Character limit exceeded"}
                      </span>

                      <Button
                        type="button"
                        size="sm"
                        className="h-9 rounded-xl px-4 font-semibold shadow-sm"
                        onClick={() => {
                          if (!canComment) {
                            onRequestUsername?.();
                          } else {
                            handleSubmit();
                          }
                        }}
                        disabled={
                          submitting ||
                          !post ||
                          (canComment && (!draft.trim() || overLimit))
                        }
                      >
                        {submitting
                          ? "Posting…"
                          : !canComment
                          ? "Set username"
                          : "Post"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-muted-foreground">
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
