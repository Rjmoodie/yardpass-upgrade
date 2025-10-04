// src/pages/OrganizerDashboard.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2, CheckCircle2, Megaphone, Settings, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizationTeamPanel } from '@/components/OrganizationTeamPanel';
import EventManagement from '@/components/EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { LoadingSpinner } from '@/components/dashboard/LoadingSpinner';
import { useOrganizerData } from '@/hooks/useOrganizerData';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';
import { CampaignDashboard } from '@/components/campaigns/CampaignDashboard';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';

type OwnerContextType = 'individual' | 'organization';

interface Event {
  id: string;
  title: string;
  status: string;
  date: string;
  attendees: number;
  revenue: number;
  views: number;
  likes: number;
  shares: number;
  tickets_sold: number;
  capacity: number;
  conversion_rate: number;
  engagement_rate: number;
  created_at: string;
  start_at: string;
  end_at: string;
  venue?: string;
  category?: string;
  cover_image_url?: string;
  description?: string;
  city?: string;
  visibility?: string;
  owner_context_type?: OwnerContextType;
  owner_context_id?: string | null;
}

const TAB_KEYS = ['dashboard', 'events', 'analytics', 'campaigns', 'messaging', 'teams', 'payouts'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'dashboard';
const lastTabKeyFor = (scope: string) => `organizer.lastTab.${scope}`;

export default function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsIntegration();

  // Edit organization state
  const [editingOrg, setEditingOrg] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', website_url: '', location: '' });

  // --- Auth ---
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => mounted && setUser(user));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setUser(sess?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- Orgs & scope ---
  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);
  const initialOrgParam = searchParams.get('org'); // uuid or null
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(initialOrgParam);
  const scopeKey = selectedOrganization || 'individual';

  // Auto-select first organization if user has orgs but no URL param on first load
  useEffect(() => {
    if (!orgsLoading && organizations.length > 0 && !initialOrgParam && !selectedOrganization) {
      console.log('🔄 Auto-selecting first organization:', organizations[0].id);
      setSelectedOrganization(organizations[0].id);
      const next = new URLSearchParams(searchParams);
      next.set('org', organizations[0].id);
      setSearchParams(next, { replace: true });
    }
  }, [organizations, orgsLoading, initialOrgParam, selectedOrganization]);

  // Keep selectedOrganization in sync with URL
  useEffect(() => {
    const orgFromUrl = searchParams.get('org');
    if (orgFromUrl !== selectedOrganization) {
      setSelectedOrganization(orgFromUrl);
    }
  }, [searchParams, selectedOrganization]);

  // --- Tabs (per-scope memory) ---
  const initialTabFromStorage = (localStorage.getItem(lastTabKeyFor(scopeKey)) as TabKey) || DEFAULT_TAB;
  const initialTabFromUrl = (searchParams.get('tab') as TabKey) || initialTabFromStorage || DEFAULT_TAB;
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_KEYS.includes(initialTabFromUrl) ? initialTabFromUrl : DEFAULT_TAB);

  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    localStorage.setItem(lastTabKeyFor(scopeKey), activeTab);
  }, [activeTab, scopeKey, searchParams, setSearchParams]);

  useEffect(() => {
    trackEvent('organizer_tab_view', { tab: activeTab, scope: scopeKey });
  }, [activeTab, scopeKey, trackEvent]);

  // On scope change, restore that scope's last tab
  useEffect(() => {
    const saved = (localStorage.getItem(lastTabKeyFor(scopeKey)) as TabKey) || DEFAULT_TAB;
    setActiveTab(TAB_KEYS.includes(saved) ? saved : DEFAULT_TAB);
  }, [scopeKey]);

  // --- Events (server-scoped) ---
  const { userEvents, loading: hookLoading } = useOrganizerData(user); // kept for compatibility; not used here
  const [scopedEvents, setScopedEvents] = useState<Event[]>([]);
  const [loadingScoped, setLoadingScoped] = useState<boolean>(true);
  const mountedRef = useRef(true);

  const fetchScopedEvents = useCallback(async () => {
    console.log('🚀 fetchScopedEvents called - selectedOrganization:', selectedOrganization, 'user:', user?.id);
    if (!user?.id) {
      console.log('⚠️ No user ID, skipping fetch');
      return;
    }
    setLoadingScoped(true);
    try {
      console.log('🔍 Fetching events for scope:', selectedOrganization ? `org:${selectedOrganization}` : 'personal');
      
      // Get events for this scope
      let query = supabase
        .from('events')
        .select('id, title, created_at, start_at, end_at, venue, category, cover_image_url, description, city, visibility, owner_context_type, owner_context_id')
        .order('start_at', { ascending: false });

      if (selectedOrganization) {
        console.log('📊 Filtering by organization:', selectedOrganization);
        query = query.eq('owner_context_type', 'organization').eq('owner_context_id', selectedOrganization);
      } else {
        console.log('👤 Filtering by personal events for user:', user.id);
        query = query.eq('owner_context_type', 'individual').eq('owner_context_id', user.id);
      }

      const { data: eventData, error } = await query;
      if (error) throw error;

      const rows = (eventData || []) as any[];
      console.log(`✅ Found ${rows.length} events for this scope`);
      
      if (rows.length === 0) {
        console.log('⚠️ No events found for this scope');
        if (mountedRef.current) setScopedEvents([]);
        return;
      }

      const eventIds = rows.map(e => e.id);

      // Use database function to get accurate KPIs
      const now = new Date();
      const fromDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // Last year

      console.log('📈 Fetching KPIs for event IDs:', eventIds);
      console.log('📅 Date range:', fromDate.toISOString().split('T')[0], 'to', now.toISOString().split('T')[0]);
      
      const { data: kpisData, error: kpisError } = await supabase.rpc('get_event_kpis_daily', {
        p_event_ids: eventIds,
        p_from_date: fromDate.toISOString().split('T')[0],
        p_to_date: now.toISOString().split('T')[0]
      });
      
      if (kpisError) {
        console.error('❌ KPIs error:', kpisError);
      } else {
        console.log('💰 KPIs data rows:', kpisData?.length || 0);
        if (kpisData && kpisData.length > 0) {
          console.log('📊 Sample KPI row:', kpisData[0]);
          console.log('💵 Total revenue (cents):', kpisData.reduce((sum: number, row: any) => sum + (row.gmv_cents || 0), 0));
        }
      }

      // Get scan data
      const { data: scanData } = await supabase.rpc('get_event_scans_daily', {
        p_event_ids: eventIds,
        p_from_date: fromDate.toISOString().split('T')[0],
        p_to_date: now.toISOString().split('T')[0]
      });

      // Get video views
      const { data: videoData } = await supabase
        .from('event_video_counters')
        .select('event_id, views_total')
        .in('event_id', eventIds);

      // Get engagement data
      const { data: engagementData } = await supabase.rpc('get_post_engagement_daily', {
        p_event_ids: eventIds,
        p_from_date: fromDate.toISOString().split('T')[0],
        p_to_date: now.toISOString().split('T')[0]
      });

      // Get sponsor data
      const { data: sponsorData } = await supabase
        .from('event_sponsorships')
        .select('event_id, sponsor_id, amount_cents')
        .in('event_id', eventIds)
        .eq('status', 'active');

      // Aggregate metrics by event
      const eventMetrics = new Map<string, any>();
      
      // Initialize metrics for all events
      eventIds.forEach(id => {
        eventMetrics.set(id, {
          revenue: 0,
          attendees: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          sponsor_count: 0,
          sponsor_revenue: 0
        });
      });

      // Aggregate KPI data (revenue, tickets)
      kpisData?.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (metrics) {
          metrics.revenue += row.gmv_cents / 100;
          metrics.attendees += row.units;
        }
      });

      // Add video views
      videoData?.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (metrics) metrics.views = row.views_total || 0;
      });

      // Add engagement
      engagementData?.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (metrics) {
          metrics.likes += row.likes || 0;
          metrics.comments += row.comments || 0;
          metrics.shares += row.shares || 0;
        }
      });

      // Add sponsor data
      sponsorData?.forEach((row: any) => {
        const metrics = eventMetrics.get(row.event_id);
        if (metrics) {
          metrics.sponsor_count += 1;
          metrics.sponsor_revenue += (row.amount_cents || 0) / 100;
        }
      });

      // Map events with their metrics
      const eventsWithMetrics = rows.map((e) => {
        const metrics = eventMetrics.get(e.id) || {
          revenue: 0,
          attendees: 0,
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          sponsor_count: 0,
          sponsor_revenue: 0
        };

        return {
          id: e.id,
          title: e.title || 'Untitled Event',
          status: e.visibility === 'draft' ? 'draft' : 'published',
          date: e.start_at ? new Date(e.start_at).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            timeZone: 'UTC'
          }) : 'Date TBD',
          attendees: metrics.attendees,
          revenue: metrics.revenue,
          views: metrics.views,
          likes: metrics.likes,
          shares: metrics.shares,
          tickets_sold: metrics.attendees,
          capacity: 0, // TODO: Calculate from tiers if needed
          conversion_rate: 0,
          engagement_rate: metrics.views > 0 ? (metrics.likes / metrics.views) * 100 : 0,
          created_at: e.created_at,
          start_at: e.start_at,
          end_at: e.end_at,
          venue: e.venue || 'Venue TBD',
          category: e.category || 'General',
          cover_image_url: e.cover_image_url,
          description: e.description || '',
          city: e.city || 'Location TBD',
          visibility: e.visibility || 'public',
          owner_context_type: e.owner_context_type,
          owner_context_id: e.owner_context_id,
          sponsor_count: metrics.sponsor_count,
          sponsor_revenue: metrics.sponsor_revenue,
        } as Event & { sponsor_count: number; sponsor_revenue: number };
      });

      if (mountedRef.current) setScopedEvents(eventsWithMetrics);
    } catch (e: any) {
      console.error('fetchScopedEvents', e);
      toast({ title: 'Error loading events', description: e.message || 'Please try again.', variant: 'destructive' });
      if (mountedRef.current) setScopedEvents([]);
    } finally {
      if (mountedRef.current) setLoadingScoped(false);
    }
  }, [selectedOrganization, user?.id]);

  useEffect(() => {
    mountedRef.current = true;
    fetchScopedEvents();

    const filter = selectedOrganization
      ? `owner_context_type=eq.organization,owner_context_id=eq.${selectedOrganization}`
      : `owner_context_type=eq.individual,owner_context_id=eq.${user?.id || 'null'}`;

    const ch = supabase
      .channel(`events-scope-${scopeKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter }, () => fetchScopedEvents())
      .subscribe();

    return () => {
      mountedRef.current = false;
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [fetchScopedEvents, selectedOrganization, user?.id, scopeKey]);

  const events = scopedEvents;
  const loading = loadingScoped;

  // --- Event drill-in ---
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const handleEventSelect = useCallback((event: Event) => {
    trackEvent('dashboard_event_selected', { event_id: event.id, scope: scopeKey, user_id: user?.id });
    setSelectedEvent(event);
  }, [trackEvent, scopeKey, user?.id]);

  // --- Totals ---
  const totals = useMemo(() => {
    const evs = events || [];
    const revenue = evs.reduce((s, e) => s + (e.revenue || 0), 0);
    const attendees = evs.reduce((s, e) => s + (e.attendees || 0), 0);
    return { events: evs.length, revenue, attendees };
  }, [events, scopeKey]);

  // --- Create event (prefill owner context) ---
  const goCreateEvent = () => {
    const params = new URLSearchParams();
    params.set('owner_context_type', selectedOrganization ? 'organization' : 'individual');
    params.set('owner_context_id', selectedOrganization || user?.id || '');
    window.location.href = `/create-event?${params.toString()}`;
  };

  // --- Early loading ---
  if ((loading && !(events?.length)) || (orgsLoading && !organizations.length)) {
    return <LoadingSpinner />;
  }

  // --- Event management drill-in ---
  if (selectedEvent) {
    const e = selectedEvent;
    const eventWithDetails = {
      ...e,
      created_at: e.created_at || new Date().toISOString(),
      start_at: e.start_at,
      end_at: e.end_at,
      venue: e.venue || '',
      category: e.category || '',
      cover_image_url: e.cover_image_url || '',
      description: e.description || '',
      city: e.city || '',
      visibility: e.visibility || 'public',
    };

    return (
      <div className="container mx-auto p-6">
        <EventManagement
          event={{
            ...eventWithDetails,
            organizer: user?.email || 'Organizer',
            organizerId: user?.id || '',
            startAtISO: eventWithDetails.start_at,
            dateLabel: new Date(eventWithDetails.start_at).toLocaleDateString(),
            location: eventWithDetails.venue || '',
            coverImage: eventWithDetails.cover_image_url || '',
            ticketTiers: [],
            attendeeCount: eventWithDetails.attendees,
            likes: eventWithDetails.likes,
            shares: eventWithDetails.shares,
            posts: [],
          }}
          onBack={() => setSelectedEvent(null)}
        />
      </div>
    );
  }

  const activeOrg = selectedOrganization
    ? organizations.find(o => o.id === selectedOrganization)
    : null;

  const headerName = activeOrg?.name || 'Personal Dashboard';
  const isVerified = !!activeOrg?.is_verified;

  // Handle edit organization
  const handleEditOrg = async () => {
    if (!selectedOrganization) return;
    
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          description: editForm.description || null,
          website_url: editForm.website_url || null,
          location: editForm.location || null,
        })
        .eq('id', selectedOrganization);

      if (error) throw error;

      toast({
        title: 'Organization updated',
        description: 'Organization details have been saved.',
      });
      setEditingOrg(false);
      
      // Refresh organizations list
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Failed to update organization',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Initialize edit form when opening
  useEffect(() => {
    if (editingOrg && activeOrg) {
      setEditForm({
        name: activeOrg.name,
        description: (activeOrg as any).description || '',
        website_url: (activeOrg as any).website_url || '',
        location: (activeOrg as any).location || '',
      });
    }
  }, [editingOrg, activeOrg]);

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Organizer Dashboard</h1>

            {!!organizations.length && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2">
                <OrgSwitcher
                  organizations={organizations}
                  value={selectedOrganization}   // null => personal
                  onSelect={(value) => {
                    const next = new URLSearchParams(searchParams);
                    if (value) next.set('org', value);
                    else next.delete('org');
                    setSearchParams(next, { replace: true });
                    setSelectedOrganization(value);
                    trackEvent('dashboard_org_selected', { org_id: value || 'individual', source: 'switcher' });
                  }}
                  onCreateOrgPath="/create-organization"
                  className="w-full sm:w-[240px] md:w-[280px]"
                />
                {selectedOrganization && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingOrg(true)}
                    title="Edit organization"
                    className="flex-shrink-0"
                  >
                    <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>
                )}
              </div>
            )}

            <div className="text-sm sm:text-base text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium truncate max-w-[200px] sm:max-w-none">{headerName}</span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 flex-shrink-0">
                  <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" /> Verified
                </span>
              )}
              <span className="flex-shrink-0">• {totals.events} event{totals.events === 1 ? '' : 's'}</span>
              <span className="flex-shrink-0">• {totals.attendees} attendees</span>
              <span className="flex-shrink-0">• ${totals.revenue.toLocaleString()} revenue</span>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="flex-1 sm:flex-initial sm:w-auto" onClick={goCreateEvent}>
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Create Event</span>
              <span className="sm:hidden">Create</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-initial sm:w-auto"
              onClick={() => (window.location.href = '/create-organization')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              New Org
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-7 h-auto p-0.5 sm:p-1 gap-0.5 overflow-x-auto">
          <TabsTrigger value="dashboard" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Dash</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Events</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <Megaphone className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Camps</span>
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <Mail className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Messages</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Payouts</span>
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview events={events} onEventSelect={handleEventSelect} />
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="space-y-6">
          {(events?.length ?? 0) === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">
                {selectedOrganization ? 'No events yet' : 'No personal events'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {selectedOrganization 
                  ? 'Create your first event for this organization to get started.'
                  : organizations.length > 0
                    ? 'You have no personal events. Switch to an organization above to view organization events, or create a personal event.'
                    : 'Create your first event to get started.'
                }
              </p>
              <Button onClick={goCreateEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          ) : (
            <EventsList events={events} onEventSelect={handleEventSelect} />
          )}
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsHub />
        </TabsContent>

        {/* CAMPAIGNS (org-scoped only) */}
        <TabsContent value="campaigns" className="space-y-6">
          {selectedOrganization ? (
            <CampaignDashboard orgId={selectedOrganization} />
          ) : (
            <div className="text-center py-16 border rounded-lg">
              <Megaphone className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Campaign Management</h3>
              <p className="text-muted-foreground mb-4">
                Switch to an organization to create and manage ad campaigns.
              </p>
            </div>
          )}
        </TabsContent>

        {/* MESSAGING */}
        <TabsContent value="messaging" className="space-y-6">
          {events && events.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Event Communications</h2>
              </div>
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{event.title}</h3>
                  <OrganizerCommsPanel eventId={event.id} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-lg">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Event Messaging</h3>
              <p className="text-muted-foreground mb-4">
                Create an event first to send messages to attendees.
              </p>
              <Button onClick={goCreateEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          )}
        </TabsContent>

        {/* TEAMS (org-scoped only) */}
        <TabsContent value="teams" className="space-y-6">
          {selectedOrganization ? (
            <OrganizationTeamPanel organizationId={selectedOrganization} />
          ) : (
            <div className="text-center py-16 border rounded-lg">
              <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Team Management</h3>
              <p className="text-muted-foreground mb-4">
                Switch to an organization to manage team members and roles.
              </p>
            </div>
          )}
        </TabsContent>

        {/* PAYOUTS (scope-aware) */}
        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel
            key={`${selectedOrganization || 'individual'}-payouts`}
            contextType={selectedOrganization ? 'organization' : 'individual'}
            contextId={selectedOrganization || user?.id}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Organization Modal */}
      <Dialog open={editingOrg} onOpenChange={setEditingOrg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Textarea
                id="org-description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your organization"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website URL</Label>
              <Input
                id="org-website"
                value={editForm.website_url}
                onChange={(e) => setEditForm(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-location">Location</Label>
              <Input
                id="org-location"
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State/Country"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditOrg}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
