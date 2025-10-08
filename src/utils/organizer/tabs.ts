export const TAB_KEYS = ['dashboard', 'events', 'analytics', 'campaigns', 'messaging', 'teams', 'payouts'] as const;

export type TabKey = typeof TAB_KEYS[number];

export const DEFAULT_TAB: TabKey = 'dashboard';

export const lastTabKeyFor = (scope: string) => `organizer.lastTab.${scope}`;
