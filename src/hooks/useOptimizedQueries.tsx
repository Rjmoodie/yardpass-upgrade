import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMemoizedSelector } from './useMemoizedSelector';

// Cache for frequently accessed data
const queryCache = new Map();

interface QueryOptions {
  ttl?: number;
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
}

export function useOptimizedQueries() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic cached query function
  const cachedQuery = useCallback(async (
    key: string,
    queryFn: () => Promise<any>,
    options: QueryOptions = {}
  ) => {
    const { ttl = 5 * 60 * 1000, enabled = true } = options;

    if (!enabled) return null;

    // Check cache first
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    try {
      setLoading(true);
      setError(null);
      
      const data = await queryFn();
      
      // Cache the result
      queryCache.set(key, {
        data,
        timestamp: Date.now(),
        ttl
      });
      
      return data;
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Optimized user profile query with joins
  const fetchUserProfileOptimized = useCallback(async (userId: string) => {
    return cachedQuery(
      `user-profile-${userId}`,
      async () => {
        const { data, error } = await supabase
          .from('user_profiles')
          .select(`
            *,
            tickets!fk_tickets_owner_user_id (
              id,
              status,
              created_at,
              events!fk_tickets_event_id (
                id,
                title,
                start_at,
                venue,
                address,
                cover_image_url,
                category
              ),
              ticket_tiers!fk_tickets_tier_id (
                name,
                badge_label
              )
            ),
            events!events_created_by_fkey (
              id,
              title,
              start_at,
              venue,
              address,
              cover_image_url,
              category
            )
          `)
          .eq('user_id', userId)
          .single();

        if (error) throw error;
        return data;
      },
      { ttl: 10 * 60 * 1000 }
    );
  }, [cachedQuery]);

  // Clear cache function
  const clearCache = useCallback((pattern?: string) => {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const key of queryCache.keys()) {
        if (regex.test(key)) {
          queryCache.delete(key);
        }
      }
    } else {
      queryCache.clear();
    }
  }, []);

  // Invalidate specific cache entry
  const invalidateCache = useCallback((key: string) => {
    queryCache.delete(key);
  }, []);

  return {
    loading,
    error,
    fetchUserProfileOptimized,
    clearCache,
    invalidateCache
  };
}