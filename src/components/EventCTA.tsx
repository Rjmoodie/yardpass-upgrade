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
  const { timeToStart, isPastEvent } = useMemo(() => {
    if (!startAtISO) return { timeToStart: null, isPastEvent: false };
    const diffMs = new Date(startAtISO).getTime() - Date.now();
    const isPast = diffMs <= 0;
    
    if (isPast) return { timeToStart: 'Sales ended', isPastEvent: true };
    
    const hours = Math.floor(diffMs / 3.6e6);
    const mins = Math.floor((diffMs % 3.6e6) / 6e4);
    if (hours < 1) return { timeToStart: `Starts in ${mins}m`, isPastEvent: false };
    if (hours < 48) return { timeToStart: `Starts in ${hours}h`, isPastEvent: false };
    return { timeToStart: new Date(startAtISO).toLocaleString(), isPastEvent: false };
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
    <div className="flex items-center justify-between bg-black/40 backdrop-blur-sm rounded-lg p-2 text-white">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-xs truncate">{eventTitle}</div>
        <div className="flex items-center gap-2 text-[10px] opacity-90 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Users className="w-2.5 h-2.5" /> {headline}
          </span>
          {timeToStart && (
            <span className="inline-flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {timeToStart}
            </span>
          )}
          {subline && !timeToStart && (
            <span className="inline-flex items-center gap-1">{subline}</span>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 flex-shrink-0 ml-2">
        <Button size="sm" variant="outline" onClick={onDetails} className="h-7 px-2 text-xs">
          Details
        </Button>
        <Button 
          size="sm" 
          onClick={onGetTickets} 
          disabled={isPastEvent}
          className={`h-7 px-2 text-xs rounded-full shadow ${isPastEvent ? "bg-gray-400 text-gray-600" : "bg-amber-500 text-black hover:bg-amber-600 font-bold"}`}
        >
          <Ticket className="w-3 h-3 mr-1" /> 
          {isPastEvent ? "Sales Ended" : "Get Tickets"}
        </Button>
      </div>
    </div>
  );
}