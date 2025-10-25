import { useState } from 'react';
import { FeedCard } from '@/components/feed/FeedCard';
import { FloatingActions } from '@/components/feed/FloatingActions';
import { TopFilters } from '@/components/feed/TopFilters';
import { useNavigate } from 'react-router-dom';


export function ModernFeedPage() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const handleCreatePost = () => {
    navigate('/create-post');
  };

  const handleOpenMessages = () => {
    navigate('/messages');
  };

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black text-white">
      {/* Background gradient layer */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neutral-950 via-black to-black" aria-hidden />
      
      {/* Radial glow at top */}
      <div
        className="pointer-events-none absolute left-1/2 top-[-30%] h-[520px] w-[125%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(circle_at_center,_rgba(120,119,198,0.35)_0%,_rgba(32,31,60,0.05)_55%,_transparent_75%)] blur-3xl"
        aria-hidden
      />

      {/* Title Section */}
      <div className="relative z-40 px-3 pt-4 pb-2 sm:px-4">
        <div className="mx-auto w-full max-w-5xl text-center">
          <h1 className="feed-title-primary text-white mb-1">LAUNDACH</h1>
          <h2 className="feed-title-secondary text-white">YARD-PASS</h2>
        </div>
      </div>

      {/* Top Filters */}
      <TopFilters
        location="Near Brooklyn"
        dateFilter="This Weekend"
        onLocationClick={() => setShowFilters(true)}
        onDateClick={() => setShowFilters(true)}
        onFiltersClick={() => setShowFilters(true)}
      />

      {/* Floating Actions - Hidden when filters are open */}
      {!showFilters && (
        <FloatingActions
          isMuted={isMuted}
          onMuteToggle={() => setIsMuted(!isMuted)}
          onCreatePost={handleCreatePost}
          onOpenMessages={handleOpenMessages}
        />
      )}

      {/* Feed Content - Snap Scroll */}
      <div 
        className="hide-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
      >
        {/* Add top padding to account for title */}
        <div className="h-32" aria-hidden />
        
        {/* TODO: Replace with real feed data from useUnifiedFeedInfinite or similar hook */}
        <div className="flex h-full items-center justify-center text-white/60">
          <p>No events to display</p>
        </div>

        {/* Add bottom padding to account for nav */}
        <div className="h-24" aria-hidden />
      </div>

      {/* Bottom Navigation - Optional, remove if you want to use existing nav */}
      {/* <BottomNav /> */}
    </div>
  );
}

export default ModernFeedPage;

