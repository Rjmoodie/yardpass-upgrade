import React, { useCallback, memo } from 'react';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { useEventPostsInfinite } from '@/hooks/useEventPostsInfinite';
import { UserPostCard } from '@/components/UserPostCard';
import { useAuth } from '@/contexts/AuthContext';

// Keep item height stable; adjust if your cards differ
const ITEM_HEIGHT = 132;

interface EventPostsListProps {
  eventId: string;
}

export default function EventPostsList({ eventId }: EventPostsListProps) {
  const { user } = useAuth();
  
  const {
    status,
    items,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useEventPostsInfinite(eventId, user?.id);

  const onItemsRendered = useCallback(
    ({ visibleStopIndex }: { visibleStopIndex: number }) => {
      if (hasNextPage && !isFetchingNextPage && visibleStopIndex > items.length - 8) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, items.length, fetchNextPage]
  );

  if (status === 'pending') return <PostsSkeleton />;
  if (status === 'error') return <div className="p-4 text-sm text-red-600">Couldn't load posts.</div>;

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
  const post = items[index];
  if (!post) return null;
  
  // Transform the post data to match UserPostCard expectations
  const transformedPost = {
    ...post,
    kind: 'post' as const,
    // Add any additional transformations needed
  };
  
  return <UserPostCard key={post.id} style={style} post={transformedPost} />;
});

function PostsSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-[132px] w-full animate-pulse rounded-xl bg-gray-200/60" />
      ))}
    </div>
  );
}
