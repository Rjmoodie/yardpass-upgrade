import { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { canViewEvent } from '@/lib/permissions';
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

      // 1) Fetch event
      const { data: ev, error } = await supabase
        .from('events')
        .select('id,title,description,start_at,venue,address')
        .eq('id', id)
        .single();

      if (error || !ev) {
        setEvent(null);
        setLoading(false);
        return;
      }

      // For now, all events are accessible (visibility logic will be added later)
      // TODO: Add visibility and link_token logic once columns are available in types

      setEvent(ev);
      setLoading(false);
    })();
  }, [id, kParam, user?.id]);

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
        <span className="text-xs uppercase tracking-wide text-muted-foreground">public</span>
        <h1 className="text-2xl font-bold">{event.title}</h1>
      </div>
      <p className="text-muted-foreground mb-6">{event.description}</p>
      <div className="text-sm">
        <div><strong>When:</strong> {new Date(event.start_at).toLocaleString()}</div>
        {event.venue && <div><strong>Venue:</strong> {event.venue}</div>}
        {event.address && <div><strong>Address:</strong> {event.address}</div>}
      </div>
    </div>
  );
}