import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';

const UnifiedFeedList = lazy(() => import('@/components/UnifiedFeedList'));

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="w-full h-full">
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><LoadingSpinner /></div>}>
        <UnifiedFeedList />
      </Suspense>
    </div>
  );
}