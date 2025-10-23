// WebOnly gate component - shows content only on desktop, otherwise shows fallback
import { usePlatform } from '@/hooks/usePlatform';
import { UpsellDesktop } from '@/components/Upsells';

interface WebOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function WebOnly({ children, fallback }: WebOnlyProps) {
  const { isDesktop } = usePlatform();
  
  if (!isDesktop) {
    return fallback || <UpsellDesktop />;
  }
  
  return <>{children}</>;
}

