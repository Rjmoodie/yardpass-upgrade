import { useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  MapPin,
  Star,
  Ticket,
  Bookmark,
  Share2,
  Wifi,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=60';

export function EventCard({
  event,
  onClick,
  onTicket,
  onBookmark,
  onShare,
  className,
}: EventCardProps) {
  const startAt = event.start_at
    ? new Date(event.start_at)
    : event.date
    ? new Date(event.date)
    : null;
  const isPast = startAt ? isBefore(startAt, new Date()) : false;
  const whenLabel = startAt
    ? isPast
      ? format(startAt, 'PPP • p')
      : formatDistanceToNowStrict(startAt, { addSuffix: true })
    : event.date;

  const imageSrc =
    event.coverImage || event.cover_image_url || event.image_url || FALLBACK_IMAGE;

  const locationDetails = event.locationDetails ?? null;
  const isVirtual = locationDetails?.isVirtual ?? event.isVirtual;
  const baseLocation =
    locationDetails?.display ||
    locationDetails?.short ||
    event.location ||
    event.city ||
    event.venue ||
    'Location TBD';

  const distance =
    typeof event.distance_km === 'number' && Number.isFinite(event.distance_km)
      ? event.distance_km
      : null;

  const distanceText =
    distance !== null ? (distance >= 100 ? `${Math.round(distance)} km` : `${distance.toFixed(1)} km`) : null;

  const locationLine = isVirtual
    ? locationDetails?.display || baseLocation
    : distanceText
    ? `${distanceText} • ${baseLocation}`
    : baseLocation;

  const priceFrom = useMemo(() => {
    if (typeof event.priceFrom === 'number') {
      return `From $${event.priceFrom.toFixed(0)}`;
    }
    if (typeof event.price_min === 'number') {
      return `From $${event.price_min.toFixed(0)}`;
    }
    if (typeof event.price === 'string' && event.price.trim()) {
      return event.price.trim();
    }
    if (typeof event.price_range === 'string' && event.price_range.trim()) {
      return event.price_range.trim();
    }
    return null;
  }, [event.priceFrom, event.price_min, event.price, event.price_range]);

  const rating = useMemo(() => {
    if (typeof event.rating === 'number') {
      return event.rating.toFixed(1);
    }
    if (typeof event.review_score === 'number') {
      return event.review_score.toFixed(1);
    }
    return null;
  }, [event.rating, event.review_score]);

  const attendingLabel = useMemo(() => {
    if (typeof event.attendeeCount === 'number' && event.attendeeCount > 0) {
      return `${event.attendeeCount.toLocaleString()} attending`;
    }
    if (typeof event.attending === 'number' && event.attending > 0) {
      return `${event.attending.toLocaleString()} attending`;
    }
    return null;
  }, [event.attendeeCount, event.attending]);

  const promotionBadge = event.promotion ? 'Promoted' : null;

  const sponsorName =
    event.sponsor?.name || event.sponsors?.[0]?.name || event.primarySponsor?.name || null;
  const sponsorLogo =
    event.sponsor?.logo_url ||
    event.sponsor?.logoUrl ||
    event.sponsors?.[0]?.logo_url ||
    event.primarySponsor?.logo_url ||
    null;

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl',
        className,
      )}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Open event ${event.title}`}
    >
      <div className="relative">
        <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
          <ImageWithFallback
            src={imageSrc}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />

        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {promotionBadge && (
            <Badge className="rounded-full bg-amber-100/90 text-amber-900 shadow-sm">{promotionBadge}</Badge>
          )}
          {startAt && (
            <Badge
              variant={isPast ? 'destructive' : 'secondary'}
              className="rounded-full border-none bg-white/90 text-xs font-medium text-slate-900 shadow"
            >
              {isPast ? 'Ended' : 'Upcoming'}
            </Badge>
          )}
        </div>

        <div className="absolute right-4 top-4 flex items-center gap-2">
          {onBookmark && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const eventId = event.item_id || event.id;
                if (eventId) onBookmark(eventId);
              }}
              className="rounded-full bg-white/90 p-2 text-slate-900 shadow hover:bg-white"
              aria-label={`Save ${event.title}`}
            >
              <Bookmark className="h-4 w-4" />
            </button>
          )}
          {onShare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const eventId = event.item_id || event.id;
                if (eventId) onShare(eventId);
              }}
              className="rounded-full bg-white/90 p-2 text-slate-900 shadow hover:bg-white"
              aria-label={`Share ${event.title}`}
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {event.category && (
              <Badge className="rounded-full bg-slate-900/90 text-slate-100">{event.category}</Badge>
            )}
            {isVirtual && (
              <Badge variant="outline" className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700">
                <Wifi className="h-3 w-3" /> Online
              </Badge>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold leading-tight text-slate-900 line-clamp-2">
              {event.title}
            </h3>
            {event.description && (
              <p className="mt-2 text-sm text-slate-600 line-clamp-2">{event.description}</p>
            )}
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-600">
          {whenLabel && (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span>{whenLabel}</span>
            </div>
          )}
          {locationLine && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="truncate">{locationLine}</span>
            </div>
          )}
        </div>

        {(priceFrom || rating || attendingLabel || sponsorName) && (
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            {(priceFrom || rating) && (
              <div className="flex flex-wrap items-center gap-3">
                {priceFrom && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-900">
                    {priceFrom}
                  </span>
                )}
                {rating && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-4 w-4 fill-slate-900 text-slate-900" />
                    {rating}
                  </span>
                )}
                {attendingLabel && <span>{attendingLabel}</span>}
              </div>
            )}
            {sponsorName && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                {sponsorLogo && (
                  <img
                    src={sponsorLogo}
                    alt={`${sponsorName} logo`}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                )}
                <span>Sponsored by {sponsorName}</span>
              </div>
            )}
          </div>
        )}

        {(onTicket || onBookmark || onShare) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              {event.organizer || event.organizer_name || 'Featured event'}
            </div>
            <div className="flex items-center gap-2">
              {onTicket && (
                <Button
                  size="sm"
                  className="rounded-full bg-amber-500 text-black shadow hover:bg-amber-600 font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Use item_id for search results, fallback to id for other event objects
                    const eventId = event.item_id || event.id;
                    if (eventId) {
                      onTicket(eventId);
                    }
                  }}
                >
                  <Ticket className="mr-2 h-4 w-4" /> Tickets
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
