import React, { memo, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import LoadingSpinner from './LoadingSpinner';
import { fetchOrgEvents } from '@/lib/api/events';
import { Badge } from '@/components/ui/badge';

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

  // Memoize date formatter for performance
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [],
  );

  const renderRow = useCallback(
    (idx: number) => {
      const ev = events[idx];
      const start = ev?.start_at ? dateFormatter.format(new Date(ev.start_at)) : 'Date TBD';
      
      // Determine status color
      const statusColor = ev.status === 'active' ? 'emerald' 
        : ev.status === 'upcoming' ? 'sky' 
        : ev.status === 'completed' ? 'slate' 
        : 'amber';

      return (
        <div
          key={ev.id}
          className="group grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-4 rounded-xl border border-transparent bg-background/40 px-4 py-3 text-sm transition-all duration-150 hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="truncate font-medium text-foreground" title={ev.title}>
            {ev.title}
          </div>
          <div className="text-muted-foreground tabular-nums">{start}</div>
          <div className="flex items-center justify-end">
            <Badge 
              variant="outline" 
              className={`rounded-full border-${statusColor}-500/40 text-xs font-medium uppercase tracking-wide ${statusColor === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                : statusColor === 'sky' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
                : statusColor === 'slate' ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}
            >
              {ev.status || 'scheduled'}
            </Badge>
          </div>
        </div>
      );
    },
    [dateFormatter, events],
  );

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          All events <span className="text-foreground">({events.length})</span>
        </p>
      </div>
      
      {/* Table Header */}
      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_minmax(0,1fr)] gap-4 px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Event</span>
        <span>Date</span>
        <span className="text-right">Status</span>
      </div>

      {/* Virtualized List */}
      <div ref={parentRef} className="max-h-[60vh] overflow-auto pr-2">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(vi => (
            <div
              key={vi.key}
              className="absolute left-0 right-2"
              style={{ transform: `translateY(${vi.start}px)` }}
            >
              {renderRow(vi.index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
