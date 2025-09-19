import { useRecommendations } from '@/hooks/useRecommendations';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useInteractionTracking } from '@/hooks/useInteractionTracking';
import { formatDistanceToNow } from 'date-fns';

interface ForYouStripProps {
  onEventClick: (id: string) => void;
}

export function ForYouStrip({ onEventClick }: ForYouStripProps) {
  const { user } = useAuth();
  const { data: recommendations, loading } = useRecommendations(user?.id, 8);
  const { trackInteraction } = useInteractionTracking();

  if (!user || loading || recommendations.length === 0) return null;

  const handleEventClick = (eventId: string) => {
    trackInteraction(eventId, 'event_view');
    onEventClick(eventId);
  };

  const handleTicketClick = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    trackInteraction(eventId, 'ticket_open');
    onEventClick(eventId);
  };

  return (
    <section className="px-4 py-3 bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">For you</h3>
        <span className="text-xs text-muted-foreground">Based on your activity</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {recommendations.map(rec => (
          <button
            key={rec.event_id}
            onClick={() => handleEventClick(rec.event_id)}
            className="min-w-[240px] p-4 rounded-lg bg-card hover:bg-card/80 text-left transition-colors border"
          >
            <div className="font-medium line-clamp-2 text-sm mb-2">{rec.title}</div>
            <div className="text-xs text-muted-foreground mb-3 space-y-1">
              {rec.starts_at && (
                <div>
                  {formatDistanceToNow(new Date(rec.starts_at), { addSuffix: true })}
                </div>
              )}
              <div className="flex items-center gap-2">
                {rec.category && <span>{rec.category}</span>}
                {typeof rec.distance_km === 'number' && (
                  <span>• {rec.distance_km.toFixed(1)} km away</span>
                )}
              </div>
            </div>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={(e) => handleTicketClick(rec.event_id, e)}
              className="w-full"
            >
              Get tickets
            </Button>
          </button>
        ))}
      </div>
    </section>
  );
}