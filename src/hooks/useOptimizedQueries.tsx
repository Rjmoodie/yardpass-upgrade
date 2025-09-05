import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Cache for frequently accessed data
const queryCache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();

interface QueryOptions {
  ttl?: number; // Time to live in milliseconds
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
}

export function useOptimizedQueries() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic cached query function
  const cachedQuery = useCallback(async <T>(
    key: string,
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): Promise<T | null> => {
    const { ttl = 5 * 60 * 1000, enabled = true } = options; // Default 5 minutes TTL

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
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
      { ttl: 10 * 60 * 1000 } // 10 minutes cache
    );
  }, [cachedQuery]);

  // Optimized events query with pagination
  const fetchEventsOptimized = useCallback(async (
    page: number = 0,
    limit: number = 20,
    category?: string
  ) => {
    const cacheKey = `events-${page}-${limit}-${category || 'all'}`;
    
    return cachedQuery(
      cacheKey,
      async () => {
        let query = supabase
          .from('events')
          .select(`
            id,
            title,
            description,
            start_at,
            end_at,
            venue,
            city,
            category,
            cover_image_url,
            visibility,
            user_profiles!events_created_by_fkey (
              display_name
            ),
            ticket_tiers (
              id,
              name,
              price_cents,
              badge_label,
              quantity,
              total_quantity
            )
          `)
          .eq('visibility', 'public')
          .order('start_at', { ascending: true })
          .range(page * limit, (page + 1) * limit - 1);

        if (category && category !== 'All') {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data;
      },
      { ttl: 2 * 60 * 1000 } // 2 minutes cache
    );
  }, [cachedQuery]);

  // Optimized organizer analytics with single query
  const fetchOrganizerAnalyticsOptimized = useCallback(async (userId: string) => {
    return cachedQuery(
      `organizer-analytics-${userId}`,
      async () => {
        // Single optimized query with all necessary joins
        const { data, error } = await supabase
          .from('events')
          .select(`
            id,
            title,
            created_at,
            tickets!fk_tickets_event_id (
              id,
              status,
              ticket_tiers!fk_tickets_tier_id (
                price_cents
              )
            ),
            ticket_scans!fk_ticket_scans_event_id (
              id
            ),
            event_posts!fk_event_posts_event_id (
              id,
              event_reactions!fk_event_reactions_post_id (
                kind
              )
            )
          `)
          .eq('created_by', userId);

        if (error) throw error;

        // Process the data to calculate analytics
        const analytics = data?.map(event => {
          const tickets = event.tickets || [];
          const scans = event.ticket_scans || [];
          const posts = event.event_posts || [];
          
          const totalRevenue = tickets
            .filter(t => t.status === 'issued')
            .reduce((sum, t) => sum + (t.ticket_tiers?.price_cents || 0), 0);
          
          const ticketSales = tickets.filter(t => t.status === 'issued').length;
          const checkIns = scans.length;
          
          const reactions = posts.flatMap(p => p.event_reactions || []);
          const likes = reactions.filter(r => r.kind === 'like').length;
          const comments = reactions.filter(r => r.kind === 'comment').length;
          const shares = reactions.filter(r => r.kind === 'share').length;

          return {
            event_id: event.id,
            event_title: event.title,
            total_revenue: totalRevenue,
            total_attendees: tickets.length,
            ticket_sales: ticketSales,
            check_ins: checkIns,
            engagement_metrics: {
              likes,
              comments,
              shares
            },
            refunds: {
              count: tickets.filter(t => t.status === 'refunded').length,
              amount: tickets
                .filter(t => t.status === 'refunded')
                .reduce((sum, t) => sum + (t.ticket_tiers?.price_cents || 0), 0)
            }
          };
        }) || [];

        return analytics;
      },
      { ttl: 5 * 60 * 1000 } // 5 minutes cache
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
    fetchEventsOptimized,
    fetchOrganizerAnalyticsOptimized,
    clearCache,
    invalidateCache
  };
}
