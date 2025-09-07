import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Share2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { parseEventIdentifier, getEventShareUrl } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ImageWithFallback } from '@/components/figma/ImageWithFallback';
import { sharePayload } from '@/lib/share';
import { buildShareUrl, getShareTitle, getShareText } from '@/lib/shareLinks';

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
  events_created_by_fkey?: { display_name?: string | null } | null; // optional
  organizations?: { id: string; name: string; slug: string | null; avatar_url: string | null } | null;
  [key: string]: any; // Allow additional properties from Supabase
};

type Attendee = { id: string; display_name: string | null; avatar_url: string | null };

export default function EventSlugPage() {
  const { identifier: rawParam } = useParams() as { identifier: string };
  const navigate = useNavigate();
  const { identifier } = parseEventIdentifier(rawParam);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState<number>(0);

  // Fetch event by slug OR id
  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);

      // 1) event by slug
      let query = supabase
        .from('events')
        .select(`
          id, slug, title, description, category, start_at, end_at, venue, city, country, cover_image_url,
          owner_context_type, owner_context_id,
          organizations:organizations!events_owner_context_id_fkey(id, name, slug, avatar_url)
        `)
        .eq('slug', identifier)
        .limit(1);

      let { data, error } = await query;

      // if not found and looks like UUID, try by id
      if ((!data || !data.length) && /^[0-9a-f-]{36}$/i.test(identifier)) {
        const byId = await supabase
          .from('events')
          .select(`
            id, slug, title, description, category, start_at, end_at, venue, city, country, cover_image_url,
            owner_context_type, owner_context_id,
            organizations:organizations!events_owner_context_id_fkey(id, name, slug, avatar_url)
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
      setEvent(ev as any);

      if (ev) {
        // attendees preview (first 12) + total count
        const { data: atts } = await supabase
          .from('tickets')
          .select('owner_user_id, user_profiles!inner(id, display_name, avatar_url)')
          .eq('event_id', ev.id)
          .in('status', ['issued', 'transferred', 'redeemed'])
          .limit(12);

        const { count } = await supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('event_id', ev.id)
          .in('status', ['issued', 'transferred', 'redeemed']);

        setAttendees(
          (atts || []).map((t: any) => ({
            id: t.user_profiles.id,
            display_name: t.user_profiles.display_name,
            avatar_url: t.user_profiles.avatar_url
          }))
        );
        setAttendeeCount(count || 0);
      }
      setLoading(false);
    })();
    return () => { isMounted = false; };
  }, [identifier]);

  const when = useMemo(() => {
    if (!event?.start_at) return null;
    try {
      const start = new Date(event.start_at);
      return start.toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    } catch { return null; }
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
    title: event.title || ''
  });

  return (
    <div className="pb-20">
      {/* COVER */}
      {event.cover_image_url ? (
        <div className="relative">
          <ImageWithFallback
            src={event.cover_image_url}
            alt={event.title}
            className="w-full h-64 object-cover"
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
                  <Badge variant="secondary" className="mb-2">{event.category}</Badge>
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
                    <span>
                      {[event.venue, event.city, event.country].filter(Boolean).join(' • ') || 'Location TBA'}
                    </span>
                  </div>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  sharePayload({
                    title: getShareTitle({ type: 'event', slug: event.slug ?? event.id, title: event.title }),
                    text: getShareText({
                      type: 'event',
                      slug: event.slug ?? event.id,
                      title: event.title,
                      city: event.city ?? undefined,
                      date: when ?? undefined
                    }),
                    url: shareUrl
                  });
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>

            {/* WHO'S GOING */}
            <div className="mt-5 flex items-center justify-between">
              <div className="flex -space-x-2 overflow-hidden">
                {attendees.map((a) => (
                  <img
                    key={a.id}
                    src={a.avatar_url || ''}
                    alt={a.display_name || 'attendee'}
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover bg-muted"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
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
                  to={`/org/${event.organizations.slug ?? event.organizations.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {event.organizations.name}
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}