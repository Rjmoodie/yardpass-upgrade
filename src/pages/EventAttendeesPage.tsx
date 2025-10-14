import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import { YardpassSpinner } from '@/components/LoadingSpinner';

type TicketRow = { 
  owner_user_id: string;
  created_at: string;
  user_profiles: { id: string; display_name: string | null; photo_url: string | null } | null;
};

const PAGE_SIZE = 60;

export default function EventAttendeesPage() {
  const { identifier } = useParams() as { identifier: string };
  const navigate = useNavigate();

  const [eventId, setEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Unique attendees (client-side dedupe)
  const attendees = useMemo(() => {
    const seen = new Set<string>();
    const uniq: TicketRow[] = [];
    for (const r of rows) {
      const id = r.user_profiles?.id;
      if (id && !seen.has(id)) {
        seen.add(id);
        uniq.push(r);
      }
    }
    return uniq;
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Try by slug first
        const bySlug = await supabase
          .from('events')
          .select('id, title')
          .eq('slug', identifier)
          .limit(1)
          .maybeSingle();

        let ev = bySlug;
        if (!ev.data && /^[0-9a-f-]{36}$/i.test(identifier)) {
          // Fallback by id if identifier looks like a UUID
          ev = await supabase
            .from('events')
            .select('id, title')
            .eq('id', identifier)
            .limit(1)
            .maybeSingle();
        }

        if (cancelled) return;

        if (ev.error) {
          setError(`Failed to load event: ${ev.error.message}`);
          setLoading(false);
          return;
        }
        if (!ev.data) {
          setError('Event not found');
          setLoading(false);
          return;
        }

        setEventId(ev.data.id);
        setTitle(ev.data.title);

        // first page
        const { data, error } = await supabase
          .from('tickets')
          .select('owner_user_id, user_profiles!inner(id, display_name, photo_url), created_at')
          .eq('event_id', ev.data.id)
          .in('status', ['issued', 'transferred', 'redeemed'])
          .order('created_at', { ascending: false })
          .range(0, PAGE_SIZE - 1);

        if (error) {
          setError(`Failed to load attendees: ${error.message}`);
          setLoading(false);
          return;
        }

        setRows((data || []) as unknown as TicketRow[]);
        setHasMore((data?.length || 0) === PAGE_SIZE);
        setPage(1);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError('An unexpected error occurred');
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [identifier]);

  const loadMore = async () => {
    if (!eventId || loadingMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('tickets')
        .select('owner_user_id, user_profiles!inner(id, display_name, photo_url), created_at')
        .eq('event_id', eventId)
        .in('status', ['issued', 'transferred', 'redeemed'])
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setRows(prev => [...prev, ...((data || []) as unknown as TicketRow[])]);
      setHasMore((data?.length || 0) === PAGE_SIZE);
      setPage(prev => prev + 1);
    } catch (e: any) {
      setError(`Failed to load more: ${e.message || 'Unknown error'}`);
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <YardpassSpinner className="mx-auto mb-4" />
            <p className="text-muted-foreground">Loading attendees...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Attendees — {title}
        </h1>
      </div>

      {attendees.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No attendees yet</p>
          <p className="text-sm text-muted-foreground mt-2">
            Be the first to get a ticket for this event!
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {attendees.length} {attendees.length === 1 ? 'attendee' : 'attendees'}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {attendees.map(({ user_profiles }) => user_profiles && (
              <Link
                key={user_profiles.id}
                to={`/u/${user_profiles.id}`}
                className="p-3 border rounded-md flex items-center gap-3 hover:bg-muted transition-colors"
              >
                {user_profiles.photo_url ? (
                  <img
                    src={user_profiles.photo_url}
                    alt={user_profiles.display_name || 'User'}
                    className="h-10 w-10 rounded-full object-cover bg-muted"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {(user_profiles.display_name || 'U').slice(0,1).toUpperCase()}
                  </div>
                )}
                <div className="text-sm font-medium">
                  {user_profiles.display_name || 'User'}
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6">
              <Button onClick={loadMore} disabled={loadingMore} className="w-full">
                {loadingMore && (
                  <YardpassSpinner size="xs" showGlow={false} showLogo={false} className="mr-2" />
                )}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}