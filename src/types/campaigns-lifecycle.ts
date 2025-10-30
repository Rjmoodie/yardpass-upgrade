// ==========================================
// Campaign Lifecycle Types (Production-Grade)
// ==========================================

export type DerivedCampaignStatus =
  | 'active'
  | 'scheduled'
  | 'paused'
  | 'ended'
  | 'budget_exhausted'
  | 'draft'
  | 'archived'
  | 'unknown';

export type NotServableReason =
  | 'paused'
  | 'past_end_date'
  | 'budget_exhausted'
  | 'before_start_date'
  | 'draft'
  | 'archived';

export interface CampaignWithStatus {
  // All regular campaign fields
  id: string;
  org_id: string;
  name: string;
  status: string;
  total_budget_credits: number;
  spent_credits: number;
  daily_budget_credits?: number;
  start_date: string;
  end_date?: string;
  
  // Computed fields from view
  derived_status: DerivedCampaignStatus;
  not_servable_reasons: NotServableReason[];
  is_servable: boolean;
  budget_used_pct: number;
  remaining_credits: number;
  projected_runout_date?: string;
  hours_since_start: number;
}

export interface StatusBadgeConfig {
  label: string;
  color: 'success' | 'warning' | 'error' | 'info' | 'default';
  icon?: string;
  description: string;
}

export const STATUS_CONFIG: Record<DerivedCampaignStatus, StatusBadgeConfig> = {
  active: {
    label: 'Active',
    color: 'success',
    icon: '🟢',
    description: 'Campaign is currently serving ads',
  },
  scheduled: {
    label: 'Scheduled',
    color: 'info',
    icon: '📅',
    description: 'Campaign will start soon',
  },
  paused: {
    label: 'Paused',
    color: 'warning',
    icon: '⏸️',
    description: 'Campaign is temporarily paused',
  },
  ended: {
    label: 'Ended',
    color: 'default',
    icon: '🏁',
    description: 'Campaign has reached its end date',
  },
  budget_exhausted: {
    label: 'Budget Exhausted',
    color: 'error',
    icon: '💰',
    description: 'Campaign has spent all allocated budget',
  },
  draft: {
    label: 'Draft',
    color: 'default',
    icon: '📝',
    description: 'Campaign is being prepared',
  },
  archived: {
    label: 'Archived',
    color: 'default',
    icon: '📦',
    description: 'Campaign is archived',
  },
  unknown: {
    label: 'Unknown',
    color: 'default',
    icon: '❓',
    description: 'Campaign status could not be determined',
  },
};

export const REASON_DESCRIPTIONS: Record<NotServableReason, string> = {
  paused: 'Campaign is paused',
  past_end_date: 'End date has passed',
  budget_exhausted: 'Budget fully spent',
  before_start_date: 'Start date not yet reached',
  draft: 'Campaign is in draft mode',
  archived: 'Campaign is archived',
};

export interface CampaignAction {
  label: string;
  action: string;
  icon?: string;
  variant: 'default' | 'destructive' | 'outline' | 'secondary';
  condition: (campaign: CampaignWithStatus) => boolean;
}

export const CAMPAIGN_ACTIONS: CampaignAction[] = [
  {
    label: 'Pause',
    action: 'pause',
    icon: '⏸️',
    variant: 'outline',
    condition: (c) => c.derived_status === 'active',
  },
  {
    label: 'Resume',
    action: 'resume',
    icon: '▶️',
    variant: 'default',
    condition: (c) => c.derived_status === 'paused',
  },
  {
    label: 'Increase Budget',
    action: 'increase_budget',
    icon: '💰',
    variant: 'outline',
    condition: (c) => c.derived_status === 'budget_exhausted' || c.remaining_credits < c.daily_budget_credits * 3,
  },
  {
    label: 'Extend End Date',
    action: 'extend_date',
    icon: '📅',
    variant: 'outline',
    condition: (c) => c.derived_status === 'ended' || (c.end_date && new Date(c.end_date) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  },
  {
    label: 'Duplicate',
    action: 'duplicate',
    icon: '📋',
    variant: 'outline',
    condition: (c) => ['ended', 'budget_exhausted', 'completed'].includes(c.derived_status),
  },
  {
    label: 'Archive',
    action: 'archive',
    icon: '📦',
    variant: 'destructive',
    condition: (c) => ['ended', 'budget_exhausted', 'paused'].includes(c.derived_status),
  },
];

