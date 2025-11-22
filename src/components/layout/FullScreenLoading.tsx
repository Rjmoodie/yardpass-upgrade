import { FullScreenSafeArea } from './FullScreenSafeArea';
import { BrandedSpinner } from '../BrandedSpinner';

type FullScreenLoadingProps = {
  text?: string;
  className?: string;
};

/**
 * Standardized full-screen loading state with safe areas
 * 
 * Features:
 * - Respects iOS safe areas (notch, home indicator)
 * - Uses branded spinner with logo
 * - Accessible (ARIA labels)
 * - Consistent across the app
 */
export function FullScreenLoading({ 
  text = 'Loading...',
  className = '',
}: FullScreenLoadingProps) {
  return (
    <FullScreenSafeArea 
      className={`items-center justify-center bg-background ${className}`}
    >
      <div role="status" aria-live="polite" aria-label={text}>
        <BrandedSpinner
          size="lg"
          showLogo
          text={text}
        />
      </div>
    </FullScreenSafeArea>
  );
}

