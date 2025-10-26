// ==========================================
// Campaign Types
// ==========================================

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "completed" | "archived";

export type CampaignObjective = "awareness" | "engagement" | "conversions" | "sales" | "app-installs";

export type PacingStrategy = "standard" | "accelerated" | "even";

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
  campaign_id: string;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
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
  last_activity_at?: string | null;
  last_impression_at?: string | null;
  last_click_at?: string | null;
  delivery_status: CampaignDeliveryStatus;
  pacing_health: CampaignPacingHealth;
};
