import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, Users, Heart, MessageCircle, Share2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  cover_image_url: string;
  start_at: string;
  end_at: string;
  venue: string;
  city: string;
  country: string;
  visibility: string;
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('visibility', 'public')
        .order('start_at', { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-48 bg-muted rounded-t-lg"></div>
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          Discover Events
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Find amazing events in your community and connect with like-minded people
        </p>
      </div>

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No events found</h3>
          <p className="text-muted-foreground mb-6">
            Be the first to create an event in your community
          </p>
          <Button>Create Event</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Event Image */}
      <div className="relative h-48 bg-muted overflow-hidden">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            <Calendar className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <Badge variant="secondary">{event.category}</Badge>
        </div>
      </div>

      <CardHeader>
        <CardTitle className="line-clamp-2">{event.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {event.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Date and Time */}
        <div className="flex items-center text-sm text-muted-foreground">
          <Calendar className="w-4 h-4 mr-2" />
          <span>
            {format(new Date(event.start_at), 'MMM d, yyyy • h:mm a')}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 mr-2" />
          <span>{event.venue}, {event.city}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm">
              <Heart className="w-4 h-4 mr-1" />
              <span className="text-xs">12</span>
            </Button>
            <Button variant="ghost" size="sm">
              <MessageCircle className="w-4 h-4 mr-1" />
              <span className="text-xs">5</span>
            </Button>
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
          <Button size="sm">View Event</Button>
        </div>
      </CardContent>
    </Card>
  );
}