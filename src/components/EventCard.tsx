import { useState, useMemo, useCallback } from 'react';
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

export function EventCard({
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
      navigate(`/u/${item.event_organizer_id}`);
    },
    [item.event_organizer_id, navigate]
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
      onClick={goToEvent}
      onKeyDown={onKeyDownRoot}
      role="button"
      tabIndex={0}
      aria-label={item.event_title || 'Open event'}
      title={item.event_title || 'Open event'}
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
      {/* Legibility gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

      {/* RIGHT ACTION RAIL (TikTok style) */}
      <ActionRail
        onCreatePost={onCreatePost}
        onReport={onReport}
        onSoundToggle={onSoundToggle}
        soundEnabled={soundEnabled}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 pb-24 pointer-events-none">
        <div className="space-y-4 pointer-events-auto">
          {/* Event Info */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white leading-tight">
              {item.event_title}
            </h1>

            <div className="flex flex-col gap-2 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" aria-hidden />
                <span className="text-sm">{formatDate(item.event_starts_at)}</span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" aria-hidden />
                <span className="text-sm">{item.event_location || 'Location TBA'}</span>
              </div>
            </div>

            {item.event_description && (
              <p className="text-white/80 text-sm leading-relaxed line-clamp-3">
                {item.event_description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 z-40 relative">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onOpenTickets(item.event_id);
              }}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold py-3 shadow-lg"
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
              className="px-6 bg-white/10 border-white/20 text-white hover:bg-white/20"
              aria-label="View Details"
            >
              Details
            </Button>
          </div>
        </div>
      </div>

      {/* BOTTOM META BAR */}
      <div className="absolute left-4 right-4 bottom-6 z-30">
        <div className="bg-black/80 backdrop-blur-md rounded-full px-4 py-3 flex items-center justify-between shadow-2xl border border-white/10">
          {/* Left side - Organizer */}
          <button
            onClick={goToOrganizer}
            className="text-white font-bold hover:underline text-base flex-shrink-0 bg-transparent border-none cursor-pointer"
            aria-label={`Open organizer ${item.event_organizer || 'profile'}`}
          >
            {item.event_organizer || 'Organizer'}
          </button>

          {/* Right side - Event */}
          <button
            onClick={goToEvent}
            className="text-white/90 hover:text-white font-medium text-base truncate ml-4 bg-transparent border-none cursor-pointer"
            aria-label="Open event"
            title={item.event_title}
          >
            {item.event_title}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventCard;
