import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MarketplaceSponsorship } from '@/types/sponsors';

type MarketplaceFilters = {
  city?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
};

export function useMarketplaceSponsorships(filters?: MarketplaceFilters) {
  const [items, setItems] = useState<MarketplaceSponsorship[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase.from('marketplace_sponsorships').select('*');

        if (filters?.city) {
          query = query.eq('city', filters.city);
        }
        if (filters?.category) {
          query = query.eq('category', filters.category);
        }
        if (filters?.search) {
          query = query.ilike('event_title', `%${filters.search}%`);
        }

        const { data, error: queryError } = await query;

        if (queryError) throw queryError;

        let filtered = (data ?? []).map(item => ({
          ...item,
          benefits: item.benefits as Record<string, any>
        }));

        // Apply price filters client-side since they're not in the view
        if (filters?.min_price != null || filters?.max_price != null) {
          filtered = filtered.filter(item => {
            if (filters.min_price != null && item.price_cents < filters.min_price) return false;
            if (filters.max_price != null && item.price_cents > filters.max_price) return false;
            return true;
          });
        }

        setItems(filtered);
      } catch (err) {
        console.error('Error fetching marketplace sponsorships:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch sponsorships');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [filters?.city, filters?.category, filters?.min_price, filters?.max_price, filters?.search]);

  return { items, loading, error };
}