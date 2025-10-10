import { Search } from 'lucide-react';

type SkeletonGridProps = {
  rows?: number;          // how many cards to show
  showHeaderStub?: boolean;
};

export function SkeletonGrid({ rows = 6, showHeaderStub = false }: SkeletonGridProps) {
  return (
    <div aria-busy="true" aria-live="polite">
      {showHeaderStub && (
        <div className="mb-4 h-6 w-48 rounded-full bg-muted/60 animate-pulse" />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm"
            role="status"
            aria-label="Loading event"
          >
            <div className="relative aspect-[3/2] w-full overflow-hidden">
              <div className="h-full w-full bg-muted animate-pulse" />
            </div>
            <div className="space-y-3 p-4">
              <div className="h-5 w-24 rounded-full bg-muted/80 animate-pulse" />
              <div className="h-6 w-[85%] rounded bg-muted/70 animate-pulse" />
              <div className="h-4 w-[70%] rounded bg-muted/60 animate-pulse" />
              <div className="h-4 w-[55%] rounded bg-muted/50 animate-pulse" />
              <div className="h-4 w-[40%] rounded bg-muted/50 animate-pulse" />
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
    <div className="rounded-[32px] border border-slate-200 bg-white/95 px-8 py-16 text-center shadow-sm">
      <Search className="mx-auto mb-3 h-12 w-12 text-slate-400" aria-hidden="true" />
      <p className="text-xl font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-slate-400">Quick ranges</span>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-white"
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
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-white"
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
            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-white"
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
