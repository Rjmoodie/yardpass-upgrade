import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Rec = { 
  event_id: string; 
  title: string; 
  category: string | null; 
  starts_at: string; 
  distance_km: number | null; 
  score: number; 
};

export function useRecommendations(userId?: string, limit = 8) {
  const [data, setData] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!userId) {
      setData([]);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Use direct query for now since RPC types aren't updated yet
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, category, start_at')
          .gte('start_at', new Date().toISOString())
          .order('start_at', { ascending: true })
          .limit(limit);
        
        if (error) throw error;
        
        // Transform to expected format
        const transformedData = (data || []).map(event => ({
          event_id: event.id,
          title: event.title,
          category: event.category,
          starts_at: event.start_at,
          distance_km: null,
          score: 1,
        }));
        setData(transformedData);
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError(err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [userId, limit]);

  return { data, loading, error };
}