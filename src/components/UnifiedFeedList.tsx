import React, { useCallback, memo, useEffect, useMemo, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useUnifiedFeedInfinite } from '@/hooks/useUnifiedFeedInfinite';
import { EventCard } from '@/components/EventCard';
import { UserPostCard } from '@/components/UserPostCard';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';
import { supabase } from '@/integrations/supabase/client';
import { useImpressionTracker } from '@/hooks/useImpressionTracker';

const ITEM_HEIGHT = 132;

export default function UnifiedFeedList() {
  const { items, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useUnifiedFeedInfinite(30);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    function onNext() {
      setCurrentIndex((idx) => Math.min(items.length - 1, idx + 1));
    }
    function onPrev() {
      setCurrentIndex((idx) => Math.max(0, idx - 1));
    }
    window.addEventListener('feed:next', onNext);
    window.addEventListener('feed:prev', onPrev);
    return () => {
      window.removeEventListener('feed:next', onNext);
      window.removeEventListener('feed:prev', onPrev);
    };
  }, [items.length]);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && currentIndex > items.length - 8) {
      fetchNextPage();
    }
  }, [currentIndex, fetchNextPage, hasNextPage, isFetchingNextPage, items.length]);

  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? undefined);
    });
  }, []);

  useImpressionTracker({ items, currentIndex, userId, isSuspended: suspended });

  const onItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }) => {
      if (hasNextPage && !isFetchingNextPage && visibleStopIndex > items.length - 8) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, items.length, fetchNextPage],
  );

  const handleOpenTickets = useCallback((eventId: string) => {
    window.dispatchEvent(new CustomEvent('feed:open-tickets', { detail: { eventId } }));
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    window.dispatchEvent(new CustomEvent('feed:navigate', { detail: { eventId } }));
  }, []);

  const handleLike = useCallback((postId: string) => {
    window.dispatchEvent(new CustomEvent('feed:like', { detail: { postId } }));
  }, []);

  const handleComment = useCallback((postId: string) => {
    window.dispatchEvent(new CustomEvent('feed:comment', { detail: { postId } }));
  }, []);

  const handleShare = useCallback((postId: string) => {
    window.dispatchEvent(new CustomEvent('feed:share', { detail: { postId } }));
  }, []);

  const handleAuthorClick = useCallback((authorId: string) => {
    window.dispatchEvent(new CustomEvent('feed:author', { detail: { authorId } }));
  }, []);

  const rowItems = useMemo(() => items as FeedItem[], [items]);

  if (status === 'pending') return <FeedSkeleton />;
  if (status === 'error') return <div className="p-4 text-sm text-red-600">Couldn't load feed.</div>;

  return (
    <div className="h-[calc(100vh-80px)] w-full" onMouseEnter={() => setSuspended(true)} onMouseLeave={() => setSuspended(false)}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={rowItems.length}
            itemSize={ITEM_HEIGHT}
            onItemsRendered={onItemsRendered as any}
          >
            {({ index, style }) => (
              <Row
                index={index}
                style={style}
                items={rowItems}
                onEventClick={handleEventClick}
                onOpenTickets={handleOpenTickets}
                onLike={handleLike}
                onComment={handleComment}
                onShare={handleShare}
                onAuthorClick={handleAuthorClick}
              />
            )}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}

type RowProps = {
  index: number;
  style: React.CSSProperties;
  items: FeedItem[];
  onEventClick: (eventId: string) => void;
  onOpenTickets: (eventId: string) => void;
  onLike: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (postId: string) => void;
  onAuthorClick: (authorId: string) => void;
};

const Row = memo(function Row({
  index,
  style,
  items,
  onEventClick,
  onOpenTickets,
  onLike,
  onComment,
  onShare,
  onAuthorClick,
}: RowProps) {
  const item = items[index];
  if (!item) return null;

  return (
    <div style={style} className="px-2 py-3">
      {item.item_type === 'event' ? (
        <EventCard
          item={item}
          onOpenTickets={onOpenTickets}
          onEventClick={onEventClick}
          onCreatePost={undefined}
          onReport={undefined}
          onSoundToggle={undefined}
          onVideoToggle={undefined}
          soundEnabled
          isVideoPlaying={false}
        />
      ) : (
        <UserPostCard
          item={item}
          onLike={(postId, event) => {
            event?.stopPropagation?.();
            onLike(postId);
          }}
          onComment={onComment}
          onShare={onShare}
          onEventClick={onEventClick}
          onAuthorClick={onAuthorClick}
          onCreatePost={undefined}
          onReport={undefined}
          onSoundToggle={undefined}
          onVideoToggle={undefined}
          onOpenTickets={onOpenTickets}
          soundEnabled
          isVideoPlaying={false}
        />
      )}
    </div>
  );
});

function FeedSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[132px] w-full animate-pulse rounded-xl bg-gray-200/60" />
      ))}
    </div>
  );
}
