import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canViewEvent } from '@/lib/permissions';
import { parseEventIdentifier } from '@/lib/eventRouting';
import { Button } from '@/components/ui/button';
import RequestAccess from '@/components/RequestAccess';
import { Skeleton } from '@/components/ui/skeleton';

type EventRow = {
  id: string;
  title: string;
  description: string;
  start_at: string;
  venue?: string | null;
  address?: string | null;
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
        .select('id,title,description,start_at,venue,address,slug');
      
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
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Event not found</h1>
        <p className="text-muted-foreground mb-4">It may be private, unlisted without a valid key, or deleted.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  // Normal details UI
  return (
    <div className="p-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">public</span>
          {event.slug && (
            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
              SEO Optimized
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        {event.slug && (
          <p className="text-sm text-muted-foreground mt-1">
            URL: /events/{event.slug}
          </p>
        )}
      </div>
      <p className="text-muted-foreground mb-6">{event.description}</p>
      <div className="text-sm">
        <div><strong>When:</strong> {new Date(event.start_at).toLocaleString()}</div>
        {event.venue && <div><strong>Venue:</strong> {event.venue}</div>}
        {event.address && <div><strong>Address:</strong> {event.address}</div>}
      </div>
      
      <div className="mt-6">
        <Button
          variant="outline"
          onClick={() => {
            import('@/lib/share').then(({ sharePayload }) => {
              import('@/lib/shareLinks').then(({ buildShareUrl, getShareTitle, getShareText }) => {
                const ident = (event as any).slug ?? event.id;
                sharePayload({
                  title: getShareTitle({ type: 'event', slug: ident, title: event.title }),
                  text: getShareText({ type: 'event', slug: ident, title: event.title, city: event.venue, date: new Date(event.start_at).toLocaleDateString() }),
                  url: buildShareUrl({ type: 'event', slug: ident, title: event.title })
                });
              });
            });
          }}
        >
          Share Event
        </Button>
      </div>
    </div>
  );
}