import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type SimilarEvent = { 
  event_id: string; 
  title: string; 
  starts_at: string; 
  score: number; 
};

export function useSimilarEvents(eventId?: string, limit = 5) {
  const [data, setData] = useState<SimilarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!eventId) {
      setData([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Use direct query for now since RPC types aren't updated yet
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('events.events')
          .select('id, title, start_at')
          .gte('start_at', new Date().toISOString())
          .neq('id', eventId)
          .order('start_at', { ascending: true })
          .limit(limit);
        
        if (error) throw error;
        
        // Transform to expected format
        const transformedData = (data || []).map(event => ({
          event_id: event.id,
          title: event.title,
          starts_at: event.start_at,
          score: 0.5,
        }));
        setData(transformedData);
      } catch (err) {
        console.error('Error fetching similar events:', err);
        setError(err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [eventId, limit]);

  return { data, loading, error };
}