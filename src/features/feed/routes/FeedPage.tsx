import React, { lazy, Suspense } from 'react';
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatform } from '@/hooks/usePlatform';
import { WebLandingPage } from '@/components/landing/WebLandingPage';

const UnifiedFeedList = lazy(() => import('../components/UnifiedFeedList'));

export default function FeedPage() {
  const { user } = useAuth();
  const platform = usePlatform();

  const shouldShowLandingPage = platform.isWeb && platform.screenSize === 'desktop' && !user;

  return (
    <div className="w-full h-full">
      {shouldShowLandingPage ? (
        <WebLandingPage />
      ) : (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>}>
          <UnifiedFeedList />
        </Suspense>
      )}
    </div>
  );
}

