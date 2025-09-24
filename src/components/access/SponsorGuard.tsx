import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useSponsorMode } from '@/hooks/useSponsorMode';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface SponsorGuardProps {
  children: ReactNode;
  fallbackPath?: string;
}

export function SponsorGuard({ children, fallbackPath = '/' }: SponsorGuardProps) {
  const { sponsorModeEnabled, loading } = useSponsorMode();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!sponsorModeEnabled) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}