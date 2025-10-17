import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Crown, MapPin, Users } from "lucide-react";
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
};

export function FeedCaption({ event, onOpenTickets, onOpenAttendees }: CaptionProps) {
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

  return (
    <div className="absolute inset-x-0 bottom-[12px] px-3 sm:px-5 pointer-events-none">
      <div
        ref={captionRef}
        className="pointer-events-auto caption-peek rounded-2xl border border-white/15 px-3.5 py-3 sm:px-4 sm:py-3.5 text-white shadow-lg"
      >
        {/* Top row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="text-xs bg-white/20 text-white">
                {event.organizer.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">{event.organizer}</span>
                <Badge variant="secondary" className="text-[10px] bg-white/15 border-white/30">
                  <Crown className="w-3 h-3 mr-1" />
                  ORGANIZER
                </Badge>
              </div>
              <div className="text-[11px] text-white/80 truncate">
                @{event.organizer.replaceAll(" ", "").toLowerCase()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasTickets && (
              <button
                onClick={() =>
                  requireAuth(onOpenTickets, "Sign in to buy tickets")
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 text-black text-xs font-bold px-3 py-1.5 shadow"
              >
                🎟️ {topTier?.badge ? `${topTier.badge} • ` : ""}{topTier?.name ?? "Tickets"}
              </button>
            )}
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 w-8 h-8 grid place-items-center"
              aria-label={expanded ? "Collapse" : "Expand"}
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? "–" : "+"}
            </button>
          </div>
        </div>

        {/* Title + caption */}
        <button
          onClick={() => {
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
          <p className="text-[13px] text-white/90 leading-snug line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/90">
          <span className="chip"><Calendar className="w-3.5 h-3.5" />{event.dateLabel}</span>
          {!!event.location && (
            <span className="chip">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[40vw] sm:max-w-[240px]">{event.location}</span>
            </span>
          )}
          <span className="chip"><Users className="w-3.5 h-3.5" />{event.attendeeCount}</span>
          <button onClick={onOpenAttendees} className="chip hover:bg-white/25 transition">
            {event.attendeeCount} attending
          </button>
        </div>

        {/* Expanded controls */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex gap-2">
              <Button
                size="lg"
                className="flex-1 min-h-[44px] rounded-full bg-amber-500 text-black hover:bg-amber-600 font-bold shadow-lg"
                onClick={() => requireAuth(onOpenTickets, "Sign in to buy tickets")}
              >
                Get Tickets
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-[44px] rounded-full border-white/30 text-white bg-white/10 hover:bg-white/20 font-semibold backdrop-blur-md"
                onClick={() => navigate(routes.event(event.id))}
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
