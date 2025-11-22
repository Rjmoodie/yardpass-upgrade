import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type FullScreenSafeAreaProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Full-screen container that respects iOS safe areas (notch, Dynamic Island, home indicator)
 * 
 * Usage:
 * - Replace `h-screen` or `min-h-screen` for full-page layouts
 * - Automatically handles safe area insets on iOS
 * - Works on all platforms (web, iOS, Android)
 */
export function FullScreenSafeArea({
  children,
  className = '',
}: FullScreenSafeAreaProps) {
  return (
    <div
      className={cn('flex flex-col', className)}
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available', // iOS Safari fallback
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {children}
    </div>
  );
}

