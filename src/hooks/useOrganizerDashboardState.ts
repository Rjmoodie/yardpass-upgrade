import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';
import type { OrganizerEventSummary, OwnerContextType } from '@/types/organizer';
import { readLocalStorage, writeLocalStorage } from '@/utils/safeStorage';
import { DEFAULT_TAB, TAB_KEYS, TabKey, lastTabKeyFor } from '@/utils/organizer/tabs';

interface UseOrganizerScopedEventsArgs {
  userId: string | null;
  organizationId: string | null;
  scopeKey: string;
}

interface UseOrganizerScopedEventsResult {
  events: OrganizerEventSummary[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const KPIS_LOOKBACK_DAYS = 365;

const dateRangeForKpis = () => {
  const now = new Date();
  const fromDate = new Date(now.getTime() - KPIS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  return {
    from: fromDate.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  };
};

const formatEventDate = (iso: string | null) => {
  if (!iso) return 'Date TBD';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return 'Date TBD';
  }
};

function useOrganizerScopedEvents({ userId, organizationId, scopeKey }: UseOrganizerScopedEventsArgs): UseOrganizerScopedEventsResult {
  const [events, setEvents] = useState<OrganizerEventSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchScopedEvents = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('events.events')
        .select('id, title, created_at, start_at, end_at, venue, category, cover_image_url, description, city, visibility, owner_context_type, owner_context_id')
        .order('start_at', { ascending: false });

      if (organizationId) {
        query = query.eq('owner_context_type', 'organization').eq('owner_context_id', organizationId);
      } else {
        query = query.eq('owner_context_type', 'individual').eq('owner_context_id', userId);
      }

      const { data: eventRows, error } = await query;
      if (error) throw error;

      const rows = eventRows || [];
      if (!rows.length) {
        setEvents([]);
        return;
      }

      const eventIds = rows.map(row => row.id);
      const { from, to } = dateRangeForKpis();

      const [kpisRes, scansRes, videoRes, engagementRes, sponsorRes, tiersRes] = await Promise.all([
        supabase.rpc('get_event_kpis_daily', { p_event_ids: eventIds, p_from_date: from, p_to_date: to }),
        supabase.rpc('get_event_scans_daily', { p_event_ids: eventIds, p_from_date: from, p_to_date: to }),
        supabase.from('events.event_video_counters').select('event_id, views_total').in('event_id', eventIds),
        supabase.rpc('get_post_engagement_daily', { p_event_ids: eventIds, p_from_date: from, p_to_date: to }),
        supabase
          .from('sponsorship.event_sponsorships')
          .select('event_id, amount_cents')
          .in('event_id', eventIds)
          .eq('status', 'active'),
        supabase.from('ticketing.ticket_tiers').select('event_id, quantity').in('event_id', eventIds),
      ]);

      const ensureArray = <T,>(label: string, result: { data: T[] | null; error: any }) => {
        if (result.error) {
          console.error(`useOrganizerScopedEvents:${label}`, result.error);
          throw result.error;
        }
        return result.data || [];
      };

      const eventMetrics = new Map<string, OrganizerEventSummary>();

      rows.forEach(row => {
        eventMetrics.set(row.id, {
          id: row.id,
          title: row.title || 'Untitled Event',
          status: row.visibility === 'public' ? 'published' : 'draft',
          date: formatEventDate(row.start_at),
          attendees: 0,
          revenue: 0,
          views: 0,
          likes: 0,
          shares: 0,
          tickets_sold: 0,
          capacity: 0,
          conversion_rate: 0,
          engagement_rate: 0,
          created_at: row.created_at,
          start_at: row.start_at,
          end_at: row.end_at,
          venue: row.venue || 'Venue TBD',
          category: row.category || 'General',
          cover_image_url: row.cover_image_url || undefined,
          description: row.description || '',
          city: row.city || 'Location TBD',
          visibility: row.visibility || 'public',
          owner_context_type: row.owner_context_type as OwnerContextType,
          owner_context_id: row.owner_context_id,
          sponsor_count: 0,
          sponsor_revenue: 0,
        });
      });

      const kpisData = ensureArray('kpis', kpisRes);
      const scanData = ensureArray('scans', scansRes);
      const videoData = ensureArray('videos', videoRes);
      const engagementData = ensureArray('engagement', engagementRes);
      const sponsorData = ensureArray('sponsors', sponsorRes);
      const tierData = ensureArray('tiers', tiersRes);

      kpisData.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (!metrics) return;
        metrics.revenue += (row.gmv_cents || 0) / 100;
        metrics.attendees += row.units || 0;
        metrics.tickets_sold += row.units || 0;
      });

      scanData.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (!metrics) return;
        metrics.attendees = Math.max(metrics.attendees, row.valid_scans || 0);
      });

      videoData.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (!metrics) return;
        metrics.views = row.views_total || 0;
      });

      engagementData.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (!metrics) return;
        metrics.likes += row.likes || 0;
        metrics.shares += row.shares || 0;
      });

      sponsorData.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (!metrics) return;
        metrics.sponsor_count = (metrics.sponsor_count || 0) + 1;
        metrics.sponsor_revenue = (metrics.sponsor_revenue || 0) + (row.amount_cents || 0) / 100;
      });

      tierData.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (!metrics) return;
        metrics.capacity += row.quantity || 0;
      });

      eventMetrics.forEach(metrics => {
        if (metrics.capacity > 0) {
          metrics.conversion_rate = (metrics.tickets_sold / metrics.capacity) * 100;
        }
        if (metrics.views > 0) {
          metrics.engagement_rate = (metrics.likes / metrics.views) * 100;
        }
      });

      setEvents(Array.from(eventMetrics.values()));
    } catch (error: any) {
      console.error('useOrganizerScopedEvents', error);
      toast({ title: 'Error loading events', description: error.message || 'Please try again.', variant: 'destructive' });
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    fetchScopedEvents();
  }, [fetchScopedEvents]);

  useEffect(() => {
    if (!userId) return;
    const filter = organizationId
      ? `owner_context_type=eq.organization,owner_context_id=eq.${organizationId}`
      : `owner_context_type=eq.individual,owner_context_id=eq.${userId}`;

    const channel = supabase
      .channel(`events-scope-${scopeKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter }, () => {
        fetchScopedEvents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchScopedEvents, organizationId, scopeKey, userId]);

  return { events, loading, refetch: fetchScopedEvents };
}

export function useOrganizerDashboardState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsIntegration();
  const [user, setUser] = useState<User | null>(null);
  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);

  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(() => searchParams.get('org'));
  const scopeKey = selectedOrganization || 'individual';

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!orgsLoading && organizations.length > 0 && !searchParams.get('org') && !selectedOrganization) {
      const firstOrg = organizations[0].id;
      setSelectedOrganization(firstOrg);
      const next = new URLSearchParams(searchParams);
      next.set('org', firstOrg);
      setSearchParams(next, { replace: true });
    }
  }, [orgsLoading, organizations, searchParams, selectedOrganization, setSearchParams]);

  useEffect(() => {
    const orgFromUrl = searchParams.get('org');
    if (orgFromUrl !== selectedOrganization) {
      setSelectedOrganization(orgFromUrl);
    }
  }, [searchParams, selectedOrganization]);

  const [activeTab, setActiveTabState] = useState<TabKey>(() => {
    const tabFromUrl = searchParams.get('tab') as TabKey | null;
    const stored = (readLocalStorage(lastTabKeyFor(scopeKey)) as TabKey | null) || null;
    const candidate = tabFromUrl || stored || DEFAULT_TAB;
    return TAB_KEYS.includes(candidate) ? candidate : DEFAULT_TAB;
  });

  useEffect(() => {
    const current = searchParams.get('tab');
    if (activeTab && current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    writeLocalStorage(lastTabKeyFor(scopeKey), activeTab);
  }, [activeTab, scopeKey, searchParams, setSearchParams]);

  useEffect(() => {
    const stored = readLocalStorage(lastTabKeyFor(scopeKey)) as TabKey | null;
    if (stored && TAB_KEYS.includes(stored)) {
      setActiveTabState(stored);
    } else {
      setActiveTabState(DEFAULT_TAB);
    }
  }, [scopeKey]);

  useEffect(() => {
    trackEvent('organizer_tab_view', { tab: activeTab, scope: scopeKey });
  }, [activeTab, scopeKey, trackEvent]);

  const handleActiveTabChange = useCallback((value: string) => {
    if (!TAB_KEYS.includes(value as TabKey)) return;
    setActiveTabState(value as TabKey);
  }, []);

  const handleOrganizationSelect = useCallback((value: string | null) => {
    setSelectedOrganization(value);
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('org', value);
    } else {
      next.delete('org');
    }
    setSearchParams(next, { replace: true });
    trackEvent('dashboard_org_selected', { org_id: value || 'individual', source: 'switcher' });
  }, [searchParams, setSearchParams, trackEvent]);

  const { events, loading: eventsLoading } = useOrganizerScopedEvents({
    userId: user?.id ?? null,
    organizationId: selectedOrganization,
    scopeKey,
  });

  const totals = useMemo(() => {
    const revenue = events.reduce((sum, event) => sum + (event.revenue || 0), 0);
    const attendees = events.reduce((sum, event) => sum + (event.attendees || 0), 0);
    return { events: events.length, revenue, attendees };
  }, [events]);

  const goCreateEvent = useCallback(() => {
    const params = new URLSearchParams();
    params.set('owner_context_type', selectedOrganization ? 'organization' : 'individual');
    params.set('owner_context_id', selectedOrganization || user?.id || '');
    window.location.href = `/create-event?${params.toString()}`;
  }, [selectedOrganization, user?.id]);

  const logEventSelect = useCallback(
    (eventId: string) => {
      trackEvent('dashboard_event_selected', { event_id: eventId, scope: scopeKey, user_id: user?.id });
    },
    [scopeKey, trackEvent, user?.id],
  );

  return {
    user,
    organizations,
    orgsLoading,
    selectedOrganization,
    scopeKey,
    activeTab,
    setActiveTab: handleActiveTabChange,
    handleOrganizationSelect,
    events,
    eventsLoading,
    totals,
    goCreateEvent,
    logEventSelect,
  };
}
