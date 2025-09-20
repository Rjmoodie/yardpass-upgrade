// src/hooks/useSeriesCreation.ts
import { useCallback, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeOccurrences } from '@/lib/seriesUtils';
import type { RecurrencePattern, CreatedSeriesEvent } from '@/types/series';

export type SeriesState = {
  enabled: boolean;
  name: string;
  description?: string;
  recurrence: RecurrencePattern;
  interval: number;
  seriesStartISO: string;    // first event start
  durationMin: number;       // to compute end_at
  seriesEndDate: string;     // YYYY-MM-DD
  maxEvents?: number;
  timezone: string;
};

export function useSeriesCreation(initial?: Partial<SeriesState>) {
  const [state, setState] = useState<SeriesState>({
    enabled: false,
    name: '',
    description: '',
    recurrence: 'weekly',
    interval: 1,
    seriesStartISO: '',
    durationMin: 120,
    seriesEndDate: '',
    maxEvents: undefined,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    ...initial
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    if (!state.enabled || !state.seriesStartISO || !state.seriesEndDate) return [];
    return computeOccurrences(
      state.recurrence,
      state.interval,
      state.seriesStartISO,
      state.seriesEndDate,
      state.maxEvents
    );
  }, [state]);

  const validate = useCallback((): string | null => {
    if (!state.enabled) return null;
    if (!state.name.trim()) return 'Series name is required.';
    if (!state.seriesStartISO) return 'Choose a start date/time.';
    if (!state.seriesEndDate) return 'Choose a series end date.';
    const s = new Date(state.seriesStartISO);
    const e = new Date(state.seriesEndDate + 'T00:00:00Z');
    if (s > e) return 'Series end must be after the start.';
    if (state.interval < 1) return 'Interval must be at least 1.';
    if (state.maxEvents && state.maxEvents < 1) return 'Max events must be positive.';
    return null;
  }, [state]);

  const createSeriesAndEvents = useCallback(async (opts: {
    orgId: string;
    template: Record<string, any>; // event base fields, includes title/desc/category/venue/address/city… etc.
    createdBy: string;
  }): Promise<CreatedSeriesEvent[]> => {
    setError(null);
    const v = validate();
    if (v) { setError(v); throw new Error(v); }
    if (!state.enabled) return [];

    // stamp template with computed end_at when server needs it
    const endAtISO = new Date(new Date(state.seriesStartISO).getTime() + state.durationMin * 60 * 1000).toISOString();
    const template = {
      ...opts.template,
      start_at: state.seriesStartISO,
      end_at: endAtISO,
      timezone: state.timezone
    };

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('create_event_series', {
        p_org_id: opts.orgId,
        p_created_by: opts.createdBy,
        p_name: state.name,
        p_description: state.description || '',
        p_recurrence: state.recurrence,
        p_interval: state.interval,
        p_series_start: state.seriesStartISO,
        p_series_end: state.seriesEndDate,
        p_max_events: state.maxEvents || null,
        p_timezone: state.timezone,
        p_template: template
      });
      if (error) throw error;
      return (data || []) as CreatedSeriesEvent[];
    } finally {
      setSubmitting(false);
    }
  }, [state, validate]);

  return { state, setState, preview, validate, createSeriesAndEvents, submitting, error };
}