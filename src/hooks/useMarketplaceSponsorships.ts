import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface SponsorshipPackage {
  id: string;
  event_id: string;
  title: string;
  description?: string;
  price_cents: number;
  currency: string;
  inventory: number;
  sold: number;
  benefits: any;
  is_active: boolean;
  created_at: string;
  // Joined fields
  event_title?: string;
  event_city?: string;
  event_category?: string;
  event_start_at?: string;
}

export interface SponsorshipOrder {
  id: string;
  package_id: string;
  sponsor_id: string;
  event_id: string;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'requires_payment' | 'escrow' | 'paid' | 'cancelled' | 'refunded';
  stripe_payment_intent_id?: string;
  transfer_group?: string;
  application_fee_cents: number;
  created_at: string;
  updated_at: string;
  // Joined fields
  package?: SponsorshipPackage;
  event_title?: string;
  sponsor_name?: string;
}

type MarketplaceFilters = {
  city?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
};

export function useMarketplaceSponsorships(filters?: MarketplaceFilters) {
  return useQuery({
    queryKey: ['marketplace-sponsorships', filters],
    queryFn: async () => {
      let query = supabase
        .from('sponsorship_packages')
        .select(`
          id,
          event_id,
          title,
          description,
          price_cents,
          currency,
          inventory,
          sold,
          benefits,
          is_active,
          created_at,
          events!inner(
            title,
            city,
            category,
            start_at
          )
        `)
        .eq('is_active', true)
        .eq('visibility', 'public')
        .gt('inventory', 0); // Only show packages with inventory

      if (filters?.city) {
        query = query.eq('events.city', filters.city);
      }
      if (filters?.category) {
        query = query.eq('events.category', filters.category);
      }
      if (filters?.search) {
        query = query.ilike('title', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      let packages = data.map(pkg => ({
        ...pkg,
        event_title: pkg.events?.title,
        event_city: pkg.events?.city,
        event_category: pkg.events?.category,
        event_start_at: pkg.events?.start_at,
      })) as SponsorshipPackage[];

      // Apply price filters client-side
      if (filters?.min_price != null || filters?.max_price != null) {
        packages = packages.filter(pkg => {
          if (filters.min_price != null && pkg.price_cents < filters.min_price) return false;
          if (filters.max_price != null && pkg.price_cents > filters.max_price) return false;
          return true;
        });
      }

      return packages;
    },
  });
}

export function useEventSponsorshipPackages(eventId: string) {
  return useQuery({
    queryKey: ['event-sponsorship-packages', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsorship_packages')
        .select('*')
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SponsorshipPackage[];
    },
    enabled: !!eventId,
  });
}

export function useSponsorOrders(sponsorId: string) {
  return useQuery({
    queryKey: ['sponsor-orders', sponsorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsorship_orders')
        .select(`
          *,
          sponsorship_packages!inner(
            title,
            description,
            benefits
          ),
          events!inner(
            title
          ),
          sponsors!inner(
            name
          )
        `)
        .eq('sponsor_id', sponsorId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(order => ({
        ...order,
        package: order.sponsorship_packages as any,
        event_title: order.events?.title,
        sponsor_name: order.sponsors?.name,
      })) as SponsorshipOrder[];
    },
    enabled: !!sponsorId,
  });
}

export function useOrganizerSponsorshipOrders(eventId: string) {
  return useQuery({
    queryKey: ['organizer-sponsorship-orders', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sponsorship_orders')
        .select(`
          *,
          sponsorship_packages!inner(
            title,
            description,
            benefits
          ),
          sponsors!inner(
            name
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(order => ({
        ...order,
        package: order.sponsorship_packages as any,
        sponsor_name: order.sponsors?.name,
      })) as SponsorshipOrder[];
    },
    enabled: !!eventId,
  });
}

export function useProcessPayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('sponsor-payout', {
        body: { orderId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, orderId) => {
      toast({
        title: 'Payout Processed',
        description: 'The sponsorship funds have been transferred to the organizer.',
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['sponsor-orders'] });
      queryClient.invalidateQueries({ queryKey: ['organizer-sponsorship-orders'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Payout Failed',
        description: error.message || 'Failed to process payout',
        variant: 'destructive',
      });
    },
  });
}