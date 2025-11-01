// Supabase client configuration for sponsorship system
// Extends base client with sponsorship-specific functionality

import { supabase } from './client';
import type {
  SponsorComplete,
  SponsorshipPackage,
  SponsorshipMatch,
  ProposalThread,
  Deliverable,
  SponsorshipOrderComplete,
  SponsorshipAnalytics,
  ApiResponse,
  PaginatedResponse,
  SponsorshipSearchResponse,
  CreateSponsorRequest,
  UpdateSponsorProfileRequest,
  CreatePackageRequest,
  CreateProposalRequest,
  UpdateMatchStatusRequest,
  CreateDeliverableRequest,
  SubmitDeliverableProofRequest,
  SponsorshipNotification,
  RealTimeMatchUpdate,
  SponsorshipWebhookPayload
} from '../../types/sponsorship-complete';

// Use existing Supabase client instead of creating duplicate

// === Sponsorship System API Client ===
// This client wraps the base Supabase client with sponsorship-specific functionality

export class SponsorshipClient {
  private client = supabase;

  // === Sponsor Management ===

  async createSponsor(data: CreateSponsorRequest): Promise<ApiResponse<SponsorComplete>> {
    try {
      const { data: sponsor, error } = await this.client
        .from('sponsors')
        .insert([data])
        .select(`
          *,
          sponsor_profiles!inner(*),
          sponsor_public_profiles(*)
        `)
        .single();

      if (error) throw error;

      return { success: true, data: sponsor };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getSponsor(id: string): Promise<ApiResponse<SponsorComplete>> {
    try {
      const { data: sponsor, error } = await this.client
        .from('sponsors')
        .select(`
          *,
          sponsor_profiles!inner(*),
          sponsor_public_profiles(*),
          sponsor_members(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return { success: true, data: sponsor };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async updateSponsorProfile(
    sponsorId: string, 
    updates: UpdateSponsorProfileRequest
  ): Promise<ApiResponse<SponsorComplete>> {
    try {
      const { data, error } = await this.client
        .from('sponsor_profiles')
        .update(updates)
        .eq('sponsor_id', sponsorId)
        .select(`
          *,
          sponsors!inner(*)
        `)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Package Management ===

  async createPackage(data: CreatePackageRequest): Promise<ApiResponse<SponsorshipPackage>> {
    try {
      const { data: package_, error } = await this.client
        .from('sponsorship_packages')
        .insert([data])
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data: package_ };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getPackages(
    filters?: {
      eventId?: string;
      sponsorId?: string;
      category?: string;
      priceRange?: [number, number];
      qualityTier?: string;
    },
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<PaginatedResponse<SponsorshipPackage>>> {
    try {
      let query = this.client
        .from('v_sponsorship_package_cards')
        .select('*', { count: 'exact' });

      // Apply filters
      if (filters?.eventId) {
        query = query.eq('event_id', filters.eventId);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.priceRange) {
        query = query
          .gte('price_cents', filters.priceRange[0])
          .lte('price_cents', filters.priceRange[1]);
      }
      if (filters?.qualityTier) {
        query = query.eq('quality_tier', filters.qualityTier);
      }

      // Apply pagination
      if (pagination) {
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);
      }

      const { data: packages, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data: {
          data: packages || [],
          pagination: {
            page: pagination?.page || 1,
            limit: pagination?.limit || 10,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / (pagination?.limit || 10))
          }
        }
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Matching System ===

  async getMatches(
    eventId?: string,
    sponsorId?: string,
    status?: string
  ): Promise<ApiResponse<SponsorshipMatch[]>> {
    try {
      let query = this.client
        .from('sponsorship_matches')
        .select(`
          *,
          events!inner(*),
          sponsors!inner(*)
        `);

      if (eventId) query = query.eq('event_id', eventId);
      if (sponsorId) query = query.eq('sponsor_id', sponsorId);
      if (status) query = query.eq('status', status);

      const { data: matches, error } = await query;

      if (error) {
        // Gracefully handle 404 - table not yet deployed
        if (error.message?.includes('not found') || error.code === 'PGRST204' || error.code === 'PGRST116') {
          console.warn('[SponsorshipClient] sponsorship_matches table not deployed yet');
          return { success: true, data: [] };
        }
        throw error;
      }

      return { success: true, data: matches || [] };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async updateMatchStatus(
    matchId: string,
    updates: UpdateMatchStatusRequest
  ): Promise<ApiResponse<SponsorshipMatch>> {
    try {
      const { data: match, error } = await this.client
        .from('sponsorship_matches')
        .update(updates)
        .eq('id', matchId)
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data: match };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Proposal System ===

  async createProposal(data: CreateProposalRequest): Promise<ApiResponse<ProposalThread>> {
    try {
      const { data: thread, error } = await this.client
        .from('proposal_threads')
        .insert([{
          event_id: data.event_id,
          sponsor_id: data.sponsor_id,
          status: 'sent',
          created_by: (await this.client.auth.getUser()).data.user?.id
        }])
        .select('*')
        .single();

      if (error) throw error;

      // Create initial message
      if (data.message || data.offer) {
        await this.client
          .from('proposal_messages')
          .insert([{
            thread_id: thread.id,
            sender_type: 'organizer',
            sender_user_id: (await this.client.auth.getUser()).data.user?.id!,
            body: data.message,
            offer: data.offer,
            attachments: data.attachments
          }]);
      }

      return { success: true, data: thread };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async getProposalThreads(
    eventId?: string,
    sponsorId?: string
  ): Promise<ApiResponse<ProposalThread[]>> {
    try {
      let query = this.client
        .from('proposal_threads')
        .select(`
          *,
          proposal_messages(*)
        `);

      if (eventId) query = query.eq('event_id', eventId);
      if (sponsorId) query = query.eq('sponsor_id', sponsorId);

      const { data: threads, error } = await query;

      if (error) {
        // Gracefully handle 404 - table not yet deployed
        if (error.message?.includes('not found') || error.code === 'PGRST204' || error.code === 'PGRST116') {
          console.warn('[SponsorshipClient] proposal_threads table not deployed yet');
          return { success: true, data: [] };
        }
        throw error;
      }

      return { success: true, data: threads || [] };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Deliverable Management ===

  async createDeliverable(data: CreateDeliverableRequest): Promise<ApiResponse<Deliverable>> {
    try {
      const { data: deliverable, error } = await this.client
        .from('deliverables')
        .insert([data])
        .select('*')
        .single();

      if (error) throw error;

      return { success: true, data: deliverable };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async submitDeliverableProof(
    deliverableId: string,
    proof: SubmitDeliverableProofRequest
  ): Promise<ApiResponse<void>> {
    try {
      const { error } = await this.client
        .from('deliverable_proofs')
        .insert([{
          deliverable_id: deliverableId,
          asset_url: proof.asset_url,
          metrics: proof.metrics,
          submitted_by: (await this.client.auth.getUser()).data.user?.id
        }]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Analytics ===

  async getSponsorshipAnalytics(
    eventId?: string,
    sponsorId?: string,
    dateRange?: { from: string; to: string }
  ): Promise<ApiResponse<SponsorshipAnalytics>> {
    try {
      const { data, error } = await this.client
        .rpc('get_sponsorship_analytics', {
          p_event_id: eventId,
          p_sponsor_id: sponsorId,
          p_from_date: dateRange?.from,
          p_to_date: dateRange?.to
        });

      if (error) {
        // Gracefully handle 404 - RPC not yet deployed
        if (error.message?.includes('not found') || error.code === 'PGRST204' || error.code === 'PGRST116' || error.code === '42883') {
          console.warn('[SponsorshipClient] get_sponsorship_analytics RPC not deployed yet');
          return { 
            success: true, 
            data: {
              total_revenue_cents: 0,
              total_orders: 0,
              active_sponsorships: 0,
              avg_order_value_cents: 0,
              conversion_rate: 0,
              top_packages: [],
              revenue_by_month: [],
              engagement_metrics: {}
            } as SponsorshipAnalytics 
          };
        }
        throw error;
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Search ===

  async searchSponsorships(
    query: string,
    filters?: {
      category?: string;
      priceRange?: [number, number];
      location?: string;
      qualityTier?: string;
    },
    pagination?: { page: number; limit: number }
  ): Promise<ApiResponse<SponsorshipSearchResponse>> {
    try {
      const { data, error } = await this.client
        .rpc('search_sponsorships', {
          search_query: query,
          category_filter: filters?.category,
          min_price: filters?.priceRange?.[0],
          max_price: filters?.priceRange?.[1],
          location_filter: filters?.location,
          quality_tier_filter: filters?.qualityTier,
          page_offset: pagination ? (pagination.page - 1) * pagination.limit : 0,
          page_limit: pagination?.limit || 10
        });

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // === Real-time Subscriptions ===

  subscribeToMatchUpdates(
    eventId: string,
    callback: (update: RealTimeMatchUpdate) => void
  ) {
    return this.client
      .channel('match-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sponsorship_matches',
          filter: `event_id=eq.${eventId}`
        },
        (payload) => {
          callback({
            event_id: payload.new.event_id,
            sponsor_id: payload.new.sponsor_id,
            score: payload.new.score,
            status: payload.new.status,
            updated_at: payload.new.updated_at
          });
        }
      )
      .subscribe();
  }

  subscribeToNotifications(
    userId: string,
    callback: (notification: SponsorshipNotification) => void
  ) {
    return this.client
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as SponsorshipNotification);
        }
      )
      .subscribe();
  }

  // === Webhook Handling ===

  async handleWebhook(payload: SponsorshipWebhookPayload): Promise<ApiResponse<void>> {
    try {
      // Process webhook based on event type
      switch (payload.event) {
        case 'match.created':
          // Handle new match
          break;
        case 'proposal.updated':
          // Handle proposal update
          break;
        case 'order.completed':
          // Handle order completion
          break;
        case 'deliverable.submitted':
          // Handle deliverable submission
          break;
        case 'payout.processed':
          // Handle payout completion
          break;
        default:
          console.warn('Unknown webhook event:', payload.event);
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const sponsorshipClient = new SponsorshipClient();

// === Utility Functions ===

export const getSponsorshipError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
};

export const formatCurrency = (cents: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2
  }).format(cents / 100);
};

export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

export const getQualityTierColor = (tier: string): string => {
  switch (tier) {
    case 'premium': return 'text-yellow-600 bg-yellow-100';
    case 'high': return 'text-green-600 bg-green-100';
    case 'medium': return 'text-blue-600 bg-blue-100';
    case 'low': return 'text-gray-600 bg-gray-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'accepted': return 'text-green-600 bg-green-100';
    case 'pending': return 'text-yellow-600 bg-yellow-100';
    case 'rejected': return 'text-red-600 bg-red-100';
    case 'suggested': return 'text-blue-600 bg-blue-100';
    default: return 'text-gray-600 bg-gray-100';
  }
};
