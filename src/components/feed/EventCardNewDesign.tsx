import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Ticket, MapPin, Calendar } from "lucide-react";
import { ImageWithFallback } from "@/components/figma/ImageWithFallback";
import type { FeedItem } from "@/hooks/unifiedFeedTypes";
import { DEFAULT_EVENT_COVER } from "@/lib/constants";
import { logAdClickBeacon } from "@/lib/adTracking";
import { SponsorBadges } from "@/components/sponsorship/SponsorBadges";

interface EventCardNewDesignProps {
  item: Extract<FeedItem, { item_type: "event" }>;
  onOpenTickets: (eventId: string) => void;
  onEventClick: (eventId: string) => void;
  onCreatePost?: () => void;
}

const EventCardNewDesignComponent = ({
  item,
  onOpenTickets,
  onEventClick,
  onCreatePost,
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
    if (!dateStr) return "TBA";
    const d = new Date(dateStr);
    try {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "TBA";
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "TBA";
    const d = new Date(dateStr);
    try {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return "TBA";
    }
  };

  return (
    <div className="relative h-full w-full">
      {/* Full Screen Background Image */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={item.event_cover_image || DEFAULT_EVENT_COVER}
          alt={item.event_title || "Event"}
          className="h-full w-full object-cover"
        />

        {/* Gradient overlay for readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/85" />
      </div>

      {/* Bottom Info Card - positioned above navigation bar */}
      <div
        className={`absolute left-2 right-2 sm:left-3 sm:right-3 md:left-4 md:right-4 lg:left-auto lg:right-6 z-30 transition-all duration-500 ease-out lg:max-w-md xl:max-w-lg ${
          isExpanded
            ? "bottom-10 sm:bottom-14 md:bottom-16 lg:bottom-20"
            : ""
        }`}
        style={{
          bottom: isExpanded 
            ? undefined 
            : 'calc(1.25rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div
          className={`relative flex h-full flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-border bg-gradient-to-br from-background/70 via-background/60 to-background/70 shadow-xl backdrop-blur-3xl ${
            isExpanded
              ? "max-h-[60vh]"
              : "max-h-[26vh] sm:max-h-[24vh] md:max-h-[22vh]" // ✅ MUCH SHORTER
          }`}
        >
          {/* Header – dramatically reduced padding */}
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            className="cursor-pointer px-2 pt-1 pb-0 sm:px-3 sm:pt-1.5 sm:pb-0 md:px-4 md:pt-2 md:pb-0 hover:bg-muted/10"
          >
            {/* Title row */}
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="flex-1">
                {item.promotion && (
                  <div className="mb-0.5">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white border border-gray-300 px-1.5 py-0.5 text-[9px] font-bold text-black">
                      ✨ Promoted
                    </span>
                  </div>
                )}
                <h3
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/e/${item.event_id}`);
                  }}
                  className="text-sm sm:text-base font-bold text-foreground mb-0.5 drop-shadow-lg cursor-pointer hover:text-primary transition-colors"
                >
                  {item.event_title}
                </h3>
                {item.event_organizer && (
                  <p className="text-[10px] sm:text-xs text-foreground/60 mb-0.5">
                    by {item.event_organizer}
                  </p>
                )}
                <p
                  className={`text-xs text-foreground/80 leading-snug ${
                    isExpanded ? "line-clamp-3" : "line-clamp-1"
                  }`}
                >
                  {item.event_description || "Join us for an amazing experience"}
                </p>
              </div>

              {/* CTA / Tickets */}
              {item.promotion?.ctaUrl ? (
                <a
                  href={item.promotion.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item.promotion) {
                      logAdClickBeacon({
                        campaignId: item.promotion.campaignId,
                        creativeId: item.promotion.creativeId ?? null,
                        eventId: item.event_id,
                        postId: null,
                        placement: "feed",
                        rateModel: item.promotion.pricingModel ?? null,
                        cpcRateCredits: item.promotion.estimatedRate ?? null,
                        impressionId: item.promotion.impressionId ?? null,
                      });
                    }
                  }}
                  className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 px-2.5 py-1 text-xs font-bold shadow-md hover:bg-primary/90"
                >
                  <Ticket className="h-3 w-3 text-primary-foreground" />
                  <span className="text-primary-foreground whitespace-nowrap">
                    {item.promotion.ctaLabel || "Learn More"}
                  </span>
                </a>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenTickets(item.event_id);
                  }}
                  className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold shadow-md hover:bg-primary/90"
                >
                  <Ticket className="h-3 w-3 text-primary-foreground" />
                  <span className="text-primary-foreground whitespace-nowrap">
                    Tickets
                  </span>
                </button>
              )}
            </div>

            {/* Meta section – spacing reduced */}
            <div className="space-y-1 mt-1">
              <div className="flex items-center gap-1.5 text-foreground/80">
                <Calendar className="h-3 w-3" />
                <span className="text-[11px] font-medium">
                  {formatDate(item.event_starts_at)} • {formatTime(item.event_starts_at)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-foreground/80">
                <MapPin className="h-3 w-3" />
                <span className="text-[11px] font-medium">
                  {item.event_location || "Location TBA"}
                </span>
              </div>

              {/* Sponsor Badge */}
              <div className="mt-0.5">
                <SponsorBadges eventId={item.event_id} variant="auto" />
              </div>
            </div>

            {/* More/Less button */}
            <div className="mt-1 flex items-center justify-end pb-1">
              <button 
                type="button"
                className="text-[10px] sm:text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {isExpanded ? 'Less' : 'More'}
              </button>
            </div>
          </div>

          {/* Expanded Content */}
          {isExpanded && (
            <div className="border-t border-border bg-background/20 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 space-y-2 sm:space-y-3 overflow-y-auto">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-foreground mb-1.5 sm:mb-2">
                  About this event
                </h4>
                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed">
                  {item.event_description || "Join us for an amazing experience"}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(item.event_id);
                }}
                className="w-full rounded-full border border-border bg-muted/20 py-2.5 sm:py-3 md:py-3.5 text-xs sm:text-sm font-bold text-foreground shadow-lg transition-all hover:scale-105 hover:border-border hover:bg-muted/30 hover:shadow-xl active:scale-95"
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
export const EventCardNewDesign = React.memo(
  EventCardNewDesignComponent,
  (prev, next) => {
    return (
      prev.item.item_id === next.item.item_id &&
      prev.item.event_title === next.item.event_title &&
      prev.item.metrics?.likes === next.item.metrics?.likes &&
      prev.item.metrics?.comments === next.item.metrics?.comments
    );
  }
);
