// MobileOnly gate component - shows content only on mobile, otherwise shows fallback
import { usePlatform } from '@/hooks/usePlatform';
import { UpsellMobile } from '@/components/Upsells';

interface MobileOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function MobileOnly({ children, fallback }: MobileOnlyProps) {
  const { isMobile } = usePlatform();
  
  if (!isMobile) {
    return fallback || <UpsellMobile />;
  }
  
  return <>{children}</>;
}

