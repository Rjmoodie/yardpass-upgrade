import React from 'react';
import { useUnifiedFeedInfinite } from '@/hooks/useUnifiedFeedInfinite';

export default function UnifiedFeedList() {
  const { items, status } = useUnifiedFeedInfinite(30);

  if (status === 'pending') return <div className="p-4">Loading feed...</div>;
  if (status === 'error') return <div className="p-4 text-sm text-red-600">Couldn't load feed.</div>;

  return (
    <div className="p-4">
      <p className="text-muted-foreground">Feed items: {items?.length || 0}</p>
    </div>
  );
}
