import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  message?: string;
  submessage?: string;
  variant?: 'default' | 'inline' | 'compact';
  className?: string;
}

export default function LoadingSpinner({ 
  message = 'Loading workspace', 
  submessage = 'Fetching the most recent event intelligence…',
  variant = 'default',
  className
}: LoadingSpinnerProps = {}) {
  if (variant === 'inline') {
    return (
      <div 
        className={cn("flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground", className)}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>{message}</span>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div 
        className={cn("flex flex-col items-center justify-center gap-2 py-6 text-center", className)}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-8 text-center shadow-sm",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">{submessage}</p>
      </div>
      <span className="sr-only">Loading dashboard data</span>
    </div>
  );
}
