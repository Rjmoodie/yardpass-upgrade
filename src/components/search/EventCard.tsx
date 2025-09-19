import { CalendarIcon, MapPin, Star, Users, Ticket, Bookmark, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { format, formatDistanceToNowStrict, isBefore } from 'date-fns';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: any;
  onClick: () => void;
  onTicket?: (eventId: string) => void;
  onBookmark?: (eventId: string) => void;
  onShare?: (eventId: string) => void;
  className?: string;
}

export function EventCard({ event, onClick, onTicket, onBookmark, onShare, className }: EventCardProps) {
  const startAt = event.start_at ? new Date(event.start_at) : (event.date ? new Date(event.date) : null);
  const isPast = startAt ? isBefore(startAt, new Date()) : false;
  const whenLabel = startAt
    ? (isPast ? format(startAt, 'PPP • p') : formatDistanceToNowStrict(startAt, { addSuffix: true }))
    : event.date;

  const distanceLabel = typeof event.distance_km === 'number'
    ? `${event.distance_km.toFixed(1)} km`
    : event.location;

  const priceFrom = typeof event.priceFrom === 'number' ? `$${event.priceFrom.toFixed(0)}` : null;
  const rating = (event.rating ?? 4.2).toFixed(1);

  return (
    <div className={cn('group rounded-2xl border overflow-hidden bg-card hover:shadow-xl transition-shadow', className)}>
      <button
        onClick={onClick}
        className="w-full text-left"
        aria-label={`Open event ${event.title}`}
      >
        <div className="flex">
          {/* Media */}
          <div className="w-36 h-36 shrink-0 relative">
            <ImageWithFallback
              src={event.coverImage}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            {/* Ribbon for soon/past */}
            {startAt && (
              <div className="absolute top-2 left-2">
                <Badge variant={isPast ? 'destructive' : 'secondary'} className="rounded-full px-2 py-0.5 text-xs">
                  {isPast ? 'Ended' : 'Upcoming'}
                </Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold line-clamp-1 group-hover:text-primary">
                  {event.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{event.description}</p>

                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  {event.category && (
                    <Badge variant="secondary" className="px-2 py-0.5 rounded-full">
                      {event.category}
                    </Badge>
                  )}
                  {whenLabel && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" /> {whenLabel}
                    </span>
                  )}
                  {distanceLabel && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {distanceLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* Metrics */}
              <div className="text-right shrink-0">
                {priceFrom && (
                  <div className="text-sm">
                    <div className="text-muted-foreground">From</div>
                    <div className="font-semibold">{priceFrom}</div>
                  </div>
                )}
                <div className="mt-2 inline-flex items-center text-xs text-muted-foreground">
                  <Star className="w-3 h-3 mr-1 fill-current" aria-hidden="true" /> {rating}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end">
              {/* Quick actions (optional) */}
              <div className="flex items-center gap-1">
                {onTicket && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onTicket(event.id); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition"
                    aria-label={`Get tickets for ${event.title}`}
                  >
                    <Ticket className="w-3 h-3" /> Tickets
                  </button>
                )}
                {onBookmark && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onBookmark(event.id); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition"
                    aria-label={`Save ${event.title}`}
                  >
                    <Bookmark className="w-3 h-3" /> Save
                  </button>
                )}
                {onShare && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onShare(event.id); }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted transition"
                    aria-label={`Share ${event.title}`}
                  >
                    <Share2 className="w-3 h-3" /> Share
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}
