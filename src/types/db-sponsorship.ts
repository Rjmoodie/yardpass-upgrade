// TypeScript types for sponsorship intelligence system
// Generated from Phase 1 schema

export type UUID = string;

// === Core Sponsor Types ===

export interface Sponsor {
  id: UUID;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  contact_email: string | null;
  created_by: UUID;
  created_at: string;
  // Phase 1 additions
  industry: string | null;
  company_size: string | null;
  brand_values: Record<string, unknown> | null;
  preferred_visibility_options: Record<string, unknown> | null;
}

export interface SponsorProfile {
  id: UUID;
  sponsor_id: UUID;
  industry: string | null;
  company_size: string | null;
  annual_budget_cents: number | null;
  brand_objectives: Record<string, unknown>;
  target_audience: Record<string, unknown>;
  preferred_categories: string[];
  regions: string[];
  activation_preferences: Record<string, unknown>;
  reputation_score: number | null;
  created_at: string;
  updated_at: string;
}

// === Event Intelligence Types ===

export interface EventAudienceInsights {
  event_id: UUID;
  attendee_count: number | null;
  avg_dwell_time_ms: number | null;
  geo_distribution: Record<string, number>;
  age_segments: Record<string, number>;
  engagement_score: number | null;
  ticket_conversion_rate: number | null;
  social_mentions: number | null;
  sentiment_score: number | null;
  updated_at: string;
}

export interface EventStatSnapshot {
  id: UUID;
  event_id: UUID;
  metric_key: string;
  metric_value: number | null;
  captured_at: string;
}

// === Matching Types ===

export type SponsorshipMatchStatus = 'pending' | 'suggested' | 'accepted' | 'rejected';

export interface OverlapMetrics {
  budget_fit: number;
  audience_overlap: {
    categories: number;
    geo: number;
  };
  geo_fit: number;
  engagement_quality: number;
  objectives_similarity: number;
}

export interface SponsorshipMatch {
  id: UUID;
  event_id: UUID;
  sponsor_id: UUID;
  score: number;
  overlap_metrics: OverlapMetrics;
  status: SponsorshipMatchStatus;
  viewed_at: string | null;
  contacted_at: string | null;
  declined_reason: string | null;
  notes: string | null;
  updated_at: string;
}

// === Sponsorship Package Types ===

export type PackageType = 'digital' | 'onsite' | 'hybrid';
export type ActivationStatus = 'draft' | 'live' | 'completed' | 'evaluated';

export interface SponsorshipPackage {
  id: UUID;
  event_id: UUID;
  tier: string;
  title: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  inventory: number;
  sold: number;
  benefits: Record<string, unknown>;
  visibility: string;
  is_active: boolean;
  created_at: string;
  created_by: UUID | null;
  // Phase 1 additions
  expected_reach: number | null;
  avg_engagement_score: number | null;
  package_type: PackageType | null;
  stat_snapshot_id: UUID | null;
  quality_score: number | null; // 0-100
  quality_updated_at: string | null;
}

export interface EventSponsorship {
  event_id: UUID;
  sponsor_id: UUID;
  tier: string;
  amount_cents: number;
  benefits: Record<string, unknown>;
  status: string;
  created_at: string;
  // Phase 1 additions
  activation_status: ActivationStatus;
  deliverables: Record<string, unknown>;
  roi_summary: Record<string, unknown>;
  deliverables_due_date: string | null;
  deliverables_submitted_at: string | null;
  organizer_approved_at: string | null;
}

export interface SponsorshipOrder {
  id: UUID;
  package_id: UUID;
  sponsor_id: UUID;
  event_id: UUID;
  amount_cents: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  transfer_group: string | null;
  application_fee_cents: number;
  // Phase 1 additions
  milestone: Record<string, unknown>;
  proof_assets: Record<string, unknown>;
  roi_report_id: UUID | null;
  created_by_user_id: UUID | null;
  last_modified_by: UUID | null;
  version_number: number;
}

// === View Types ===

export interface EventPerformanceSummary {
  event_id: UUID;
  event_title: string;
  start_at: string;
  category: string | null;
  total_views: number;
  avg_dwell_ms: number;
  video_completions: number;
  orders_count: number;
  tickets_sold: number;
  unique_visitors: number;
  avg_watch_pct: number;
  conversion_rate: number;
  engagement_score: number;
  social_mentions: number;
  sentiment_score: number;
}

export interface SponsorshipPackageCard {
  package_id: UUID;
  event_id: UUID;
  title: string | null;
  description: string | null;
  tier: string;
  price_cents: number;
  currency: string;
  inventory: number;
  sold: number;
  is_active: boolean;
  expected_reach: number | null;
  avg_engagement_score: number | null;
  package_type: PackageType | null;
  quality_score: number | null;
  quality_updated_at: string | null;
  snapshot_metric_key: string | null;
  snapshot_metric_value: number | null;
  snapshot_captured_at: string | null;
  event_title: string;
  start_at: string;
  category: string | null;
  total_views: number;
  avg_dwell_ms: number;
  tickets_sold: number;
  unique_visitors: number;
  avg_watch_pct: number;
  conversion_rate: number;
  engagement_score: number;
  social_mentions: number;
  sentiment_score: number;
  available_inventory: number;
}

export interface SponsorRecommendation {
  event_id: UUID;
  sponsor_id: UUID;
  sponsor_name: string;
  sponsor_logo: string | null;
  industry: string | null;
  company_size: string | null;
  annual_budget_cents: number | null;
  score: number;
  overlap_metrics: OverlapMetrics;
  status: SponsorshipMatchStatus;
  viewed_at: string | null;
  contacted_at: string | null;
  updated_at: string;
  // Explainability
  budget_fit: number;
  category_match: number;
  geo_match: number;
  engagement_fit: number;
  objectives_fit: number;
}

export interface EventRecommendation {
  sponsor_id: UUID;
  event_id: UUID;
  event_title: string;
  event_cover: string | null;
  start_at: string;
  category: string | null;
  city: string | null;
  country: string | null;
  score: number;
  overlap_metrics: OverlapMetrics;
  status: SponsorshipMatchStatus;
  viewed_at: string | null;
  contacted_at: string | null;
  updated_at: string;
  tickets_sold: number | null;
  unique_visitors: number | null;
  engagement_score: number | null;
  conversion_rate: number | null;
  available_packages: number;
  min_price_cents: number | null;
  // Explainability
  budget_fit: number;
  category_match: number;
  geo_match: number;
  engagement_fit: number;
}

export interface SponsorshipFunnelMetrics {
  event_id: UUID;
  event_title: string;
  start_at: string;
  matches_pending: number;
  matches_suggested: number;
  matches_viewed: number;
  matches_contacted: number;
  matches_accepted: number;
  matches_rejected: number;
  avg_accepted_score: number | null;
  avg_rejected_score: number | null;
}

// === Queue Types ===

export interface FitRecalcQueueItem {
  id: number;
  event_id: UUID;
  sponsor_id: UUID;
  reason: string;
  queued_at: string;
  processed_at: string | null;
}

// === API Response Types ===

export interface SponsorshipRecalcResponse {
  success: boolean;
  processed?: number;
  duration_ms: number;
  timestamp: string;
  error?: string;
}

export interface SponsorshipScoreOnChangeResponse {
  success: boolean;
  queued?: number;
  operations?: string[];
  duration_ms: number;
  timestamp: string;
  error?: string;
}

// === UI Component Props ===

export interface SponsorMatchCardProps {
  match: SponsorRecommendation;
  onView?: (sponsorId: UUID) => void;
  onContact?: (sponsorId: UUID) => void;
  onAccept?: (sponsorId: UUID) => void;
  onReject?: (sponsorId: UUID, reason?: string) => void;
}

export interface EventMatchCardProps {
  match: EventRecommendation;
  onView?: (eventId: UUID) => void;
  onExplorePackages?: (eventId: UUID) => void;
}

export interface PackageCardProps {
  package: SponsorshipPackageCard;
  onViewDetails?: (packageId: UUID) => void;
  onPurchase?: (packageId: UUID) => void;
}

