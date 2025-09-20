import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Share2, Users, Ticket, Clock } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { sharePayload } from '@/lib/share';
import { buildShareUrl, getShareTitle, getShareText } from '@/lib/shareLinks';
import { EventTicketModal } from '@/components/EventTicketModal';

const MapCard = lazy(() => import('@/components/maps/MapCard'));

type EventRow = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  category: string | null;
  start_at: string | null;
  end_at: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  cover_image_url: string | null;
  owner_context_type: 'organization' | 'individual';
  owner_context_id: string;
  organizations?: { id: string; name: string; handle: string | null } | null;
};

type Attendee = { id: string; display_name: string | null; photo_url: string | null };

// ----------------- small helpers -----------------
const safeOrigin =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://yardpass.app'; // fallback to your prod origin if SSR or during build

function stripHtml(input: string | null | undefined) {
  if (!input) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = input;
  return (tmp.textContent || tmp.innerText || '').trim();
}

function truncate(s: string, n = 160) {
  if (!s) return '';
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function buildMeta(ev: EventRow, whenText: string | null, canonical: string) {
  const title = ev?.title ? `${ev.title}${ev.city ? ` — ${ev.city}` : ''}` : 'Event';
  const loc = [ev.venue, ev.city, ev.country].filter(Boolean).join(', ');
  const baseDesc =
    stripHtml(ev.description) ||
    [whenText || 'Date TBA', loc || 'Location TBA'].filter(Boolean).join(' • ');
  const description = truncate(baseDesc, 180);

  return {
    title,
    description,
    canonical,
    ogType: 'website' as const,
    image: ev.cover_image_url || undefined,
  };
}

export default function EventSlugPage() {
  const { identifier: rawParam } = useParams() as { identifier: string };
  const navigate = useNavigate();
  const { identifier } = parseEventIdentifier(rawParam);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState<number>(0);
  const [geoReady, setGeoReady] = useState(false); // for JSON-LD enhancement later if you add coords
  const [showTicketModal, setShowTicketModal] = useState(false);

  // Fetch event by slug OR id
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);

      try {
        // Get current user
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id;

        // 1) event by slug
        let { data, error } = await supabase
          .from('events')
          .select(`
            id, slug, title, description, category, start_at, end_at, venue, city, country, cover_image_url,
            owner_context_type, owner_context_id, visibility,
            organizations:organizations!events_owner_context_id_fkey(id, name, handle)
          `)
          .eq('slug', identifier)
          .limit(1);

        // if not found and looks like UUID, try by id
        if ((!data || !data.length) && /^[0-9a-f-]{36}$/i.test(identifier)) {
          const byId = await supabase
            .from('events')
            .select(`
              id, slug, title, description, category, start_at, end_at, venue, city, country, cover_image_url,
              owner_context_type, owner_context_id, visibility,
              organizations:organizations!events_owner_context_id_fkey(id, name, handle)
            `)
            .eq('id', identifier)
            .limit(1);
          data = byId.data;
          error = byId.error;
        }

        if (!isMounted) return;
        if (error) {
          setLoading(false);
          return;
        }

        const ev = data?.[0] ?? null;
        
        // Check if user can view this event
        if (ev) {
          const { canViewEvent } = await import('@/lib/permissions');
          const canView = await canViewEvent(ev.id, userId);
          
          if (!canView.allowed) {
            // Show RequestAccess component for private events
            const RequestAccess = (await import('@/components/RequestAccess')).default;
            setEvent(null);
            setLoading(false);
            navigate(`/request-access/${ev.id}`, { replace: true });
            return;
          }
        }
        
        setEvent(ev);

        if (ev) {
          // attendees preview (first 12) + total count
          const [{ data: atts }, { count }] = await Promise.all([
            supabase
              .from('tickets')
              .select('owner_user_id, user_profiles!inner(id, display_name, photo_url)')
              .eq('event_id', ev.id)
              .in('status', ['issued', 'transferred', 'redeemed'])
              .limit(12),
            supabase
              .from('tickets')
              .select('id', { count: 'exact', head: true })
              .eq('event_id', ev.id)
              .in('status', ['issued', 'transferred', 'redeemed']),
          ]);

          setAttendees(
            (atts || []).map((t: any) => ({
              id: t.user_profiles.id,
              display_name: t.user_profiles.display_name,
              photo_url: t.user_profiles.photo_url,
            }))
          );
          setAttendeeCount(count || 0);
        }
        setLoading(false);
      } catch (error) {
        console.error('Event fetch error:', error);
        setEvent(null);
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [identifier]);

  const when = useMemo(() => {
    if (!event?.start_at) return null;
    try {
      const start = new Date(event.start_at);
      return start.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  }, [event?.start_at]);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        Event not found
      </div>
    );
  }

  const shareUrl = buildShareUrl({
    type: 'event',
    slug: event.slug ?? event.id,
    title: event.title || '',
  });

  const fullAddress =
    [event.venue, event.city, event.country].filter(Boolean).join(', ') || undefined;

  const meta = buildMeta(event, when, `${safeOrigin}${shareUrl}`);

  // Build JSON-LD
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    startDate: event.start_at || undefined,
    endDate: event.end_at || undefined,
    image: event.cover_image_url ? [event.cover_image_url] : undefined,
    description: stripHtml(event.description),
    location: fullAddress
      ? {
          '@type': 'Place',
          name: event.venue || undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: event.venue || undefined,
            addressLocality: event.city || undefined,
            addressCountry: event.country || undefined,
          },
        }
      : undefined,
    organizer: event.organizations
      ? {
          '@type': 'Organization',
          name: event.organizations.name,
          url: `${safeOrigin}/org/${event.organizations.handle ?? event.organizations.id}`,
        }
      : undefined,
    url: `${safeOrigin}${shareUrl}`,
  };

  return (
    <div className="pb-20">
      {/* SEO + preload hero */}
      <Helmet prioritizeSeoTags>
        <title>{meta.title}</title>
        {meta.canonical && <link rel="canonical" href={meta.canonical} />}
        <meta name="description" content={meta.description} />
        {/* Open Graph */}
        <meta property="og:type" content={meta.ogType} />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={meta.canonical} />
        {meta.image && <meta property="og:image" content={meta.image} />}
        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        {meta.image && <meta name="twitter:image" content={meta.image} />}
        {/* Preload hero image for better LCP */}
        {event.cover_image_url ? (
          <link rel="preload" as="image" href={event.cover_image_url} />
        ) : null}
        {/* JSON-LD */}
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* COVER */}
      {event.cover_image_url ? (
        <div className="relative">
          <ImageWithFallback
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-64 object-cover"
            fetchPriority="high"
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
        </div>
      ) : null}

      {/* HEADER */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 relative">
        <Card className="shadow-lg">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                {event.category ? (
                  <Badge variant="secondary" className="mb-2">
                    {event.category}
                  </Badge>
                ) : null}
                <h1 className="text-xl md:text-2xl font-semibold leading-tight">
                  {event.title}
                </h1>
                <div className="mt-2 text-sm text-muted-foreground space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{when ?? 'Date TBA'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    <span>{fullAddress || 'Location TBA'}</span>
                  </div>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  sharePayload({
                    title: getShareTitle({
                      type: 'event',
                      slug: event.slug ?? event.id,
                      title: event.title,
                    }),
                    text: getShareText({
                      type: 'event',
                      slug: event.slug ?? event.id,
                      title: event.title,
                      city: event.city ?? undefined,
                      date: when ?? undefined,
                    }),
                    url: buildShareUrl({
                      type: 'event',
                      slug: event.slug ?? event.id,
                      title: event.title || '',
                    }),
                  });
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            {/* GET TICKETS BUTTON */}
            <div className="mt-5">
              <Button 
                className="w-full"
                size="lg"
                onClick={() => {
                  console.log('Get tickets clicked for event:', event.id);
                  setShowTicketModal(true);
                }}
              >
                <Ticket className="w-5 h-5 mr-2" />
                Get Tickets
              </Button>
            </div>

            {/* WHO'S GOING */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex -space-x-2 overflow-hidden">
                {attendees.map((a) => (
                  <img
                    key={a.id}
                    src={a.photo_url || ''}
                    alt={a.display_name || 'attendee'}
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover bg-muted"
                    onError={(e) =>
                      ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')
                    }
                    loading="lazy"
                  />
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/e/${event.slug ?? event.id}/attendees`)}
              >
                <Users className="w-4 h-4 mr-2" />
                See who's going {attendeeCount ? `(${attendeeCount})` : ''}
              </Button>
            </div>

            {/* ORGANIZER LINK */}
            {event.organizations ? (
              <div className="mt-4 text-sm">
                Hosted by{' '}
                <Link
                  to={`/org/${event.organizations.handle ?? event.organizations.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {event.organizations.name}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* MAP */}
      {fullAddress ? (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <Suspense
            fallback={<div className="h-64 w-full bg-muted animate-pulse rounded-lg" />}
          >
            <MapCard
              address={fullAddress}
              title={event.title}
              height={280}
              showControls={false}
            />
          </Suspense>
        </div>
      ) : null}

      {/* EVENT DESCRIPTION */}
      {event.description ? (
        <div className="max-w-3xl mx-auto px-4 mt-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold mb-3">About this event</h2>
              <div 
                className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* EVENT DETAILS */}
      <div className="max-w-3xl mx-auto px-4 mt-4">
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold mb-4">Event Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {event.start_at && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Date & Time</div>
                    <div className="text-muted-foreground">
                      {new Date(event.start_at).toLocaleDateString(undefined, {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(event.start_at).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                      {event.end_at && ` - ${new Date(event.end_at).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}`}
                    </div>
                  </div>
                </div>
              )}
              
              {fullAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <div className="font-medium">Location</div>
                    <div className="text-muted-foreground">
                      {event.venue && <div>{event.venue}</div>}
                      <div>{[event.city, event.country].filter(Boolean).join(', ')}</div>
                    </div>
                  </div>
                </div>
              )}

              {event.category && (
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Category</div>
                    <div className="text-muted-foreground">{event.category}</div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Attendees</div>
                  <div className="text-muted-foreground">
                    {attendeeCount > 0 ? `${attendeeCount} going` : 'Be the first to attend'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* EVENT TICKET MODAL */}
      <EventTicketModal
        event={event ? {
          id: event.id,
          title: event.title,
          start_at: event.start_at || '',
          venue: event.venue || undefined,
          address: fullAddress,
          description: stripHtml(event.description) || undefined
        } : null}
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        onSuccess={() => {
          setShowTicketModal(false);
          // Optionally refresh attendee count
        }}
      />
    </div>
  );
}