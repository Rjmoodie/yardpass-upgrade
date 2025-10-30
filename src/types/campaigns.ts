// ==========================================
// Campaign Types
// ==========================================

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "archived";

export type CampaignObjective = "ticket_sales" | "brand_awareness" | "engagement" | "event_promotion";

export type BiddingModel = "CPM" | "CPC";

export type PacingStrategy = "standard" | "accelerated" | "even";

export type CampaignTargetingSettings = {
  categories?: string[];
  cities?: string[];
  regions?: string[];
  devices?: Array<"ios" | "android" | "web">;
  interests?: string[];
  keywords?: string[];
  metadata?: Record<string, unknown> | null;
};

export type CampaignBiddingSettings = {
  model: BiddingModel;
  bid_cents: number;
  floor_cents?: number;
  max_cents?: number | null;
  quality_score?: number;
  strategy?: "manual" | "auto";
};

export type CampaignPacingSettings = {
  strategy: PacingStrategy;
  daily_target_impressions?: number | null;
  lifetime_target_impressions?: number | null;
  daily_spend_cap_cents?: number | null;
};

export type CampaignFrequencyCapSettings = {
  impressions?: number | null;
  period_hours?: number | null;
};

// Base campaign row from campaigns.campaigns
export type CampaignRow = {
  id: string;
  org_id: string;
  created_by: string;
  name: string;
  description: string | null;
  objective: CampaignObjective;
  status: CampaignStatus;
  total_budget_credits: number;
  daily_budget_credits: number | null;
  spent_credits: number;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  timezone: string;
  pacing_strategy: PacingStrategy;
  frequency_cap_per_user: number | null;
  frequency_cap_period: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  targeting?: CampaignTargetingSettings | null;
  bidding?: CampaignBiddingSettings | null;
  pacing?: CampaignPacingSettings | null;
  freq_cap?: CampaignFrequencyCapSettings | null;
};

// Targeting criteria for campaigns
export type CampaignTargeting = {
  campaign_id: string;
  target_categories: string[] | null;
  target_locations: any | null; // JSONB
  target_keywords: string[] | null;
};

// Ad creative (attached to campaigns)
export type AdCreative = {
  id: string;
  campaign_id: string;
  post_id: string | null;
  headline: string | null;
  body: string | null;
  media_type: "image" | "video" | "existing_post";
  media_url: string | null;
  poster_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

// Analytics aggregation by campaign
export type AnalyticsTotals = {
  impressions: number;
  clicks: number;
  conversions?: number;
  ctr?: number;
  credits_spent?: number;
  spend_credits?: number;  // Alternative name used in some contexts
  revenue_cents?: number;
};

// Time series data point for analytics
export type AnalyticsPoint = {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  credits_spent: number;
  spend_credits?: number;  // Alternative name
};

export type CreativeRollup = {
  creative_id: string;
  campaign_id: string;
  org_id: string;
  campaign_name: string | null;
  headline: string | null;
  media_type: "image" | "video" | "existing_post" | string;
  active: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  credits_spent: number;
  ctr: number; // 0..1
  series?: Array<{
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue_cents: number;
    credits_spent: number;
  }> | null;
};

// Extended campaign delivery statuses
export type CampaignDeliveryStatus = CampaignStatus | "at-risk" | "no-creatives";

// Pacing health indicators
export type CampaignPacingHealth = "on-track" | "slow" | "stalled" | "accelerating" | "complete";

// Campaign overview with delivery intelligence
export type CampaignOverview = CampaignRow & {
  total_creatives: number;
  active_creatives: number;
  credits_last_7d?: number | null;
  credits_last_30d?: number | null;
  impressions_last_7d?: number | null;
  clicks_last_7d?: number | null;
  conversions_last_7d?: number | null;
  spend_last_7d_cents?: number | null;
  cpa_last_7d_cents?: number | null;
  ctr_last_7d?: number | null;
  last_activity_at?: string | null;
  last_impression_at?: string | null;
  last_click_at?: string | null;
  delivery_status: CampaignDeliveryStatus;
  pacing_health: CampaignPacingHealth;
};

export type CampaignDailyMetric = {
  summary_date: string; // YYYY-MM-DD
  impressions: number;
  clicks: number;
  conversions: number;
  spend_cents: number;
  cpa_cents: number | null;
  ctr: number;
};

export type CampaignAnalyticsSeries = {
  campaign_id: string;
  rows: CampaignDailyMetric[];
};
