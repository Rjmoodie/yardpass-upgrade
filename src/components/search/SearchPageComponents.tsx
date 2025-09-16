import { Search } from 'lucide-react';

export function SkeletonGrid() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border overflow-hidden bg-card">
          <div className="h-36 bg-muted animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-6 w-1/2 bg-muted rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState() {
  return (
    <div className="text-center py-16 border rounded-2xl bg-card">
      <Search className="w-12 h-12 mx-auto mb-2 text-muted-foreground/70" />
      <p className="text-xl font-semibold mb-1">No events found</p>
      <p className="text-muted-foreground">Try different keywords or remove filters.</p>
    </div>
  );
}