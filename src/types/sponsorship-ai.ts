// Sponsorship AI Types - Complete type definitions for the AI matching system

export interface SponsorProfile {
  id: string;
  sponsor_id: string;
  industry: string | null;
  company_size: string | null;
  annual_budget_cents: number | null;
  brand_objectives: Record<string, unknown> | null;
  target_audience: Record<string, unknown> | null;
  preferred_categories: string[];
  regions: string[];
  activation_preferences: Record<string, unknown> | null;
  reputation_score: number | null;
  objectives_embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface EventAudienceInsights {
  event_id: string;
  attendee_count: number | null;
  avg_dwell_time_ms: number | null;
  geo_distribution: Record<string, number>;
  age_segments: Record<string, number>;
  engagement_score: number | null; // 0..1
  ticket_conversion_rate: number | null; // 0..1
  social_mentions: number | null;
  sentiment_score: number | null; // -1..1
  source: string | null;
  as_of: string | null;
  confidence: number | null;
  updated_at: string;
}

export interface SponsorshipMatch {
  id: string;
  event_id: string;
  sponsor_id: string;
  score: number; // 0..1
  overlap_metrics: MatchBreakdown;
  status: 'pending' | 'suggested' | 'accepted' | 'rejected';
  viewed_at: string | null;
  contacted_at: string | null;
  declined_reason: string | null;
  notes: string | null;
  updated_at: string;
}

export interface MatchBreakdown {
  budget_fit: number;
  audience_overlap: {
    categories: number;
    geo: number;
    combined: number;
  };
  geo_overlap: number;
  engagement_quality: number;
  objectives_similarity: number;
  weights: {
    budget: number;
    audience: number;
    geo: number;
    engagement: number;
    objectives: number;
  };
}

export interface RecommendedPackage {
  package_id: string;
  event_id: string;
  title: string;
  tier: string;
  price_cents: number;
  score: number;
  overlap_metrics: MatchBreakdown | null;
  total_views: number;
  avg_dwell_ms: number;
  tickets_sold: number;
  avg_watch_pct: number;
  quality_score_100: number;
  avg_engagement_score: number;
}

export interface RecommendedSponsor {
  event_id: string;
  sponsor_id: string;
  sponsor_name: string;
  logo_url: string | null;
  industry: string | null;
  annual_budget_cents: number | null;
  score: number;
  overlap_metrics: MatchBreakdown | null;
  status: 'pending' | 'suggested' | 'accepted' | 'rejected';
  viewed_at: string | null;
  contacted_at: string | null;
}

export interface PackageCard {
  package_id: string;
  event_id: string;
  title: string;
  tier: string;
  price_cents: number;
  inventory: number;
  sold: number;
  expected_reach: number;
  avg_engagement_score: number;
  package_type: string;
  quality_score: number;
  quality_updated_at: string | null;
  snapshot_metric_value: number | null;
  snapshot_captured_at: string | null;
  total_views: number;
  avg_dwell_ms: number;
  tickets_sold: number;
  avg_watch_pct: number;
  quality_score_100: number;
}

export interface FitRecalcQueueItem {
  id: number;
  event_id: string;
  sponsor_id: string;
  reason: string;
  queued_at: string;
  processed_at: string | null;
}

// Edge Function Response Types
export interface RecalcResponse {
  success: boolean;
  queued?: number;
  operations?: string[];
  error?: string;
  duration_ms: number;
  timestamp: string;
}

export interface ProcessQueueResponse {
  success: boolean;
  processed?: number;
  error?: string;
  duration_ms: number;
  timestamp: string;
}

