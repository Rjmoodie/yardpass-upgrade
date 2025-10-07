import React, { memo, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import LoadingSpinner from './LoadingSpinner';
import { fetchOrgEvents } from '@/lib/api/events';

export const EventsList = memo(function EventsList({ orgId }: { orgId: string | null }) {
  const { data, isLoading } = useQuery({
    queryKey: ['events', { orgId }],
    queryFn: () => fetchOrgEvents({ orgId, page: 1, limit: 500 }),
    enabled: !!orgId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const events = data ?? [];

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  });

  const renderRow = useCallback((idx: number) => {
    const ev = events[idx];
  return (
      <div key={ev.id} className="px-3 py-2 flex items-center justify-between">
        <div className="font-medium truncate">{ev.title}</div>
        <div className="text-sm opacity-70">{new Date(ev.start_at).toLocaleString()}</div>
      </div>
    );
  }, [events]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div ref={parentRef} className="h-[60vh] overflow-auto border rounded-xl">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map(vi => (
          <div
            key={vi.key}
            className="absolute left-0 right-0"
            style={{ transform: `translateY(${vi.start}px)` }}
          >
            {renderRow(vi.index)}
              </div>
        ))}
      </div>
    </div>
  );
});