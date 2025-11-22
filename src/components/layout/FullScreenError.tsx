import { FullScreenSafeArea } from './FullScreenSafeArea';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

type FullScreenErrorProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Standardized full-screen error state with safe areas
 * 
 * Features:
 * - Respects iOS safe areas
 * - Consistent error UI
 * - Optional retry action
 * - Accessible
 */
export function FullScreenError({
  title = 'Something went wrong',
  message = 'Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}: FullScreenErrorProps) {
  return (
    <FullScreenSafeArea 
      className={`items-center justify-center bg-background px-6 text-center ${className}`}
    >
      <div className="space-y-4 max-w-md">
        <div className="flex justify-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded-full px-6 py-3 font-semibold active:scale-95 transition-transform"
          >
            {retryLabel}
          </Button>
        )}
      </div>
    </FullScreenSafeArea>
  );
}

