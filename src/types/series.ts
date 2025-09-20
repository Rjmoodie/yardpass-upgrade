// src/types/series.ts
export type RecurrencePattern = 'weekly' | 'monthly';

export interface EventSeries {
  id: string;
  name: string;
  description?: string | null;
  organization_id: string;
  created_by: string;
  recurrence: RecurrencePattern;
  recurrence_interval: number;
  series_start: string;  // ISO
  series_end: string;    // YYYY-MM-DD
  max_events?: number | null;
  timezone: string;
  template: Record<string, any>;
  created_at: string;
}

export interface CreatedSeriesEvent {
  event_id: string;
  start_at: string; // ISO
}