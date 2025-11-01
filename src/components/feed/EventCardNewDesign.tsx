import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Ticket, MapPin, Calendar, ChevronUp } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import type { FeedItem } from "@/hooks/unifiedFeedTypes";
import { DEFAULT_EVENT_COVER } from "@/lib/constants";
import { logAdClickBeacon } from "@/lib/adTracking";
import { SponsorBadges } from "@/components/sponsorship/SponsorBadges";

interface EventCardNewDesignProps {
  item: Extract<FeedItem, { item_type: 'event' }>;
  onOpenTickets: (eventId: string) => void;
  onEventClick: (eventId: string) => void;
  onCreatePost?: () => void;
}

const EventCardNewDesignComponent = ({
  item,
  onOpenTickets,
  onEventClick,
  onCreatePost
}: EventCardNewDesignProps) => {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    try {
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'TBA';
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'TBA';
    const d = new Date(dateStr);
    try {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return 'TBA';
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Full Screen Background Image */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={item.event_cover_image || DEFAULT_EVENT_COVER}
          alt={item.event_title || 'Event'}
          className="h-full w-full object-cover"
        />
        
        {/* Gradient overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/90" />
      </div>

      {/* Bottom Info Card - Glassmorphic - Expandable */}
      <div 
        className={`absolute left-3 right-3 z-30 transition-all duration-500 ease-out sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md lg:max-w-lg ${
          isExpanded 
            ? 'bottom-20 top-1/2 sm:bottom-24 md:bottom-28' 
            : 'bottom-3 sm:bottom-4'
        }`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-black/70 via-black/60 to-black/70 shadow-2xl backdrop-blur-3xl">
          {/* Clickable header to expand/collapse */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full cursor-pointer p-5 text-left transition-all hover:bg-white/5 sm:p-6"
          >
            {/* Event Title & Get Tickets */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex-1">
                {/* Promoted Tag */}
                {item.promotion && (
                  <div className="mb-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      ✨ Promoted
                    </span>
                  </div>
                )}
                <h3 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/e/${item.event_id}`);
                  }}
                  className="mb-1.5 text-lg font-bold text-white drop-shadow-lg sm:text-xl cursor-pointer hover:text-orange-500 transition-colors"
                >
                  {item.event_title}
                </h3>
                <p className={`text-sm leading-relaxed text-white/80 transition-all duration-300 ${
                  isExpanded ? '' : 'line-clamp-2'
                }`}>
                  {item.event_description || 'Join us for an amazing experience'}
                </p>
              </div>
              
              {/* Show custom CTA for promoted ads, or default Tickets button */}
              {item.promotion?.ctaUrl ? (
                <a
                  href={item.promotion.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Track ad click with sendBeacon (survives navigation)
                    if (item.promotion) {
                      logAdClickBeacon({
                        campaignId: item.promotion.campaignId,
                        creativeId: item.promotion.creativeId ?? null,
                        eventId: item.event_id,
                        postId: null,
                        placement: 'feed',
                        rateModel: item.promotion.pricingModel ?? null,
                        cpcRateCredits: item.promotion.estimatedRate ?? null,
                        impressionId: item.promotion.impressionId ?? null,
                      });
                    }
                  }}
                  className="group flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-2.5 font-bold shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
                >
                  <Ticket className="h-4 w-4 text-white transition-transform group-hover:rotate-12" />
                  <span className="text-sm text-white">{item.promotion.ctaLabel || 'Learn More'}</span>
                </a>
              ) : (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTickets(item.event_id);
                  }}
                  className="group flex-shrink-0 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 font-bold shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95"
                >
                  <Ticket className="h-4 w-4 text-white transition-transform group-hover:rotate-12" />
                  <span className="text-sm text-white">Tickets</span>
                </button>
              )}
            </div>
            
            {/* Date & Location - Always Visible */}
            <div className="space-y-2.5 mt-4">
              <div className="flex items-center gap-2.5 text-white/80">
                <div className="rounded-full bg-white/10 p-1.5">
                  <Calendar className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{formatDate(item.event_starts_at)} • {formatTime(item.event_starts_at)}</span>
              </div>
              
              <div className="flex items-center gap-2.5 text-white/80">
                <div className="rounded-full bg-white/10 p-1.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{item.event_location || 'Location TBA'}</span>
              </div>
              
              {/* Sponsor Badge */}
              <div className="mt-3">
                <SponsorBadges eventId={item.event_id} variant="auto" />
              </div>
            </div>

            {/* Expand Indicator */}
            <div className="mt-4 flex justify-center">
              <div className="rounded-full bg-white/10 p-1.5 transition-all hover:bg-white/20">
                <ChevronUp 
                  className={`h-4 w-4 text-white/60 transition-all duration-300 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="border-t border-white/10 bg-black/20 p-6 sm:p-7 space-y-4 overflow-y-auto">
              {/* Additional event details when expanded */}
              <div>
                <h4 className="text-sm font-bold text-white mb-3">About this event</h4>
                <p className="text-sm text-white/80 leading-relaxed">
                  {item.event_description || 'Join us for an amazing experience'}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(item.event_id);
                }}
                className="w-full rounded-full border border-white/20 bg-white/10 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:border-white/30 hover:bg-white/20 hover:shadow-xl active:scale-95"
              >
                View Full Event Details
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders (performance optimization for iOS)
export const EventCardNewDesign = React.memo(EventCardNewDesignComponent, (prev, next) => {
  // Custom comparison: only re-render if item data actually changed
  return (
    prev.item.item_id === next.item.item_id &&
    prev.item.event_title === next.item.event_title &&
    prev.item.metrics?.likes === next.item.metrics?.likes &&
    prev.item.metrics?.comments === next.item.metrics?.comments
  );
});
