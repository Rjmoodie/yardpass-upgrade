// src/pages/EventDetails.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { getEventAttendeesRoute } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { Calendar, MapPin, Users, Share2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

type OrganizerProfile = {
  user_id: string;
  display_name?: string | null;
  photo_url?: string | null;
};

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
  // Join alias from FK: events_created_by_fkey -> user_profiles
  user_profiles?: OrganizerProfile | null;
};

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { search } = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  const kParam = useMemo(() => new URLSearchParams(search).get('k'), [search]);

  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);

      const { identifier, isUUID } = parseEventIdentifier(id);

      // Build query (prefer slug over UUID)
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
          created_by,
          user_profiles!events_created_by_fkey(
            user_id,
            display_name,
            photo_url
          )
        `);

      query = isUUID ? query.eq('id', identifier) : query.eq('slug', identifier);

      const { data: ev, error } = await query.single();

      if (error || !ev) {
        setEvent(null);
        setLoading(false);
        return;
      }

      // If accessed via UUID but a slug exists, redirect to the slug URL
      if (isUUID && ev.slug && window.location.pathname.includes(identifier)) {
        navigate(`/events/${ev.slug}${search}`, { replace: true });
        return;
      }

      setEvent({
        ...ev,
        user_profiles: null
      } as EventRow);
      setLoading(false);
    })();
  }, [id, kParam, user?.id, navigate, search]);

  const formatEventDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: format(date, 'EEEE, MMMM d, yyyy'),
      time: format(date, 'h:mm a'),
    };
  };

  const buildMapEmbed = (lat: number, lng: number) => {
    // OSM embed (no API key) with a small bbox around the marker
    const delta = 0.01;
    const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  };

  const googleMapsHref = (e: EventRow) => {
    if (e.lat && e.lng) return `https://www.google.com/maps/search/?api=1&query=${e.lat},${e.lng}`;
    const q = [e.venue, e.address, e.city, e.country].filter(Boolean).join(', ');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  };

  const shareEvent = async (slugOrId: string, title: string, city?: string | null, whenText?: string) => {
    try {
      // Use existing share module if available
      const { sharePayload } = await import('@/lib/share');
      const { buildShareUrl, getShareTitle, getShareText } = await import('@/lib/shareLinks');
      sharePayload({
        title: getShareTitle({ type: 'event', slug: slugOrId, title }),
        text: getShareText({
          type: 'event',
          slug: slugOrId,
          title,
          city: city || undefined,
          date: whenText,
        }),
        url: buildShareUrl({ type: 'event', slug: slugOrId, title }),
      });
    } catch {
      // Graceful fallback: native share or copy link
      const url = window.location.origin + `/events/${slugOrId}`;
      if (navigator.share) {
        try {
          await navigator.share({ title, text: title, url });
          return;
        } catch {
          // ignore and fall through to clipboard
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        // lightweight feedback
        alert('Link copied to clipboard');
      } catch {
        // final fallback
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Skeleton className="h-28 w-full rounded-lg" />
              <Skeleton className="h-28 w-full rounded-lg" />
            </div>
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
            <Button variant="outline" onClick={() => navigate(-1)} className="w-full" aria-label="Go back">
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
  const organizer = event.user_profiles;
  const identifier = event.slug || event.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero */}
      {event.cover_image_url && (
        <div className="relative h-72 w-full">
          <ImageWithFallback
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
            aria-label="Back to previous page"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {/* Badges */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Badge variant="secondary" className="backdrop-blur-sm bg-white/90 text-foreground">
              PUBLIC
            </Badge>
            {event.slug && (
              <Badge
                variant="outline"
                className="backdrop-blur-sm bg-emerald-500/90 text-white border-emerald-400"
                title="This page is SEO-friendly and shareable"
              >
                SEO Optimized
              </Badge>
            )}
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
                <Badge variant="outline" className="capitalize" title="Event category">
                  {event.category}
                </Badge>
              )}
              {/* See who’s going */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(getEventAttendeesRoute({ id: event.id, slug: event.slug ?? undefined }))}
                className="gap-2"
                aria-label="See who’s going"
              >
                <Users className="w-4 h-4" />
                See who’s going
              </Button>
            </div>

            <h1 className="text-4xl font-bold tracking-tight leading-tight">{event.title}</h1>

            {/* Slug hint for quick sharing (if present) */}
            {event.slug && (
              <div className="inline-flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-mono bg-muted/50 px-3 py-2 rounded-md">
                  yardpass.com/events/{event.slug}
                </span>
              </div>
            )}

            {/* Organizer (links to profile if we have a handle/id) */}
            {organizer && (
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  {organizer.photo_url ? (
                    <AvatarImage src={organizer.photo_url} alt={organizer.display_name ?? 'Organizer'} />
                  ) : (
                    <AvatarFallback>
                      {(organizer.display_name ?? 'O').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <button
                  className="text-sm text-muted-foreground hover:underline"
                  onClick={() => navigate(`/u/${organizer.user_id}`)}
                  aria-label="View organizer profile"
                  title="View organizer profile"
                >
                  by {organizer.display_name ?? 'Organizer'}
                </button>
              </div>
            )}

            {event.description && (
              <p className="text-lg text-muted-foreground leading-relaxed">{event.description}</p>
            )}
          </div>

          {/* Details + Map */}
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

            {/* Location + Map */}
            <Card className="border-l-4 border-l-accent overflow-hidden shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/10 rounded-lg">
                      <MapPin className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-semibold">Location</h3>
                  </div>
                  <Button variant="secondary" size="sm" asChild aria-label="Open in Google Maps">
                    <a href={googleMapsHref(event)} target="_blank" rel="noopener noreferrer">
                      Open in Maps
                    </a>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {locationText && <p className="font-medium">{locationText}</p>}
                {event.address && <p className="text-sm text-muted-foreground">{event.address}</p>}

                {/* Map Preview with smooth fade-in and visible attribution */}
                {(event.lat && event.lng) ? (
                  <div className="relative h-56 w-full rounded-lg overflow-hidden border bg-gradient-to-br from-primary/5 to-accent/5">
                    {!mapLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-full w-full bg-gradient-to-br from-muted via-muted to-muted/50 animate-pulse rounded-lg" />
                      </div>
                    )}
                    <iframe
                      title="Event location map"
                      src={buildMapEmbed(event.lat, event.lng)}
                      className={`w-full h-full border-0 transition-opacity duration-500 rounded-lg ${
                        mapLoaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      onLoad={() => setMapLoaded(true)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      style={{ filter: 'saturate(0.95) contrast(1.05)' }}
                    />
                    <div className="absolute bottom-0 left-0 text-[10px] md:text-xs bg-background/90 px-2 py-1 rounded-tr-md">
                      © OpenStreetMap contributors
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border p-4 text-sm text-muted-foreground bg-gradient-to-br from-muted/30 to-muted/10">
                    Map preview unavailable. Use the button above to open the address in Maps.
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
              onClick={() => navigate(`/e/${identifier}#tickets`)}
              aria-label="Get tickets"
            >
              <Users className="w-5 h-5 mr-2" />
              Get Tickets
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-12"
              onClick={() => {
                const ident = event.slug ?? event.id;
                const when = `${eventDate} at ${eventTime}`;
                const cityOrVenue = event.city || event.venue || undefined;
                shareEvent(ident, event.title, cityOrVenue, when);
              }}
              aria-label="Share event"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share Event
            </Button>
          </div>

          {/* About */}
          <Card className="bg-muted/30">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-12 h-12">
                  {organizer?.photo_url ? (
                    <AvatarImage src={organizer.photo_url} alt={organizer.display_name ?? 'Organizer'} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {event.title.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 space-y-1">
                  <h4 className="font-semibold">About this event</h4>
                  <p className="text-sm text-muted-foreground">
                    Join us for an amazing experience at {event.title}. More details and tickets available on the full
                    event page.
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
