import { useSimilarEvents } from '@/hooks/useSimilarEvents';
import { Button } from '@/components/ui/button';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';
import { formatDistanceToNow } from 'date-fns';

interface BecauseYouViewedProps {
  eventId: string;
  eventTitle: string;
  onEventClick: (id: string) => void;
}

export function BecauseYouViewed({ eventId, eventTitle, onEventClick }: BecauseYouViewedProps) {
  const { data: similarEvents, loading } = useSimilarEvents(eventId, 3);
  const { trackInteraction } = useInteractionTracking();

  if (loading || similarEvents.length === 0) return null;

  const handleEventClick = (similarEventId: string) => {
    trackInteraction(similarEventId, 'event_view');
    onEventClick(similarEventId);
  };

  return (
    <section className="px-4 py-3 bg-muted/20 border-t">
      <div className="mb-3">
        <h4 className="text-sm font-medium text-foreground">
          Because you viewed "{eventTitle}"
        </h4>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {similarEvents.map(event => (
          <button
            key={event.event_id}
            onClick={() => handleEventClick(event.event_id)}
            className="min-w-[200px] p-3 rounded-lg bg-card hover:bg-card/80 text-left transition-colors border"
          >
            <div className="font-medium line-clamp-2 text-sm mb-2">{event.title}</div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(event.starts_at), { addSuffix: true })}
            </div>
            <Button 
              size="sm" 
              variant="outline"
              className="w-full mt-2"
            >
              View event
            </Button>
          </button>
        ))}
      </div>
    </section>
  );
}