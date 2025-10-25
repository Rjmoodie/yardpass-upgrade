import { Loader2 } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-8 text-center shadow-sm">
      <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">Loading workspace</p>
        <p className="text-xs text-muted-foreground">Fetching the most recent event intelligence…</p>
      </div>
    </div>
  );
}