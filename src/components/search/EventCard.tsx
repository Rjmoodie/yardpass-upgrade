import { CalendarIcon, MapPin, Star, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';

interface EventCardProps {
  event: any;
  onClick: () => void;
}

export function EventCard({ event, onClick }: EventCardProps) {
  return (
    <button onClick={onClick} className="group text-left rounded-2xl border overflow-hidden bg-card hover:shadow-xl transition-shadow">
      <div className="flex">
        <div className="w-36 h-36 shrink-0 relative">
          <ImageWithFallback src={event.coverImage} alt={event.title} className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold line-clamp-1 group-hover:text-primary">{event.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{event.description}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="px-2 py-0.5 rounded-full">{event.category}</Badge>
                <span className="inline-flex items-center gap-1"><CalendarIcon className="w-3 h-3" /> {event.date}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.location}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              {typeof event.priceFrom === 'number' && (
                <div className="text-sm">
                  <div className="text-muted-foreground">From</div>
                  <div className="font-semibold">${event.priceFrom.toFixed(0)}</div>
                </div>
              )}
              <div className="mt-2 inline-flex items-center text-xs text-muted-foreground">
                <Star className="w-3 h-3 mr-1 fill-current" /> {(event.rating ?? 4.2).toFixed(1)}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" /> {event.attendeeCount} attending
          </div>
        </div>
      </div>
    </button>
  );
}