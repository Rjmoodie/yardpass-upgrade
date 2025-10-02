export type CampaignStatus =
  | "draft" | "scheduled" | "active" | "paused" | "completed" | "archived";

export type CampaignObjective =
  | "ticket_sales" | "brand_awareness" | "engagement" | "event_promotion";

export type PacingStrategy = "even" | "accelerated";

export type CampaignRow = {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  description: string | null;
  objective: CampaignObjective;
  status: CampaignStatus;
  total_budget_credits: number;
  daily_budget_credits: number | null;
  spent_credits: number;
  start_date: string; // ISO
  end_date: string | null; // ISO
  timezone: string;
  pacing_strategy: PacingStrategy;
  frequency_cap_per_user: number | null;
  frequency_cap_period: "session" | "day" | "week" | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CreativeRow = {
  id: string;
  campaign_id: string;
  headline: string;
  body_text: string | null;
  cta_label: string;
  cta_url: string | null;
  media_type: "image" | "video" | "existing_post";
  media_url: string | null;
  post_id: string | null;
  poster_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AnalyticsPoint = {
  date: string;                // YYYY-MM-DD
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_cents: number;
  credits_spent: number;
};

export type AnalyticsTotals = {
  impressions: number;
  clicks: number;
  ctr: number;                  // 0..1
  credits_spent: number;
};
