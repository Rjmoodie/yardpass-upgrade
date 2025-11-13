/**
 * TypeScript types for analytics system
 * Centralized type definitions with Zod schemas for validation
 */

import { z } from 'zod';

// =====================================================================
// FUNNEL TYPES
// =====================================================================

export const FunnelStepSchema = z.object({
  stage: z.string(),
  users: z.number(),
  sessions: z.number().optional(),
  conversion_rate: z.number(),
  gross_revenue_cents: z.number().optional(),
  net_revenue_cents: z.number().optional(),
});

export type FunnelStep = z.infer<typeof FunnelStepSchema>;

export const AcquisitionChannelSchema = z.object({
  channel: z.string(),
  visitors: z.number(),
  purchasers: z.number(),
  conversion_rate: z.number(),
  net_revenue_cents: z.number(),
});

export type AcquisitionChannel = z.infer<typeof AcquisitionChannelSchema>;

export const DeviceBreakdownSchema = z.object({
  device: z.string(),
  sessions: z.number(),
  conversion_rate: z.number(),
});

export type DeviceBreakdown = z.infer<typeof DeviceBreakdownSchema>;

export const TopEventSchema = z.object({
  event_id: z.string(),
  title: z.string(),
  views: z.number(),
  ctr: z.number(),
  purchasers: z.number(),
  net_revenue_cents: z.number(),
});

export type TopEvent = z.infer<typeof TopEventSchema>;

export const AudienceFunnelSchema = z.object({
  meta: z.object({
    org_id: z.string(),
    from: z.string(),
    to: z.string(),
    attribution: z.string(),
    source: z.string(),
  }),
  funnel_steps: z.array(FunnelStepSchema),
  acquisition_channels: z.array(AcquisitionChannelSchema),
  device_breakdown: z.array(DeviceBreakdownSchema),
  top_events: z.array(TopEventSchema),
  total_conversion_rate: z.number(),
});

export type AudienceFunnel = z.infer<typeof AudienceFunnelSchema>;

// =====================================================================
// COMPARISON TYPES
// =====================================================================

export const ComparisonSchema = z.object({
  current_users: z.number(),
  previous_users: z.number(),
  delta: z.number(),
  delta_pct: z.number(),
  stage: z.string(),
});

export type Comparison = z.infer<typeof ComparisonSchema>;

export type ComparisonPeriod = 'DoD' | 'WoW' | 'MoM' | 'YoY';

export const AnalyticsWithComparisonSchema = z.object({
  current: AudienceFunnelSchema,
  previous: AudienceFunnelSchema,
  comparison_type: z.string(),
  comparisons: z.object({
    funnel_steps: z.array(ComparisonSchema),
    total_conversion_rate: z.object({
      current: z.number(),
      previous: z.number(),
      delta_pct: z.number(),
    }),
  }),
});

export type AnalyticsWithComparison = z.infer<typeof AnalyticsWithComparisonSchema>;

// =====================================================================
// TARGET & BENCHMARK TYPES
// =====================================================================

export interface KPITarget {
  kpi: string;
  target_value: number;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  currency?: string;
}

export interface Benchmark {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export const EnhancedFunnelSchema = AudienceFunnelSchema.extend({
  targets: z.record(z.number()).optional(),
  benchmarks: z.record(
    z.object({
      p50: z.number(),
      p75: z.number(),
      p90: z.number(),
    })
  ).optional(),
  comparison: z.object({
    funnel_steps: z.array(ComparisonSchema),
  }).optional(),
  comparison_period: z.string().optional(),
});

export type EnhancedFunnel = z.infer<typeof EnhancedFunnelSchema>;

// =====================================================================
// SAVED VIEWS
// =====================================================================

export interface SavedView {
  id: string;
  org_id: string;
  user_id: string;
  name: string;
  description?: string;
  filters: {
    dateRange?: string;
    eventIds?: string[];
    attribution?: 'first_touch' | 'last_touch';
    compareType?: ComparisonPeriod;
    includeRefunds?: boolean;
  };
  active_tab?: 'overview' | 'events' | 'videos' | 'audience';
  is_shared: boolean;
  access_count: number;
  last_accessed_at?: string;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// DRILLTHROUGH TYPES
// =====================================================================

export interface DrillthroughQuery {
  metric: string;
  table: string;
  filters: Record<string, any>;
  sample_query: string;
  export_url: string;
  count_estimate: number;
}

// =====================================================================
// LEAKY STEPS TYPES
// =====================================================================

export interface LeakyStep {
  step: string;
  drop_users: number;
  top_causes: string[];
}

// =====================================================================
// CREATIVE DIAGNOSTICS TYPES
// =====================================================================

export interface CreativeDiagnostic {
  event_id: string;
  title: string;
  impressions: number;
  ctr: number;
  media_count: number;
  recommendation: string;
}

// =====================================================================
// ORG ANALYTICS (Overview)
// =====================================================================

export const OrgAnalyticsKPIsSchema = z.object({
  gross_revenue: z.number(),
  net_revenue: z.number(),
  total_attendees: z.number(),
  total_events: z.number(),
  avg_ticket_price: z.number(),
  conversion_rate: z.number().optional(),
});

export type OrgAnalyticsKPIs = z.infer<typeof OrgAnalyticsKPIsSchema>;

export const RevenueTrendPointSchema = z.object({
  date: z.string(),
  revenue: z.number(),
  event_id: z.string().nullable(),
});

export type RevenueTrendPoint = z.infer<typeof RevenueTrendPointSchema>;

export const OrgTopEventSchema = z.object({
  event_id: z.string(),
  title: z.string(),
  revenue: z.number(),
  attendees: z.number(),
  engagement: z.number().optional(),
});

export type TopEventAnalytics = z.infer<typeof OrgTopEventSchema>;

export const OrgAnalyticsSchema = z.object({
  kpis: OrgAnalyticsKPIsSchema,
  revenue_trend: z.array(RevenueTrendPointSchema),
  top_events: z.array(OrgTopEventSchema),
});

export type OrgAnalytics = z.infer<typeof OrgAnalyticsSchema>;

// =====================================================================
// SPONSORSHIP ANALYTICS TYPES
// =====================================================================

export type AnalyticsMetric =
  | 'total_attendees'
  | 'total_revenue'
  | 'avg_ticket_price'
  | 'engagement_rate'
  | 'social_reach'
  | 'media_impressions'
  | 'brand_mentions'
  | 'conversion_rate'
  | 'ticket_sales'
  | 'vip_ratio'
  | 'repeat_attendee_rate'
  | 'avg_age'
  | 'gender_split'
  | 'top_cities';

export type AnalyticsCategory = 
  | 'attendance' 
  | 'engagement' 
  | 'demographics' 
  | 'financial' 
  | 'sponsor' 
  | 'media';

export interface AnalyticsShowcase {
  enabled: boolean;
  source: 'current' | 'reference';
  metrics: AnalyticsMetric[];
  customStats?: Array<{ label: string; value: string }>;
}

export interface EventAnalyticsData {
  total_attendees?: number;
  total_revenue?: number;
  avg_ticket_price?: number;
  engagement_rate?: number;
  social_reach?: number;
  media_impressions?: number;
  brand_mentions?: number;
  conversion_rate?: number;
  ticket_sales?: number;
  vip_ratio?: number;
  repeat_attendee_rate?: number;
  avg_age?: number;
  gender_split?: string;
  top_cities?: string;
  [key: string]: any;
}

// Metric configurations for display
export const ANALYTICS_METRIC_CONFIGS: Record<AnalyticsMetric, {
  label: string;
  format: 'number' | 'currency' | 'percent' | 'text';
  category: AnalyticsCategory;
  description: string;
}> = {
  total_attendees: {
    label: 'Total Attendees',
    format: 'number',
    category: 'attendance',
    description: 'Total number of people who attended'
  },
  total_revenue: {
    label: 'Total Revenue',
    format: 'currency',
    category: 'financial',
    description: 'Total ticket sales revenue'
  },
  avg_ticket_price: {
    label: 'Avg Ticket Price',
    format: 'currency',
    category: 'financial',
    description: 'Average price per ticket sold'
  },
  engagement_rate: {
    label: 'Engagement Rate',
    format: 'percent',
    category: 'engagement',
    description: 'Percentage of attendees who engaged with content'
  },
  social_reach: {
    label: 'Social Reach',
    format: 'number',
    category: 'media',
    description: 'Total social media impressions'
  },
  media_impressions: {
    label: 'Media Impressions',
    format: 'number',
    category: 'media',
    description: 'Total media coverage impressions'
  },
  brand_mentions: {
    label: 'Brand Mentions',
    format: 'number',
    category: 'sponsor',
    description: 'Number of brand mentions'
  },
  conversion_rate: {
    label: 'Conversion Rate',
    format: 'percent',
    category: 'engagement',
    description: 'Percentage who converted to attendees'
  },
  ticket_sales: {
    label: 'Tickets Sold',
    format: 'number',
    category: 'financial',
    description: 'Total number of tickets sold'
  },
  vip_ratio: {
    label: 'VIP Ratio',
    format: 'percent',
    category: 'demographics',
    description: 'Percentage of VIP ticket holders'
  },
  repeat_attendee_rate: {
    label: 'Repeat Rate',
    format: 'percent',
    category: 'engagement',
    description: 'Percentage of returning attendees'
  },
  avg_age: {
    label: 'Average Age',
    format: 'number',
    category: 'demographics',
    description: 'Average age of attendees'
  },
  gender_split: {
    label: 'Gender Split',
    format: 'text',
    category: 'demographics',
    description: 'Gender distribution'
  },
  top_cities: {
    label: 'Top Cities',
    format: 'text',
    category: 'demographics',
    description: 'Cities with most attendees'
  }
};

// Helper to get metrics by category
export function getMetricsByCategory(category: AnalyticsCategory): AnalyticsMetric[] {
  return Object.entries(ANALYTICS_METRIC_CONFIGS)
    .filter(([_, config]) => config.category === category)
    .map(([key]) => key as AnalyticsMetric);
}

// Format analytics value based on type
export function formatAnalyticsValue(value: any, format: 'number' | 'currency' | 'percent' | 'text'): string {
  if (value === undefined || value === null) return 'N/A';
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(typeof value === 'number' ? value / 100 : parseFloat(value) / 100);
    
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format((typeof value === 'number' ? value : parseFloat(value)) / 100);
    
    case 'text':
      return String(value);
    
    case 'number':
    default:
      return new Intl.NumberFormat('en-US').format(
        typeof value === 'number' ? value : parseFloat(value) || 0
      );
  }
}

// Safe date formatter
export function formatDateSafe(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Invalid date';
  }
}

// =====================================================================
// VIDEO ANALYTICS TYPES
// =====================================================================

export interface MuxVideoMetrics {
  total_plays: number;
  unique_viewers: number;
  avg_watch_time: number;
  completion_rate: number;
  videos: Array<{
    asset_id: string;
    plays: number;
    unique_viewers: number;
    avg_watch_time: number;
    completion_rate: number;
  }>;
}

// =====================================================================
// UTILITY TYPES
// =====================================================================

export type DateRangeKey = '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

export interface AnalyticsFilter {
  orgId?: string;
  eventIds?: string[];
  dateRange: DateRangeKey;
  customRange?: DateRange;
  attribution?: 'first_touch' | 'last_touch';
  compareType?: ComparisonPeriod | null;
  includeRefunds?: boolean;
  showNetRevenue?: boolean;
}

// =====================================================================
// ANOMALY DETECTION
// =====================================================================

export interface Anomaly {
  metric: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  current_value: number;
  expected_value: number;
  delta_pct: number;
  causes?: string[];
  recommendations?: string[];
}

// =====================================================================
// RESPONSE HELPERS
// =====================================================================

/**
 * Validate and parse analytics response
 */
export function parseAudienceFunnel(data: unknown): AudienceFunnel {
  try {
    return AudienceFunnelSchema.parse(data);
  } catch (error) {
    console.error('[Analytics] Failed to parse funnel data:', error);
    throw new Error('Invalid analytics response format');
  }
}

/**
 * Validate and parse org analytics response
 */
export function parseOrgAnalytics(data: unknown): OrgAnalytics {
  try {
    return OrgAnalyticsSchema.parse(data);
  } catch (error) {
    console.error('[Analytics] Failed to parse org analytics:', error);
    throw new Error('Invalid org analytics response format');
  }
}

/**
 * Safe number formatter with fallback
 */
export function formatMetric(
  value: number | undefined | null,
  type: 'number' | 'currency' | 'percent' = 'number',
  currency: string = 'USD'
): string {
  if (value === undefined || value === null || !isFinite(value)) {
    return '—';
  }
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    
    case 'percent':
      return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value / 100);
    
    default:
      return new Intl.NumberFormat('en-US').format(value);
  }
}
