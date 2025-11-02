import React, { useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Ticket, ChevronUp, ChevronDown, Users } from 'lucide-react';
import { DEFAULT_EVENT_COVER } from '@/lib/constants';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { SponsorBadges } from '@/components/sponsorship/SponsorBadges';
import type { FeedItem } from '@/hooks/unifiedFeedTypes';

interface EventCardModernProps {
  item: Extract<FeedItem, { item_type: 'event' }>;
  onOpenTickets: (eventId: string, item?: Extract<FeedItem, { item_type: 'event' }>) => void;
  onEventClick: (eventId: string, item?: FeedItem) => void;
  onCreatePost?: () => void;
  onReport?: () => void;
  onSoundToggle?: () => void;
  soundEnabled?: boolean;
  isVideoPlaying?: boolean;
}

export const EventCardModern = memo(function EventCardModern({
  item,
  onOpenTickets,
  onEventClick,
  onCreatePost,
  onReport,
  onSoundToggle,
  soundEnabled,
  isVideoPlaying,
}: EventCardModernProps) {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'TBA';
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
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
      onEventClick(item.event_id, item);
    },
    [item.event_id, item, onEventClick]
  );

  const handleTicketClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onOpenTickets(item.event_id, item);
    },
    [item, onOpenTickets]
  );

  return (
    <div className="relative h-full w-full">
      {/* Full screen background image */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={imageUrl}
          alt={item.event_title || 'Event'}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
      </div>

      {/* Bottom info card - clickable to expand/collapse */}
      <div 
        className={`absolute left-3 right-3 z-30 transition-all duration-500 ease-out sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md lg:max-w-lg ${
          isExpanded 
            ? 'bottom-20 top-1/2 sm:bottom-24 md:bottom-28' 
            : 'bottom-20 sm:bottom-24 md:bottom-28'
        }`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/20 bg-black/50 shadow-2xl backdrop-blur-2xl">
          {/* Clickable header section (div as button) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsExpanded((v) => !v);
              }
            }}
            className="w-full p-5 text-left transition-all hover:bg-white/5 sm:p-6"
          >
            {/* Event title and Get Tickets button */}
            <div className="mb-3 flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1" onClick={goToEvent}>
                <h3 className="mb-1 text-lg font-bold text-white sm:text-xl">{item.event_title}</h3>
                <p className={`text-xs text-white/70 transition-all duration-300 sm:text-sm ${
                  isExpanded ? 'line-clamp-none' : 'line-clamp-2'
                }`}>
                  {item.event_description || 'No description available'}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button 
                  type="button"
                  onClick={handleTicketClick}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full bg-[#FF8C00] px-4 py-2 shadow-lg transition-all hover:scale-105 hover:bg-[#FF9D1A] active:scale-95 sm:px-5 sm:py-2.5"
                >
                  <Ticket className="h-4 w-4 text-white" />
                  <span className="text-xs font-semibold text-white sm:text-sm">Tickets</span>
                </button>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-white/50" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-white/50" />
                )}
              </div>
            </div>
          </div>

          {/* Expanded content */}
          <div 
            className={`overflow-y-auto transition-all duration-500 ${
              isExpanded 
                ? 'max-h-[600px] opacity-100' 
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className="border-t border-white/10 p-5 sm:p-6">
              {/* Date */}
              <div className="mb-3 flex items-center gap-3 sm:mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] text-white/60 sm:text-xs">Date & Time</p>
                  <p className="text-sm text-white/90 sm:text-base">{formatDate(item.event_start_at)}</p>
                </div>
              </div>

              {/* Location */}
              {item.event_venue && (
                <div className="mb-4 flex items-center gap-3 sm:mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/60 sm:text-xs">Location</p>
                    <p className="text-sm text-white/90 sm:text-base">{item.event_venue}</p>
                    {item.event_address && (
                      <p className="text-xs text-white/60 sm:text-sm">{item.event_address}</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Sponsor Badge */}
              <div className="mb-4">
                <SponsorBadges eventId={item.event_id} variant="auto" />
              </div>

              {/* Organizer */}
              {item.event_organizer_name && (
                <div className="mb-4 flex items-center gap-3 sm:mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/60 sm:text-xs">Hosted by</p>
                    <p className="text-sm text-white/90 sm:text-base">{item.event_organizer_name}</p>
                  </div>
                </div>
              )}

              {/* Full Description */}
              {item.event_description && (
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-xs font-semibold leading-relaxed text-white/70 sm:text-sm">About this event</p>
                  <p className="mt-2 text-xs leading-relaxed text-white/90 sm:text-sm">{item.event_description}</p>
                </div>
              )}

              {/* Category Badge */}
              {item.event_category && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                    {item.event_category}
                  </span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex gap-3">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToEvent();
                  }}
                  variant="outline"
                  className="flex-1 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                >
                  View Details
                </Button>
                {onCreatePost && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreatePost();
                    }}
                    variant="outline"
                    className="flex-1 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20"
                  >
                    Create Post
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Promoted Badge (if applicable) */}
      {item.promotion && (
        <div className="absolute left-4 top-4 z-40 rounded-full border border-yellow-400/30 bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-200 backdrop-blur-md">
          Promoted
        </div>
      )}
    </div>
  );
});

