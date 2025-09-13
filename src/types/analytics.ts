// Shared analytics types for components and hooks
export type AnalyticsKPIs = {
  gross_revenue: number;
  net_revenue: number;
  platform_fees: number;
  tickets_sold: number;
  refund_rate: number;
  no_show_rate: number;
  unique_buyers: number;
  repeat_buyers: number;
  posts_created: number;
  feed_engagements: number;
};

export type OrgAnalytics = {
  kpis: AnalyticsKPIs;
  revenue_trend: Array<{ date: string; revenue: number; event_id: string }>;
  top_events: Array<{ event_id: string; title: string; revenue: number }>;
  events_leaderboard?: Array<{ event_id: string; title: string; revenue: number }>;
};

// Re-export types from hooks
export type { EventAnalyticsRow, OverallAnalytics } from '@/hooks/useOrganizerAnalytics';