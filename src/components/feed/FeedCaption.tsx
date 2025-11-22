import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Crown, MapPin, Users, ChevronDown } from "lucide-react";
import { routes } from "@/lib/routes";
import { useNavigate } from "react-router-dom";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { capture } from "@/lib/analytics";

type CaptionProps = {
  event: {
    id: string;
    title: string;
    description?: string;
    organizer: string;
    organizerId: string;
    dateLabel: string;
    location?: string;
    attendeeCount: number;
    category: string;
    ticketTiers?: { id: string; name: string; price?: number; badge?: string }[];
  };
  onOpenTickets: () => void;
  onOpenAttendees: () => void;
  isExpandable?: boolean; // Explicit flag for expandability
};

export function FeedCaption({ event, onOpenTickets, onOpenAttendees, isExpandable: explicitIsExpandable }: CaptionProps) {
  const [expanded, setExpanded] = useState(false);
  const captionRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const { requireAuth } = useAuthGuard();

  // Keep CSS --caption-h synced with real height
  useLayoutEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty("--caption-h", `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [expanded]);

  const hasTickets = !!event.ticketTiers?.length;
  const topTier = hasTickets ? event.ticketTiers![0] : null;
  
  // Determine if expandable: ONLY if explicit prop is true OR has tickets (for expanded actions)
  // Default to false if not explicitly set - be strict about when to show expand indicator
  const isExpandable = explicitIsExpandable === true || (explicitIsExpandable === undefined && hasTickets);

  return (
    <div 
      className="absolute inset-x-0 px-3 sm:px-5 pointer-events-none"
      style={{ 
        bottom: 'calc(var(--bottom-nav-safe, 4.5rem) + 0.75rem)' 
      }}
    >
      <div
        ref={captionRef}
        className="pointer-events-auto caption-peek flex flex-col gap-2.5 sm:gap-3 rounded-2xl border border-border px-3.5 py-3 sm:px-4 sm:py-3.5 text-foreground shadow-lg"
      >
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="text-xs bg-muted/30 text-foreground">
                {event.organizer.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{event.organizer}</span>
                <Badge variant="secondary" className="text-[10px] bg-muted/30 border-border">
                  <Crown className="w-3 h-3 mr-1" />
                  ORGANIZER
                </Badge>
              </div>
              <div className="text-[11px] text-foreground/80 truncate">
                @{event.organizer.replaceAll(" ", "").toLowerCase()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasTickets && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenTickets();
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-black text-xs font-bold px-3 py-1.5 shadow"
              >
                🎟️ {topTier?.badge ? `${topTier.badge} • ` : ""}{topTier?.name ?? "Tickets"}
              </button>
            )}
          </div>
        </div>

        {/* Title + caption */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            capture("feed_click", { target: "title", event_id: event.id });
            navigate(routes.event(event.id));
          }}
          className="block text-left w-full"
        >
          <h2 className="text-lg sm:text-xl font-extrabold leading-tight mb-1 line-clamp-1">
            {event.title}
          </h2>
        </button>
        {event.description && (
          <p className="text-[13px] text-foreground/90 leading-snug line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-foreground/90">
          <span className="chip"><Calendar className="w-3.5 h-3.5" />{event.dateLabel}</span>
          {!!event.location && (
            <span className="chip">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[40vw] sm:max-w-[240px]">{event.location}</span>
            </span>
          )}
          <span className="chip"><Users className="w-3.5 h-3.5" />{event.attendeeCount}</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onOpenAttendees();
            }} 
            className="chip hover:bg-muted/30 transition"
          >
            {event.attendeeCount} attending
          </button>
        </div>

        {/* Expand Indicator or Static Divider - Positioned right above bottom nav */}
        {isExpandable ? (
          <div className="mt-auto pt-2">
            <ExpandIndicator 
              expanded={expanded}
              onExpand={() => setExpanded((v) => !v)}
            />
          </div>
        ) : (
          <div className="mt-auto pt-2">
            <StaticDivider />
          </div>
        )}

        {/* Expanded controls */}
        {expanded && isExpandable && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex gap-2">
              <Button
                size="lg"
                className="flex-1 min-h-[44px] rounded-full bg-amber-500 text-black hover:bg-amber-600 font-bold shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onOpenTickets();
                }}
              >
                Get Tickets
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-[44px] rounded-full border-border text-foreground bg-muted/20 hover:bg-muted/30 font-semibold backdrop-blur-md"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  navigate(routes.event(event.id));
                }}
              >
                Details
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Expand Indicator - Interactive button for expandable content
 * Made more prominent and clearly clickable in non-expanded state
 * Positioned to be visible above bottom navigation
 */
function ExpandIndicator({ expanded, onExpand }: { expanded: boolean; onExpand: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onExpand();
      }}
      className={`mx-auto mb-0 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer ${
        expanded
          ? 'bg-muted/30 text-foreground/80 hover:bg-muted/40'
          : 'bg-white/20 text-white border border-white/30 hover:bg-white/30 hover:border-white/40 animate-bounce-slow'
      }`}
      aria-label={expanded ? "Collapse details" : "More details"}
      title={expanded ? "Collapse details" : "More details"}
    >
      {!expanded && (
        <>
          <span className="hidden sm:inline text-white/95 font-medium">
            More details
          </span>
          <span className="sm:hidden text-[11px] text-white/90 font-medium">
            Tap for more
          </span>
        </>
      )}
      {expanded && (
        <span className="text-foreground/80 font-medium">
          Less
        </span>
      )}
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition-transform ${
        expanded 
          ? 'bg-muted/40 rotate-180' 
          : 'bg-white/30 border border-white/40'
      }`}>
        <ChevronDown className={`${expanded ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-white`} />
      </span>
    </button>
  );
}

/**
 * Static Divider - Non-interactive separator for non-expandable content
 */
function StaticDivider() {
  return (
    <div className="mx-auto my-2 h-1 w-16 rounded-full bg-white/10" />
  );
}
