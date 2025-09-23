export type Sponsor = {
  id: string;
  name: string;
  logo_url?: string | null;
  website_url?: string | null;
  contact_email?: string | null;
  created_by: string;
  created_at: string;
};

export type SponsorMember = {
  sponsor_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  created_at: string;
  display_name?: string;
  email?: string;
};

export type SponsorshipPackage = {
  id: string;
  event_id: string;
  tier: string;
  price_cents: number;
  inventory: number;
  benefits: Record<string, any>;
  visibility: 'public' | 'invite_only';
  created_at: string;
  event_title?: string;
  event_city?: string;
  event_category?: string;
  event_start_at?: string;
};

export type SponsorshipOrder = {
  id: string;
  package_id: string;
  sponsor_id: string;
  event_id: string;
  amount_cents: number;
  status: 'pending' | 'accepted' | 'live' | 'completed' | 'refunded' | 'cancelled';
  escrow_tx_id?: string | null;
  notes?: string | null;
  created_at: string;
  package?: SponsorshipPackage;
  event_title?: string;
  sponsor_name?: string;
};

export type EventSponsorship = {
  event_id: string;
  sponsor_id: string;
  tier: string;
  amount_cents: number;
  benefits: Record<string, any>;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  sponsor_name?: string;
  sponsor_logo_url?: string;
};

export type MarketplaceSponsorship = {
  package_id: string;
  event_id: string;
  event_title: string;
  city?: string;
  category?: string;
  start_at: string;
  tier: string;
  price_cents: number;
  inventory: number;
  benefits: Record<string, any>;
};