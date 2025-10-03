import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar, MapPin, Users, Share2, ArrowLeft } from 'lucide-react';
import MapboxEventMap from '@/components/MapboxEventMap';
import { format } from 'date-fns';

type EventRow = {
  id: string;
  title: string;
  description: string;
  start_at: string;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
  slug?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);

      try {
        // Check if id looks like a UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        
        // Get current user
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;

        let query = supabase
          .from('events')
          .select(`
            id,
            title,
            description,
            start_at,
            venue,
            address,
            city,
            country,
            cover_image_url,
            category,
            slug,
            lat,
            lng,
            visibility
          `);

        // Query by ID if UUID, or by slug if not
        if (isUUID) {
          query = query.eq('id', id);
        } else {
          query = query.eq('slug', id);
        }

        const { data: ev, error } = await query.single();

        if (error || !ev) {
          console.error('Event fetch error:', error);
          setEvent(null);
          setLoading(false);
          return;
        }

        setEvent(ev as EventRow);
        setLoading(false);
      } catch (error) {
        console.error('Event fetch error:', error);
        setEvent(null);
        setLoading(false);
      }
    })();
  }, [id]);

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, 'EEEE, MMMM d, yyyy'),
      time: format(date, 'h:mm a'),
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <div className="container mx-auto px-4 py-8 space-y-6">
          <div className="h-72 w-full rounded-xl bg-muted animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4 shadow-lg">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-semibold mb-2">Event not found</h1>
            <p className="text-muted-foreground mb-4">This event may be private, unlisted, or has been deleted.</p>
            <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { date: eventDate, time: eventTime } = formatEventDate(event.start_at);
  const locationText = [event.venue, event.city, event.country].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero */}
      {event.cover_image_url && (
        <div className="relative h-72 w-full">
          <img
            src={event.cover_image_url}
            alt={event.title || 'Event cover image'}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Badges */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge variant="secondary" className="backdrop-blur-sm bg-white/90 text-foreground">
              PUBLIC
            </Badge>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {event.category && (
                <Badge variant="outline" className="capitalize">
                  {event.category}
                </Badge>
              )}
            </div>

            <h1 className="text-4xl font-bold tracking-tight leading-tight">{event.title}</h1>

            {event.description && (
              <p className="text-lg text-muted-foreground leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Details */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Date & Time */}
            <Card className="border-l-4 border-l-primary shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">Date & Time</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="font-medium">{eventDate}</p>
                <p className="text-muted-foreground">{eventTime}</p>
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="border-l-4 border-l-accent shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <MapPin className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="font-semibold">Location</h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                {event.venue && <p className="font-medium">{event.venue}</p>}
                <p className="text-muted-foreground">
                  {[event.address, event.city, event.country].filter(Boolean).join(', ') || locationText}
                </p>
                
                {/* Add map if coordinates are available */}
                {event.lat && event.lng && (
                  <div className="mt-4">
                    <MapboxEventMap
                      lat={event.lat}
                      lng={event.lng}
                      venue={event.venue || undefined}
                      address={event.address || undefined}
                      city={event.city || undefined}
                      country={event.country || undefined}
                      className="w-full h-48 rounded-lg"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Button
              size="lg"
              className="flex-1 h-12"
              onClick={() => {
                console.log('🎫 Get Tickets clicked');
                // TODO: Open ticket modal
              }}
            >
              <Users className="w-5 h-5 mr-2" />
              Get Tickets
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-12"
              onClick={() => {
                const url = window.location.href;
                if (navigator.share) {
                  navigator.share({ title: event.title, url });
                } else {
                  navigator.clipboard.writeText(url);
                  console.log('Link copied to clipboard');
                }
              }}
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share Event
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}