import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type Rec = { 
  event_id: string; 
  title: string; 
  category: string | null; 
  starts_at: string; 
  distance_km: number | null; 
  score: number;
  cover_image_url: string | null;
  description: string | null;
  venue: string | null;
  min_price: number | null;
};

export function useRecommendations(userId?: string, limit = 8) {
  const [data, setData] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let canceled = false;

    const run = async () => {
      if (!userId) {
        setData([]);
        return;
      }
      setLoading(true);
      setError(null);

      // helper to safely set state
      const safeSet = (fn: () => void) => { if (!canceled) fn(); };

      // 1) Try RPC (personalized)
      try {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_recommendations', { p_user_id: userId, p_limit: limit });

        if (rpcError) throw rpcError;

        if (Array.isArray(rpcData) && rpcData.length) {
          const recs: Rec[] = rpcData.map((r: any) => ({
            event_id: r.event_id,
            title: r.title,
            category: r.category ?? null,
            starts_at: r.starts_at,
            distance_km: typeof r.distance_km === 'number' ? r.distance_km : null,
            score: typeof r.score === 'number' ? r.score : 1,
            cover_image_url: r.cover_image_url ?? null,
            description: r.description ?? null,
            venue: r.venue ?? null,
            min_price: r.min_price ?? null,
          }));
          safeSet(() => setData(recs));
          return;
        }
      } catch (e) {
        // swallow to fallback
        console.warn('RPC get_recommendations failed or not available, falling back.', e);
      }

      // 2) Fallback to upcoming events (generic)
      try {
        const { data: rows, error: selError } = await supabase
          .from('events.events')
          .select('id, title, category, start_at, cover_image_url, description, venue')
          .gte('start_at', new Date().toISOString())
          .order('start_at', { ascending: true })
          .limit(limit);

        if (selError) throw selError;

        const transformed: Rec[] = (rows || []).map((event: any) => ({
          event_id: event.id,
          title: event.title,
          category: event.category ?? null,
          starts_at: event.start_at,
          distance_km: null,
          score: 1,
          cover_image_url: event.cover_image_url ?? null,
          description: event.description ?? null,
          venue: event.venue ?? null,
          min_price: null,
        }));

        safeSet(() => setData(transformed));
      } catch (err) {
        console.error('Error fetching fallback recommendations:', err);
        safeSet(() => {
          setError(err);
          setData([]);
        });
      } finally {
        safeSet(() => setLoading(false));
      }
    };

    run();
    return () => { canceled = true; };
  }, [userId, limit]);

  return { data, loading, error };
}
