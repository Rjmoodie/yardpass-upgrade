import { useState } from 'react';
import { FeedCard } from '@/components/feed/FeedCard';
import { FloatingActions } from '@/components/feed/FloatingActions';
import { TopFilters } from '@/components/feed/TopFilters';
import { useNavigate } from 'react-router-dom';

// Demo data - replace with actual feed data
const DEMO_EVENTS = [
  {
    id: '1',
    title: 'Summer Music Festival 2025',
    image: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200',
    date: 'Saturday, June 15 • 7:00 PM - 11:00 PM',
    location: 'Central Park, New York',
    description: 'Join us for an unforgettable evening of live music featuring top artists from around the world. Food trucks, craft beer, and amazing vibes!',
  },
  {
    id: '2',
    title: 'Tech Innovation Summit',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200',
    date: 'Monday, June 20 • 9:00 AM - 5:00 PM',
    location: 'Convention Center, San Francisco',
    description: 'Connect with industry leaders, explore cutting-edge technology, and network with fellow innovators at the premier tech event of the year.',
  },
  {
    id: '3',
    title: 'Food & Wine Tasting Experience',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200',
    date: 'Friday, June 25 • 6:00 PM - 10:00 PM',
    location: 'Downtown Wine Bar, Brooklyn',
    description: 'Indulge in curated wine pairings and gourmet dishes from award-winning chefs. Limited seating available.',
  },
];

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

      {/* Floating Actions */}
      <FloatingActions
        isMuted={isMuted}
        onMuteToggle={() => setIsMuted(!isMuted)}
        onCreatePost={handleCreatePost}
        onOpenMessages={handleOpenMessages}
      />

      {/* Feed Content - Snap Scroll */}
      <div 
        className="hide-scrollbar relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch', scrollSnapStop: 'always' }}
      >
        {/* Add top padding to account for title */}
        <div className="h-32" aria-hidden />
        
        {DEMO_EVENTS.map((event, idx) => (
          <section
            key={event.id}
            className="snap-start snap-always h-dvh flex items-center px-3 sm:px-6"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-5xl items-stretch">
              <FeedCard event={event} />
            </div>
          </section>
        ))}

        {/* Add bottom padding to account for nav */}
        <div className="h-24" aria-hidden />
      </div>

      {/* Bottom Navigation - Optional, remove if you want to use existing nav */}
      {/* <BottomNav /> */}
    </div>
  );
}

export default ModernFeedPage;

