import { Calendar, MapPin, Ticket } from "lucide-react";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface FeedCardProps {
  event: {
    id: string;
    title: string;
    image: string;
    date: string;
    location: string;
    description: string;
    isPromoted?: boolean;
  };
}

export function FeedCard({ event }: FeedCardProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="relative h-full w-full">
      {/* Full screen background image */}
      <div className="absolute inset-0">
        <ImageWithFallback
          src={event.image}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/90" />
      </div>

      {/* Bottom info card - clickable to expand/collapse */}
      <div 
        className={`absolute left-3 right-3 z-30 transition-all duration-500 ease-out sm:left-4 sm:right-4 md:left-auto md:right-6 md:max-w-md lg:max-w-lg ${
          isExpanded 
            ? 'bottom-20 top-1/2 sm:bottom-24 md:bottom-28' 
            : 'bottom-20 sm:bottom-24 md:bottom-28'
        }`}
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-background/50 shadow-2xl backdrop-blur-2xl">
          {/* Clickable header section */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full p-5 text-left transition-all hover:bg-muted/10 sm:p-6"
          >
            {/* Event title and Get Tickets button */}
            <div className="mb-3 flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/e/${event.id}`);
                    }}
                    className="text-foreground cursor-pointer hover:text-primary transition-colors"
                  >
                    {event.title}
                  </h3>
                  {event.isPromoted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500/30 to-amber-600/30 border border-amber-400/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 whitespace-nowrap">
                      ✨ Promoted
                    </span>
                  )}
                </div>
                <p className={`text-xs text-foreground/90 transition-all duration-300 sm:text-sm ${
                  isExpanded ? 'line-clamp-none' : 'line-clamp-2'
                }`}>
                  {event.description}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle ticket purchase
                  }}
                  className="flex items-center gap-2 whitespace-nowrap rounded-full bg-primary px-4 py-2 shadow-lg transition-all hover:scale-105 hover:bg-primary/90 active:scale-95 sm:px-5 sm:py-2.5"
                >
                  <Ticket className="h-4 w-4 text-primary-foreground" />
                  <span className="text-xs text-primary-foreground sm:text-sm">Tickets</span>
                </button>
                <span className="text-[10px] sm:text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors">
                  {isExpanded ? 'Less' : 'More'}
                </span>
              </div>
            </div>
          </button>

          {/* Expanded content */}
          <div 
            className={`overflow-y-auto transition-all duration-500 ${
              isExpanded 
                ? 'max-h-[600px] opacity-100' 
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className="border-t border-border p-5 sm:p-6">
              {/* Date */}
              <div className="mb-3 flex items-center gap-3 sm:mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/20">
                  <Calendar className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-foreground/60 sm:text-xs">Date & Time</p>
                  <p className="text-sm text-foreground/90 sm:text-base">{event.date}</p>
                </div>
              </div>

              {/* Location */}
              <div className="mb-4 flex items-center gap-3 sm:mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/20">
                  <MapPin className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-foreground/60 sm:text-xs">Location</p>
                  <p className="text-sm text-foreground/90 sm:text-base">{event.location}</p>
                </div>
              </div>

              {/* Full Description */}
              <div className="rounded-2xl bg-muted/10 p-4">
                <p className="text-xs leading-relaxed text-foreground/70 sm:text-sm">About this event</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/90 sm:text-sm">{event.description}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

