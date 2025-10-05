// Enhanced version using RPC functions for perfect server-side deduplication
// This version provides true uniqueness and accurate counts
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';

type Attendee = { 
  user_id: string; 
  display_name: string | null; 
  photo_url: string | null; 
  joined_at: string 
};

const PAGE_SIZE = 60;

export default function EventAttendeesPageEnhanced() {
  const { identifier } = useParams() as { identifier: string };
  const navigate = useNavigate();

  const [eventId, setEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

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

        // Get total count using RPC
        const { data: countData, error: countError } = await supabase
          .rpc('count_event_attendees', { p_event: ev.data.id });

        if (countError) {
          console.warn('Failed to get attendee count:', countError);
        } else {
          setTotalCount(countData || 0);
        }

        // Get first page using RPC
        const { data, error } = await supabase
          .rpc('get_event_attendees', { 
            p_event: ev.data.id, 
            p_limit: PAGE_SIZE, 
            p_offset: 0 
          });

        if (error) {
          setError(`Failed to load attendees: ${error.message}`);
          setLoading(false);
          return;
        }

        setAttendees(data || []);
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
      const { data, error } = await supabase
        .rpc('get_event_attendees', { 
          p_event: eventId, 
          p_limit: PAGE_SIZE, 
          p_offset: from 
        });

      if (error) throw error;
      setAttendees(prev => [...prev, ...(data || [])]);
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
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
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
            {totalCount > 0 ? `${totalCount} total attendees` : `${attendees.length} attendees`}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {attendees.map((attendee) => (
              <Link
                key={attendee.user_id}
                to={`/u/${attendee.user_id}`}
                className="p-3 border rounded-md flex items-center gap-3 hover:bg-muted transition-colors"
              >
                {attendee.photo_url ? (
                  <img
                    src={attendee.photo_url}
                    alt={attendee.display_name || 'User'}
                    className="h-10 w-10 rounded-full object-cover bg-muted"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {(attendee.display_name || 'U').slice(0,1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {attendee.display_name || 'User'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Joined {new Date(attendee.joined_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6">
              <Button onClick={loadMore} disabled={loadingMore} className="w-full">
                {loadingMore && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Load more ({totalCount > 0 ? `${totalCount - attendees.length} remaining` : 'more'})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
