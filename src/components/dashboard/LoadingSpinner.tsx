import { BrandedSpinner } from '@/components/BrandedSpinner';
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
        <BrandedSpinner size="sm" showLogo={false} text={message} />
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
        <BrandedSpinner size="md" showLogo text={message} />
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
      <BrandedSpinner size="lg" showLogo text={message} />
      {submessage && (
        <p className="text-xs text-muted-foreground">{submessage}</p>
      )}
      <span className="sr-only">Loading dashboard data</span>
    </div>
  );
}
