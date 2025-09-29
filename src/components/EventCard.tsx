import React, { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin } from 'lucide-react';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import ActionRail from './ActionRail';
import type { FeedItem } from '@/hooks/useUnifiedFeed';

interface EventCardProps {
  item: Extract<FeedItem, { item_type: 'event' }>;
  onOpenTickets: (eventId: string) => void;
  onEventClick: (eventId: string) => void;
  onCreatePost?: () => void;
  onReport?: () => void;
  onSoundToggle?: () => void;
  onVideoToggle?: () => void;
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
}

export const EventCard = memo(function EventCard({
  item,
  onOpenTickets,
  onEventClick,
  onCreatePost,
  onReport,
  onSoundToggle,
  onVideoToggle, // kept for parity with post card, even if not used here
  soundEnabled,
  isVideoPlaying,
}: EventCardProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const formatDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'TBA';
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).format(d);
    } catch {
      return 'TBA';
    }
  }, []);

  const imageUrl = useMemo(
    () => (imageError ? DEFAULT_EVENT_COVER : item.event_cover_image || DEFAULT_EVENT_COVER),
    [imageError, item.event_cover_image]
  );

  const goToEvent = useCallback(
    (e?: React.MouseEvent | React.KeyboardEvent) => {
      e?.stopPropagation?.();
      onEventClick(item.event_id);
      // Also update route without full reload
      navigate(`/event/${item.event_id}`);
    },
    [item.event_id, onEventClick, navigate]
  );

  const goToOrganizer = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation?.();
      if (!item.event_organizer_id) return;
      
      // Navigate to organization page if event is owned by organization, otherwise user profile
      if (item.event_owner_context_type === 'organization') {
        navigate(`/org/${item.event_organizer_id}`);
      } else {
        navigate(`/u/${item.event_organizer_id}`);
      }
    },
    [item.event_organizer_id, item.event_owner_context_type, navigate]
  );

  const onKeyDownRoot = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToEvent();
      }
    },
    [goToEvent]
  );

  return (
    <div
      className="w-full h-screen relative overflow-hidden bg-black"
    >
      {/* Background Image */}
      <img
        src={imageUrl}
        alt={item.event_title ? `Cover for ${item.event_title}` : 'Event cover'}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
        decoding="async"
        onError={() => setImageError(true)}
        onLoad={() => setImageLoaded(true)}
        // Helps browsers choose the right asset size
        sizes="100vw"
      />
      {/* Fallback visible while loading */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-neutral-900 animate-pulse" aria-hidden="true" />
      )}
      {/* Enhanced mobile legibility gradient with stronger contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />
      
      {/* Additional text shadow overlay for ultra-high contrast */}
      <div className="absolute inset-0" style={{
        background: `linear-gradient(
          to top,
          rgba(0,0,0,0.9) 0%,
          rgba(0,0,0,0.7) 25%,
          rgba(0,0,0,0.3) 50%,
          rgba(0,0,0,0.6) 75%,
          rgba(0,0,0,0.4) 100%
        )`
      }} />

      {/* RIGHT ACTION RAIL (TikTok style) - Events only show create post */}
      <ActionRail
        onCreatePost={onCreatePost}
        onReport={onReport}
        onSoundToggle={onSoundToggle}
        soundEnabled={soundEnabled}
        hideEngagement={true}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 pb-24 pointer-events-none">
        <div className="space-y-4 pointer-events-auto">
          {/* Event Info */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight drop-shadow-2xl" 
                style={{ 
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.6)' 
                }}>
              {item.event_title}
            </h1>

            <div className="flex flex-col gap-2 text-white/95" 
                 style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 drop-shadow-lg" aria-hidden />
                <span className="text-xs sm:text-sm font-medium">{formatDate(item.event_starts_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 drop-shadow-lg" aria-hidden />
                <span className="text-xs sm:text-sm font-medium">{item.event_location || 'Location TBA'}</span>
              </div>
            </div>

            {item.event_description && (
              <p className="text-white/90 text-xs sm:text-sm leading-relaxed line-clamp-3 font-medium"
                 style={{ textShadow: '1px 1px 3px rgba(0,0,0,0.8)' }}>
                {item.event_description}
              </p>
            )}

            {/* Sponsor information */}
            {item.sponsor && (
              <div className="flex items-center gap-2 mt-2">
                <div className="bg-amber-400/20 text-amber-200 px-2 py-1 rounded-full text-xs font-medium">
                  Sponsored by {item.sponsor.name}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 z-40 relative">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTickets(item.event_id);
              }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 sm:py-4 text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-200 hover:scale-[1.02] rounded-xl"
              aria-label="Get Tickets"
            >
              Get Tickets
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                goToEvent(e);
              }}
              variant="outline"
              className="px-4 sm:px-6 py-3 sm:py-4 bg-white/10 border-white/20 text-white hover:bg-white/20 text-sm sm:text-base font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02]"
              aria-label="View Details"
            >
              Details
            </Button>
          </div>
        </div>
      </div>

      {/* BOTTOM META BAR - Enhanced mobile visibility */}
      <div className="absolute left-2 right-2 sm:left-4 sm:right-4 bottom-6 z-30">
        <div className="bg-black/90 backdrop-blur-xl rounded-full px-3 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-0 sm:justify-between shadow-2xl border border-white/20"
             style={{ backdropFilter: 'blur(20px) saturate(180%)' }}>
          {/* Organizer section */}
          <div className="w-full sm:w-auto">
            <button
              onClick={goToOrganizer}
              className="text-white font-bold hover:underline text-sm sm:text-base flex-shrink-0 bg-transparent border-none cursor-pointer min-h-[44px] px-0 flex items-center"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
              aria-label={`Open organizer ${item.event_organizer || 'profile'}`}
            >
              {item.event_organizer || 'Organizer'}
            </button>
          </div>

          {/* Event section */}
          <div className="w-full sm:w-auto sm:ml-4">
            <button
              onClick={goToEvent}
              className="text-white/95 hover:text-white font-medium text-sm sm:text-base truncate bg-transparent border-none cursor-pointer text-left w-full sm:w-auto min-h-[44px] px-0 flex items-center"
              style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
              aria-label="Open event"
              title={item.event_title}
            >
              {item.event_title}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EventCard;
