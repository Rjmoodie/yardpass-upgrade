import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2 } from 'lucide-react';
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

const TAB_KEYS = ['dashboard', 'events', 'teams', 'payouts'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'dashboard';
const lastTabKeyFor = (scope: string) => `organizer.lastTab.${scope}`;

export default function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsIntegration();

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

  // --- Events (scoped) ---
  // If your useOrganizerData already supports org scoping, prefer that; otherwise we fetch scoped here.
  const { userEvents, loading: hookLoading, refetchEvents } = useOrganizerData(user);

  const [scopedEvents, setScopedEvents] = useState<Event[]>([]);
  const [loadingScoped, setLoadingScoped] = useState<boolean>(true);
  const mountedRef = useRef(true);

  const fetchScopedEvents = useCallback(async () => {
    if (!user?.id) return;
    setLoadingScoped(true);
    try {
      // Server-side scoped fetch
      let query = supabase
        .from('events')
        .select(`id, title, created_at, start_at, end_at, venue, category,
                 cover_image_url, description, city, visibility,
                 owner_context_type, owner_context_id`)
        .order('start_at', { ascending: false });

      if (selectedOrganization) {
        query = query
          .eq('owner_context_type', 'organization')
          .eq('owner_context_id', selectedOrganization);
      } else {
        query = query
          .eq('owner_context_type', 'individual')
          .eq('owner_context_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform to expected Event format
      const transformedEvents: Event[] = (data || []).map(event => ({
        id: event.id,
        title: event.title,
        status: 'active', // default status
        date: event.start_at,
        attendees: 0, // default values - these would come from aggregations
        revenue: 0,
        views: 0,
        likes: 0,
        shares: 0,
        tickets_sold: 0,
        capacity: 0,
        conversion_rate: 0,
        engagement_rate: 0,
        created_at: event.created_at,
        start_at: event.start_at,
        end_at: event.end_at,
        venue: event.venue,
        category: event.category,
        cover_image_url: event.cover_image_url,
        description: event.description,
        city: event.city,
        visibility: event.visibility,
        owner_context_type: event.owner_context_type,
        owner_context_id: event.owner_context_id,
      }));
      
      if (mountedRef.current) setScopedEvents(transformedEvents);
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
    // realtime: refresh when events for this scope change
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

  // Fallback: if your hook already returns scoped items (owner fields present), use that instead
  const maybeHookScoped = useMemo(() => {
    const arr = userEvents || [];
    // For now, just use the scoped events since userEvents doesn't have owner context fields
    return null;
  }, [userEvents, selectedOrganization, user?.id]);

  const events = maybeHookScoped ?? scopedEvents;
  const loading = hookLoading && !maybeHookScoped ? loadingScoped : (maybeHookScoped ? false : loadingScoped);

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
  }, [events]);

  // --- Create event with owner context prefill ---
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

  // --- Event management view ---
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

  const activeOrgName = selectedOrganization
    ? organizations.find(o => o.id === selectedOrganization)?.name || 'Organization'
    : 'Personal Dashboard';

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Organizer Dashboard</h1>

            {!!organizations.length && (
              <OrgSwitcher
                organizations={organizations}
                value={selectedOrganization}
                onSelect={(value) => {
                  const next = new URLSearchParams(searchParams);
                  if (value) next.set('org', value);
                  else next.delete('org');
                  setSearchParams(next, { replace: true });
                  setSelectedOrganization(value);
                  trackEvent('dashboard_org_selected', { org_id: value || 'individual', source: 'switcher' });
                }}
                className="w-[260px]"
              />
            )}
          </div>
          <p className="text-muted-foreground">
            <span className="font-medium">{activeOrgName}</span> • {totals.events} event{totals.events === 1 ? '' : 's'} • {totals.attendees} attendees • ${totals.revenue.toLocaleString()} revenue
          </p>
        </div>

        <div className="flex gap-2">
          <Button className="w-full sm:w-auto" onClick={goCreateEvent}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = '/create-organization')}
          >
            <Building2 className="mr-2 h-4 w-4" />
            New Org
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1">
          <TabsTrigger value="dashboard" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Events</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Payouts</span>
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview events={events} onEventSelect={handleEventSelect} />
          {/* Optional: AI insights */}
          <div className="hidden">
            <AnalyticsHub />
          </div>
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="space-y-6">
          {(events?.length ?? 0) === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">No events yet</h3>
              <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
              <Button onClick={goCreateEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          ) : (
            <EventsList events={events} onEventSelect={handleEventSelect} />
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
              <p className="text-muted-foreground mb-4">Switch to an organization to manage team members and roles.</p>
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
    </div>
  );
}