/**
 * Analytics Types for Sponsorship Packages
 * 
 * Defines available analytics metrics that organizers can showcase to sponsors
 */

/**
 * Available analytics metrics that can be displayed
 */
export const ANALYTICS_METRICS = {
  // Attendance & Reach
  TOTAL_ATTENDEES: 'total_attendees',
  TICKET_SALES_VELOCITY: 'ticket_sales_velocity',
  ESTIMATED_REACH: 'estimated_reach',
  REPEAT_ATTENDEES: 'repeat_attendees',
  
  // Engagement
  ENGAGEMENT_RATE: 'engagement_rate',
  ENGAGEMENT_COUNT: 'engagement_count',
  SOCIAL_MENTIONS: 'social_mentions',
  POST_INTERACTIONS: 'post_interactions',
  AVERAGE_DWELL_TIME: 'average_dwell_time',
  
  // Demographics
  AGE_DISTRIBUTION: 'age_distribution',
  GENDER_DISTRIBUTION: 'gender_distribution',
  LOCATION_DISTRIBUTION: 'location_distribution',
  PROFESSION_DISTRIBUTION: 'profession_distribution',
  
  // Financial
  TOTAL_REVENUE: 'total_revenue',
  AVERAGE_TICKET_PRICE: 'average_ticket_price',
  CONVERSION_RATE: 'conversion_rate',
  
  // Sponsor-Specific
  PAST_SPONSOR_ROI: 'past_sponsor_roi',
  SPONSOR_SATISFACTION: 'sponsor_satisfaction',
  BRAND_VISIBILITY_SCORE: 'brand_visibility_score',
  
  // Media & Content
  MEDIA_IMPRESSIONS: 'media_impressions',
  VIDEO_VIEWS: 'video_views',
  PHOTO_SHARES: 'photo_shares',
} as const;

export type AnalyticsMetric = typeof ANALYTICS_METRICS[keyof typeof ANALYTICS_METRICS];

/**
 * Display configuration for an analytics metric
 */
/**
 * Analytics category types
 */
export type AnalyticsCategory = 
  | 'attendance' 
  | 'engagement' 
  | 'demographics' 
  | 'financial' 
  | 'sponsor' 
  | 'media';

/**
 * Display configuration for an analytics metric
 */
export interface AnalyticsMetricConfig {
  id: AnalyticsMetric;
  label: string;
  description: string;
  category: AnalyticsCategory;
  format: 'number' | 'percentage' | 'currency' | 'chart' | 'text';
  icon?: string;
}

/**
 * Available analytics metrics with display configuration
 */
export const ANALYTICS_METRIC_CONFIGS: Record<AnalyticsMetric, AnalyticsMetricConfig> = {
  total_attendees: {
    id: 'total_attendees',
    label: 'Total Attendees',
    description: 'Number of people who attended the event',
    category: 'attendance',
    format: 'number',
  },
  ticket_sales_velocity: {
    id: 'ticket_sales_velocity',
    label: 'Ticket Sales Velocity',
    description: 'How quickly tickets are selling',
    category: 'attendance',
    format: 'text',
  },
  estimated_reach: {
    id: 'estimated_reach',
    label: 'Estimated Reach',
    description: 'Projected audience size including social amplification',
    category: 'attendance',
    format: 'number',
  },
  repeat_attendees: {
    id: 'repeat_attendees',
    label: 'Repeat Attendees',
    description: 'Percentage of attendees who came to previous events',
    category: 'attendance',
    format: 'percentage',
  },
  engagement_rate: {
    id: 'engagement_rate',
    label: 'Engagement Rate',
    description: 'Percentage of attendees actively engaging with content',
    category: 'engagement',
    format: 'percentage',
  },
  engagement_count: {
    id: 'engagement_count',
    label: 'Total Engagements',
    description: 'Posts, comments, reactions, and shares',
    category: 'engagement',
    format: 'number',
  },
  social_mentions: {
    id: 'social_mentions',
    label: 'Social Mentions',
    description: 'Times the event was mentioned on social media',
    category: 'engagement',
    format: 'number',
  },
  post_interactions: {
    id: 'post_interactions',
    label: 'Post Interactions',
    description: 'Likes, comments, and shares on event posts',
    category: 'engagement',
    format: 'number',
  },
  average_dwell_time: {
    id: 'average_dwell_time',
    label: 'Average Dwell Time',
    description: 'How long attendees spend at the event',
    category: 'engagement',
    format: 'text',
  },
  age_distribution: {
    id: 'age_distribution',
    label: 'Age Distribution',
    description: 'Breakdown of attendees by age group',
    category: 'demographics',
    format: 'chart',
  },
  gender_distribution: {
    id: 'gender_distribution',
    label: 'Gender Distribution',
    description: 'Breakdown of attendees by gender',
    category: 'demographics',
    format: 'chart',
  },
  location_distribution: {
    id: 'location_distribution',
    label: 'Location Distribution',
    description: 'Geographic breakdown of attendees',
    category: 'demographics',
    format: 'chart',
  },
  profession_distribution: {
    id: 'profession_distribution',
    label: 'Profession Distribution',
    description: 'Breakdown of attendees by profession/industry',
    category: 'demographics',
    format: 'chart',
  },
  total_revenue: {
    id: 'total_revenue',
    label: 'Total Revenue',
    description: 'Total ticket revenue generated',
    category: 'financial',
    format: 'currency',
  },
  average_ticket_price: {
    id: 'average_ticket_price',
    label: 'Average Ticket Price',
    description: 'Average amount paid per ticket',
    category: 'financial',
    format: 'currency',
  },
  conversion_rate: {
    id: 'conversion_rate',
    label: 'Conversion Rate',
    description: 'Percentage of viewers who purchased tickets',
    category: 'financial',
    format: 'percentage',
  },
  past_sponsor_roi: {
    id: 'past_sponsor_roi',
    label: 'Past Sponsor ROI',
    description: 'Return on investment from previous sponsors',
    category: 'sponsor',
    format: 'percentage',
  },
  sponsor_satisfaction: {
    id: 'sponsor_satisfaction',
    label: 'Sponsor Satisfaction',
    description: 'Average satisfaction rating from past sponsors',
    category: 'sponsor',
    format: 'number',
  },
  brand_visibility_score: {
    id: 'brand_visibility_score',
    label: 'Brand Visibility Score',
    description: 'How visible sponsor branding is to attendees',
    category: 'sponsor',
    format: 'number',
  },
  media_impressions: {
    id: 'media_impressions',
    label: 'Media Impressions',
    description: 'Total views across all media channels',
    category: 'media',
    format: 'number',
  },
  video_views: {
    id: 'video_views',
    label: 'Video Views',
    description: 'Total video content views',
    category: 'media',
    format: 'number',
  },
  photo_shares: {
    id: 'photo_shares',
    label: 'Photo Shares',
    description: 'Number of times event photos were shared',
    category: 'media',
    format: 'number',
  },
};

/**
 * Analytics showcase configuration structure
 */
export interface AnalyticsShowcase {
  enabled: boolean;
  metrics: AnalyticsMetric[];
  source: 'current' | 'reference';
  customStats?: Array<{
    label: string;
    value: string;
  }>;
}

/**
 * Computed analytics data for display
 */
export interface EventAnalyticsData {
  total_attendees?: number;
  total_revenue?: number;
  engagement_count?: number;
  engagement_rate?: number;
  social_mentions?: number;
  conversion_rate?: number;
  average_ticket_price?: number;
  calculated_at?: string;
}

/**
 * Get metric categories for grouping in UI
 */
export function getMetricsByCategory(): Record<string, AnalyticsMetricConfig[]> {
  const categories: Record<string, AnalyticsMetricConfig[]> = {
    attendance: [],
    engagement: [],
    demographics: [],
    financial: [],
    sponsor: [],
    media: [],
  };

  Object.values(ANALYTICS_METRIC_CONFIGS).forEach(config => {
    categories[config.category].push(config);
  });

  return categories;
}

/**
 * Format analytics value based on its type
 */
export function formatAnalyticsValue(value: number | string | null | undefined, format: AnalyticsMetricConfig['format']): string {
  if (value == null) return 'N/A';

  switch (format) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'percentage':
      return typeof value === 'number' ? `${Math.round(value * 100)}%` : String(value);
    case 'currency':
      return typeof value === 'number' ? `$${value.toLocaleString()}` : String(value);
    case 'text':
      return String(value);
    default:
      return String(value);
  }
}

/**
 * Safely format a date string, returning empty string for invalid dates
 */
export function formatDateSafe(value?: string | null, format: 'date' | 'datetime' = 'date'): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return format === 'date' ? d.toLocaleDateString() : d.toLocaleString();
}