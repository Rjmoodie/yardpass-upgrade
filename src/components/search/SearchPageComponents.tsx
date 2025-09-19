import { Search } from 'lucide-react';

type SkeletonGridProps = {
  rows?: number;          // how many cards to show
  showHeaderStub?: boolean;
};

export function SkeletonGrid({ rows = 6, showHeaderStub = false }: SkeletonGridProps) {
  return (
    <div aria-busy="true" aria-live="polite">
      {showHeaderStub && (
        <div className="h-6 w-40 bg-muted rounded mb-3 animate-pulse" />
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border overflow-hidden bg-card"
            role="status"
            aria-label="Loading event"
          >
            <div className="h-36 bg-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-6 w-[55%] bg-muted rounded animate-pulse" />
              <div className="h-4 w-[82%] bg-muted rounded animate-pulse" />
              <div className="h-4 w-[36%] bg-muted rounded animate-pulse" />
              <div className="h-4 w-[48%] bg-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title = 'No events found',
  subtitle = 'Try different keywords or remove filters.',
  onReset,
}: {
  title?: string;
  subtitle?: string;
  onReset?: () => void;
}) {
  return (
    <div className="text-center py-16 border rounded-2xl bg-card">
      <Search className="w-12 h-12 mx-auto mb-2 text-muted-foreground/70" aria-hidden="true" />
      <p className="text-xl font-semibold mb-1">{title}</p>
      <p className="text-muted-foreground mb-4">{subtitle}</p>
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground">Quick ranges:</span>
        <div className="flex gap-2 flex-wrap justify-center">
          <button
            className="px-2 py-1 text-xs rounded-full border hover:bg-muted transition"
            onClick={() => {
              const now = new Date();
              const midnight = new Date(now); midnight.setHours(23,59,59,999);
              const usp = new URLSearchParams(window.location.search);
              usp.set('from', now.toISOString());
              usp.set('to', midnight.toISOString());
              history.replaceState(null, '', `${location.pathname}?${usp.toString()}`);
              onReset?.();
            }}
          >
            Tonight
          </button>
          <button
            className="px-2 py-1 text-xs rounded-full border hover:bg-muted transition"
            onClick={() => {
              const now = new Date();
              const in30 = new Date(now); in30.setDate(now.getDate() + 30);
              const usp = new URLSearchParams(window.location.search);
              usp.set('from', now.toISOString());
              usp.set('to', in30.toISOString());
              history.replaceState(null, '', `${location.pathname}?${usp.toString()}`);
              onReset?.();
            }}
          >
            Next 30 days
          </button>
          <button
            className="px-2 py-1 text-xs rounded-full border hover:bg-muted transition"
            onClick={() => {
              // clear all
              history.replaceState(null, '', location.pathname);
              onReset?.();
            }}
          >
            Clear filters
          </button>
        </div>
      </div>
    </div>
  );
}
