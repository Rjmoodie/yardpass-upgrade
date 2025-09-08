import { Button } from '@/components/ui/button';
import { Clock, Ticket, Users } from 'lucide-react';
import { useMemo } from 'react';

export function EventCTA({
  eventTitle,
  startAtISO,
  attendeeCount,
  minPrice,
  remaining,
  onGetTickets,
  onDetails
}: {
  eventTitle: string;
  startAtISO?: string | null;
  attendeeCount?: number | null;
  minPrice?: number | null;
  remaining?: number | null;
  onGetTickets: () => void;
  onDetails: () => void;
}) {
  const timeToStart = useMemo(() => {
    if (!startAtISO) return null;
    const diffMs = new Date(startAtISO).getTime() - Date.now();
    if (diffMs <= 0) return 'Live or ended';
    const hours = Math.floor(diffMs / 3.6e6);
    const mins = Math.floor((diffMs % 3.6e6) / 6e4);
    if (hours < 1) return `Starts in ${mins}m`;
    if (hours < 48) return `Starts in ${hours}h`;
    return new Date(startAtISO).toLocaleString();
  }, [startAtISO]);

  const headline =
    remaining != null && remaining <= 25
      ? `Last ${remaining} left`
      : attendeeCount
      ? `${attendeeCount} going`
      : 'Popular';

  const subline =
    minPrice != null ? `From $${(minPrice / 100).toFixed(0)}` : timeToStart || '';

  return (
    <div className="flex items-center justify-between bg-black/40 backdrop-blur-sm rounded-lg p-3 text-white">
      <div className="min-w-0">
        <div className="font-semibold text-sm truncate">{eventTitle}</div>
        <div className="flex items-center gap-3 text-xs opacity-90">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" /> {headline}
          </span>
          {timeToStart && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeToStart}
            </span>
          )}
          {subline && !timeToStart && (
            <span className="inline-flex items-center gap-1">{subline}</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        <Button size="sm" variant="outline" onClick={onDetails}>
          Details
        </Button>
        <Button size="sm" onClick={onGetTickets}>
          <Ticket className="w-4 h-4 mr-1" /> Get Tickets
        </Button>
      </div>
    </div>
  );
}