import React, { useCallback, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useUnifiedFeedInfinite } from '@/hooks/useUnifiedFeedInfinite';
import { EventCard } from '@/components/EventCard';
import { UserPostCard } from '@/components/UserPostCard';

// Keep item height stable; adjust if your cards differ
const ITEM_HEIGHT = 132;

export default function UnifiedFeedList() {
  const {
    status,
    items,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useUnifiedFeedInfinite();

  const onItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }) => {
      if (hasNextPage && !isFetchingNextPage && visibleStopIndex > items.length - 8) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, items.length, fetchNextPage]
  );

  if (status === 'pending') return <FeedSkeleton />;
  if (status === 'error') return <div className="p-4 text-sm text-red-600">Couldn't load feed.</div>;

  return (
    <div className="h-[calc(100vh-80px)] w-full">
      <AutoSizer>
        {({ height, width }) => (
          <List
            height={height}
            width={width}
            itemCount={items.length}
            itemSize={ITEM_HEIGHT}
            onItemsRendered={onItemsRendered as any}
          >
            {({ index, style }) => <Row index={index} style={style} items={items} />}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}

const Row = memo(function Row({
  index,
  style,
  items,
}: {
  index: number;
  style: React.CSSProperties;
  items: Array<any>;
}) {
  const it = items[index];
  if (!it) return null;
  return it.kind === 'event'
    ? <EventCard key={it.id} style={style} event={it} />
    : <UserPostCard key={it.id} style={style} post={it} />;
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
