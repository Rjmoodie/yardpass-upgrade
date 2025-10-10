import { Play } from 'lucide-react';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { isVideoUrl } from '@/utils/mux';
import { muxToPoster } from '@/utils/media';

export type MediaPost = {
  id: string;
  media_urls?: string[] | null;
  text?: string | null;
  author_name?: string | null;
};

export type MediaPostGridTone = 'light' | 'dark';

const TONE_STYLES: Record<MediaPostGridTone, {
  tile: string;
  textFallback: string;
  emptyWrapper: string;
  emptyTitle: string;
  emptyDescription: string;
  skeleton: string;
}> = {
  light: {
    tile:
      'border border-border/60 bg-background/80 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-primary',
    textFallback: 'bg-muted/40 text-muted-foreground',
    emptyWrapper: 'border-dashed border-border/60 bg-muted/30 text-foreground',
    emptyTitle: 'text-foreground',
    emptyDescription: 'text-muted-foreground',
    skeleton: 'border border-border/40 bg-muted/30',
  },
  dark: {
    tile:
      'border border-white/10 bg-white/5 transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-primary',
    textFallback: 'bg-gradient-to-br from-white/5 to-white/10 text-white/70',
    emptyWrapper: 'border-dashed border-white/15 bg-white/5 text-white',
    emptyTitle: 'text-white',
    emptyDescription: 'text-white/70',
    skeleton: 'border border-white/10 bg-white/5',
  },
};

export function MediaPostGridSkeleton({
  count = 9,
  tone = 'light',
}: {
  count?: number;
  tone?: MediaPostGridTone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <Skeleton key={idx} className={`aspect-square rounded-2xl ${styles.skeleton}`} />
      ))}
    </div>
  );
}

function MediaPostGridEmptyState({
  title,
  description,
  tone = 'light',
}: {
  title: string;
  description: string;
  tone?: MediaPostGridTone;
}) {
  const styles = TONE_STYLES[tone];
  return (
    <div
      className={`flex h-48 flex-col items-center justify-center gap-2 rounded-2xl px-6 text-center ${styles.emptyWrapper}`}
    >
      <p className={`text-sm font-semibold ${styles.emptyTitle}`}>{title}</p>
      <p className={`text-xs ${styles.emptyDescription}`}>{description}</p>
    </div>
  );
}

interface MediaPostGridProps<TPost extends MediaPost> {
  posts: TPost[];
  isLoading: boolean;
  loadingMore?: boolean;
  onSelect: (post: TPost) => void;
  loadMoreRef?: (node: HTMLElement | null) => void;
  fallbackImage: string;
  emptyTitle: string;
  emptyDescription: string;
  tone?: MediaPostGridTone;
}

export function MediaPostGrid<TPost extends MediaPost>({
  posts,
  isLoading,
  loadingMore = false,
  onSelect,
  loadMoreRef,
  fallbackImage,
  emptyTitle,
  emptyDescription,
  tone = 'light',
}: MediaPostGridProps<TPost>) {
  if (isLoading) {
    return <MediaPostGridSkeleton tone={tone} />;
  }

  if (!posts.length) {
    return (
      <MediaPostGridEmptyState
        title={emptyTitle}
        description={emptyDescription}
        tone={tone}
      />
    );
  }

  const styles = TONE_STYLES[tone];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        {posts.map((post) => {
          const mediaUrl = post.media_urls?.[0] ?? null;
          const isVideo = Boolean(mediaUrl && isVideoUrl(mediaUrl));
          const posterUrl = isVideo ? muxToPoster(mediaUrl) : null;
          const preview = posterUrl || mediaUrl || fallbackImage;

          return (
            <button
              key={post.id}
              type="button"
              onClick={() => onSelect(post)}
              className={`relative aspect-square overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 ${styles.tile}`}
              aria-label={post.author_name ? `View post from ${post.author_name}` : 'View post'}
            >
              {mediaUrl ? (
                <ImageWithFallback
                  src={preview}
                  alt={post.author_name ? `Post from ${post.author_name}` : 'Event post media'}
                  fallback={fallbackImage}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center px-4 text-center text-xs ${styles.textFallback}`}>
                  {post.text ? post.text.slice(0, 120) : 'Post'}
                </div>
              )}

              {isVideo && (
                <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white">
                  <Play className="h-3.5 w-3.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div ref={loadMoreRef} />

      {loadingMore && <MediaPostGridSkeleton tone={tone} count={3} />}
    </div>
  );
}
