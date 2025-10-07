import React from 'react';
import dynamic from 'next/dynamic';
// New: split keyboard + gesture wiring into memoized hooks/components
import { FeedKeymap } from '@/components/FeedKeymap';
import { FeedGestures } from '@/components/FeedGestures';
// New: virtualized list renderer that consumes the unified feed
const UnifiedFeedList = dynamic(() => import('@/components/UnifiedFeedList'), { ssr: false });

export default function Index() {
  // Replace heavy inline handlers with stable, memoized hooks.
  const gestures = FeedGestures();   // stable refs + handlers
  const keymap = FeedKeymap();       // memoized hotkeys layer

  return (
    <div {...gestures.containerProps}>
      {keymap.layer}
      {/* Virtualized renderer; still uses your EventCard/UserPostCard via the hook */}
      <UnifiedFeedList />
    </div>
  );
}