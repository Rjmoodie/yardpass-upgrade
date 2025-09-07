import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canViewEvent } from '@/lib/permissions';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import RequestAccess from '@/components/RequestAccess';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { Calendar, MapPin, Users, Share2, ArrowLeft } from 'lucide-react';
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
};

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const kParam = useMemo(() => new URLSearchParams(search).get('k'), [search]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);

      const { identifier, isUUID } = parseEventIdentifier(id);
      
      // Build query based on whether we have a UUID or slug
      let query = supabase
        .from('events')
        .select('id,title,description,start_at,venue,address,city,country,cover_image_url,category,slug');
      
      if (isUUID) {
        query = query.eq('id', identifier);
      } else {
        query = query.eq('slug', identifier);
      }

      const { data: ev, error } = await query.single();

      if (error || !ev) {
        setEvent(null);
        setLoading(false);
        return;
      }

      // Redirect to slug-based URL if we accessed via UUID but have a slug
      if (isUUID && ev.slug && window.location.pathname.includes(identifier)) {
        navigate(`/events/${ev.slug}${search}`, { replace: true });
        return;
      }

      // For now, all events are accessible (visibility logic will be added later)
      // TODO: Add visibility and link_token logic once columns are available in types

      setEvent(ev);
      setLoading(false);
    })();
  }, [id, kParam, user?.id, navigate, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-64 w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-4">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
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

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, 'EEEE, MMMM d, yyyy'),
      time: format(date, 'h:mm a')
    };
  };

  const { date: eventDate, time: eventTime } = formatEventDate(event.start_at);
  const locationText = [event.venue, event.city, event.country].filter(Boolean).join(', ');

  // Normal details UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section with Cover Image */}
      {event.cover_image_url && (
        <div className="relative h-72 w-full">
          <ImageWithFallback
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Status Badges */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge variant="secondary" className="backdrop-blur-sm bg-white/90 text-foreground">
              PUBLIC
            </Badge>
            {event.slug && (
              <Badge variant="outline" className="backdrop-blur-sm bg-emerald-500/90 text-white border-emerald-400">
                SEO Optimized
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Event Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {event.category && (
                <Badge variant="outline" className="capitalize">
                  {event.category}
                </Badge>
              )}
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight leading-tight">
              {event.title}
            </h1>
            
            {event.slug && (
              <p className="text-sm text-muted-foreground font-mono bg-muted/50 px-3 py-2 rounded-md inline-block">
                yardpass.com/events/{event.slug}
              </p>
            )}
            
            <p className="text-lg text-muted-foreground leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Event Details Cards */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Date & Time */}
            <Card className="border-l-4 border-l-primary">
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
            {locationText && (
              <Card className="border-l-4 border-l-accent">
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
                  {(event.city || event.country) && (
                    <p className="text-muted-foreground">
                      {[event.city, event.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {event.address && (
                    <p className="text-sm text-muted-foreground">{event.address}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button
              size="lg"
              className="flex-1 h-12"
              onClick={() => {
                const identifier = event.slug || event.id;
                navigate(`/e/${identifier}#tickets`);
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
                import('@/lib/share').then(({ sharePayload }) => {
                  import('@/lib/shareLinks').then(({ buildShareUrl, getShareTitle, getShareText }) => {
                    const ident = event.slug ?? event.id;
                    sharePayload({
                      title: getShareTitle({ type: 'event', slug: ident, title: event.title }),
                      text: getShareText({ 
                        type: 'event', 
                        slug: ident, 
                        title: event.title, 
                        city: event.city || event.venue, 
                        date: eventDate 
                      }),
                      url: buildShareUrl({ type: 'event', slug: ident, title: event.title })
                    });
                  });
                });
              }}
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share Event
            </Button>
          </div>

          {/* Additional Info Card */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {event.title.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <h4 className="font-semibold">About this event</h4>
                  <p className="text-sm text-muted-foreground">
                    Join us for an amazing experience at {event.title}. More details and tickets available on the full event page.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}