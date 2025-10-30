// Analytics V2 - Type Definitions

export type DailyRow = {
  campaign_id: string;
  day: string; // yyyy-mm-dd
  impressions: number;
  clicks: number;
  conversions: number;
  spend_credits: number;
  conversion_value_cents: number;
};

export type ViewabilityRow = {
  campaign_id: string;
  impressions: number;
  avg_pct_visible: number; // 0-100
  avg_dwell_ms: number;
  viewability_rate: number; // 0-1
};

export type AttributionRow = {
  campaign_id: string;
  day: string;
  click_conversions: number;
  vt_conversions: number;
  total_value_cents: number;
};

export type CreativeDailyRow = {
  creative_id: string;
  campaign_id: string;
  day: string;
  impressions: number;
  clicks: number;
  conversions: number;
  spend_credits: number;
};

export type DateRange = { 
  from: string; // yyyy-mm-dd
  to: string;   // yyyy-mm-dd
};

export type AnalyticsData = {
  daily: DailyRow[];
  viewability: ViewabilityRow | null;
  attribution: AttributionRow[];
  creatives: CreativeDailyRow[];
};

export type MetricsTotals = {
  impressions: number;
  clicks: number;
  conversions: number;
  spend_credits: number;
  value_cents: number;
};

export type ComparisonRow = {
  metric: string;
  current_value: number;
  previous_value: number;
  change_pct: number;
};

export type ComparisonData = {
  impressions: ComparisonRow;
  clicks: ComparisonRow;
  conversions: ComparisonRow;
  spend: ComparisonRow;
  revenue: ComparisonRow;
};

