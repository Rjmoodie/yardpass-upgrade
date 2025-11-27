import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, Reply, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { routes } from "@/lib/routes";
import { ReportButton } from "@/components/ReportButton";
import type { Comment } from "@/domain/posts";

function parseRichText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(https?:\/\/[^\s]+)|(@\w+)/g;
  const matches = Array.from(text.matchAll(regex));
  let lastIndex = 0;

  matches.forEach((match, i) => {
    if (match.index! > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith("@")) {
      parts.push(
        <span
          key={`m-${i}`}
          className="text-primary font-medium"
          data-username={token.slice(1)}
        >
          {token}
        </span>,
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
        </a>,
      );
    }

    lastIndex = match.index! + token.length;
  });

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : [text];
}

export type CommentItemProps = {
  comment: Comment;
  currentUserId?: string | null;
  depth: number;
  isOrganizer: boolean;
  onLike: (id: string) => void;
  onReply: (c: Comment) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
};

export const CommentItem = memo(function CommentItem({
  comment: c,
  currentUserId,
  depth,
  isOrganizer,
  onLike,
  onReply,
  onDelete,
  onTogglePin,
}: CommentItemProps) {
  const mine = currentUserId === c.author_user_id;

  return (
    <div className={depth > 0 ? "ml-8 mt-2" : ""}>
      <div
        className={`group flex items-start gap-2 sm:gap-3 py-2.5 ${
          mine ? "flex-row-reverse text-right" : ""
        } ${c.pending ? "opacity-70" : ""}`}
      >
        <button
          type="button"
          onClick={() =>
            window.open(
              routes.user(c.author_user_id),
              "_blank",
              "noopener,noreferrer",
            )
          }
          className={`mt-0.5 rounded-full focus:outline-none focus:ring-2 focus:ring-primary ${
            mine ? "order-last" : ""
          }`}
          aria-label={`Open ${c.author_name || "user"} profile in new tab`}
        >
          <Avatar className="w-8 h-8 ring-2 ring-border">
            <AvatarImage src={c.author_avatar || undefined} />
            <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary/40">
              {c.author_name?.charAt(0) || "A"}
            </AvatarFallback>
          </Avatar>
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={`rounded-2xl px-3 py-2 text-xs sm:text-sm leading-relaxed break-words shadow-sm transition-colors ${
              mine
                ? "bg-primary/15 text-foreground"
                : "bg-card text-foreground border border-border/60 group-hover:border-border group-hover:bg-muted/40"
            } ${c.pending ? "opacity-70" : ""} ${
              c.is_pinned ? "ring-2 ring-primary/40" : ""
            }`}
            title={c.pending ? "Sending…" : undefined}
          >
            <div className="mb-1 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      routes.user(c.author_user_id),
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="font-medium text-[11px] sm:text-xs hover:text-primary transition-colors"
                  title="View profile (new tab)"
                >
                  {c.author_name}
                </button>
                {c.is_pinned && (
                  <Badge
                    variant="neutral"
                    className="border-primary/50 text-primary bg-primary/10 text-[9px] px-1.5 py-0 h-4 gap-0.5"
                  >
                    <Reply className="w-2.5 h-2.5 rotate-180" /> Pinned
                  </Badge>
                )}
              </div>

              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(c.created_at), {
                  addSuffix: true,
                })}
                {c.pending ? " · sending…" : ""}
              </span>
            </div>

            <div className="whitespace-pre-wrap">{parseRichText(c.text)}</div>
          </div>

          <div
            className={`mt-1 flex items-center ${
              mine ? "justify-end" : "justify-start"
            } gap-3 text-[11px] text-muted-foreground flex-wrap`}
          >
            <button
              type="button"
              onClick={() => {
                if (!c.pending) onLike(c.id);
              }}
              className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                c.is_liked ? "text-red-500" : ""
              } ${c.pending ? "pointer-events-none opacity-60" : ""}`}
              aria-label={c.is_liked ? "Unlike comment" : "Like comment"}
            >
              <Heart
                className={`w-3 h-3 ${
                  c.is_liked ? "fill-current" : ""
                }`}
              />
              {c.likes_count > 0 && <span>{c.likes_count}</span>}
            </button>

            {!c.pending && depth < 2 && (
              <button
                type="button"
                onClick={() => onReply(c)}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                aria-label="Reply to comment"
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
                aria-label={c.is_pinned ? "Unpin comment" : "Pin comment"}
              >
                <Reply className="w-3 h-3 rotate-180" />{" "}
                {c.is_pinned ? "Unpin" : "Pin"}
              </button>
            )}

            {mine && !c.pending && (
              <button
                type="button"
                onClick={() => onDelete(c.id)}
                className="inline-flex items-center gap-1 hover:text-destructive transition-colors"
                aria-label="Delete comment"
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

          {c.replies && c.replies.length > 0 && (
            <div className="mt-2 space-y-2 border-l-2 border-border/50 pl-2">
              {c.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  currentUserId={currentUserId}
                  depth={depth + 1}
                  isOrganizer={isOrganizer}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  onTogglePin={onTogglePin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

