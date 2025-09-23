import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, BarChart3, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Event {
  id: string;
  title: string;
  status: string;
  date: string;
  attendees: number;
  revenue: number;
  views: number;
  likes: number;
  shares: number;
  tickets_sold: number;
  capacity: number;
  conversion_rate: number;
  start_at: string;
}

interface EventsListProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
}

export function EventsList({ events, onEventSelect }: EventsListProps) {
  const handleShareEvent = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(window.location.origin + '/e/' + eventId);
    toast({ 
      title: "Link copied!", 
      description: "Event link copied to clipboard" 
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">My Events</h2>
        <Button onClick={() => window.location.href = '/create-event'}>
          <Plus className="mr-2 h-4 w-4" />
          Create New Event
        </Button>
      </div>

      <div className="grid gap-4">
        {events.map((event) => (
          <Card 
            key={event.id} 
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onEventSelect(event)}
          >
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold">{event.title}</h3>
                    <Badge variant={event.status === 'published' ? 'default' : 'secondary'}>
                      {event.status}
                    </Badge>
                  </div>
                   <p className="text-muted-foreground mb-4">
                     {event.start_at ? new Date(event.start_at).toLocaleDateString('en-US', { 
                       weekday: 'short',
                       year: 'numeric', 
                       month: 'short', 
                       day: 'numeric',
                       hour: '2-digit',
                       minute: '2-digit',
                       timeZone: 'UTC'
                     }) : event.date}
                   </p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Attendees</p>
                      <p className="text-lg font-semibold">{event.attendees}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                      <p className="text-lg font-semibold">${event.revenue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Views</p>
                      <p className="text-lg font-semibold">{event.views.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Conversion</p>
                      <p className="text-lg font-semibold">{event.conversion_rate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventSelect(event);
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Manage
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => handleShareEvent(event.id, e)}
                  >
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}