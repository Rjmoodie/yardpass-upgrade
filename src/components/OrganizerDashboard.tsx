import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2, CheckCircle2, Wallet, Megaphone, Settings, Mail } from 'lucide-react';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';

// Lazy load dashboard components
const AnalyticsHub = lazy(() => import('@/components/AnalyticsHub'));
const PayoutPanel = lazy(() => import('@/components/PayoutPanel').then(m => ({ default: m.PayoutPanel })));
const OrganizationTeamPanel = lazy(() => import('@/components/OrganizationTeamPanel').then(m => ({ default: m.OrganizationTeamPanel })));
const EventManagement = lazy(() => import('./EventManagement'));
const DashboardOverview = lazy(() => import('@/components/dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const EventsList = lazy(() => import('@/components/dashboard/EventsList').then(m => ({ default: m.EventsList })));
const OrgWalletDashboard = lazy(() => import('@/components/wallet/OrgWalletDashboard').then(m => ({ default: m.OrgWalletDashboard })));
const CampaignDashboard = lazy(() => import('@/components/campaigns/CampaignDashboard').then(m => ({ default: m.CampaignDashboard })));
const OrganizerCommsPanel = lazy(() => import('@/components/organizer/OrganizerCommsPanel').then(m => ({ default: m.OrganizerCommsPanel })));

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

// ─────────────────────────────────────────
const TAB_KEYS = ['events', 'analytics', 'campaigns', 'messaging', 'teams', 'wallet', 'payouts'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'events';
const lastTabKeyFor = (orgId: string) => `organizer.lastTab.${orgId}`;
const LAST_ORG_KEY = 'organizer.lastOrgId';
// ─────────────────────────────────────────

export default function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsIntegration();
  const orgId = useMemo(() => searchParams.get('org') ?? null, [searchParams]);

  // Auth (we still need user for create-event param, but dashboard is strictly org-scoped)
  const [user, setUser] = useState<any>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => mounted && setUser(user));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setUser(sess?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load orgs
  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);

  // Determine selected org (URL → last visited → first org)
  const urlOrg = searchParams.get('org');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(urlOrg);

  useEffect(() => {
    if (orgsLoading) return;
    if (!organizations.length) { setSelectedOrgId(null); return; }

    // If URL has an org and it exists, use it
    if (urlOrg && organizations.some(o => o.id === urlOrg)) {
      setSelectedOrgId(urlOrg);
      localStorage.setItem(LAST_ORG_KEY, urlOrg);
      return;
    }

    // Else try last visited
    const last = localStorage.getItem(LAST_ORG_KEY);
    if (last && organizations.some(o => o.id === last)) {
      setSelectedOrgId(last);
      const next = new URLSearchParams(searchParams);
      next.set('org', last);
      setSearchParams(next, { replace: true });
      return;
    }

    // Else default to first org
    const first = organizations[0]?.id;
    setSelectedOrgId(first);
    const next = new URLSearchParams(searchParams);
    next.set('org', first);
    setSearchParams(next, { replace: true });
  }, [orgsLoading, organizations, urlOrg, searchParams, setSearchParams]);

  // Tabs (per-org memory)
  const scope = selectedOrgId ?? 'none';
  const initialTabFromStorage = (localStorage.getItem(lastTabKeyFor(scope)) as TabKey) || DEFAULT_TAB;
  const initialTabFromUrl = (searchParams.get('tab') as TabKey) || initialTabFromStorage || DEFAULT_TAB;
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_KEYS.includes(initialTabFromUrl) ? initialTabFromUrl : DEFAULT_TAB);

  useEffect(() => {
    if (!selectedOrgId) return;
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    localStorage.setItem(lastTabKeyFor(selectedOrgId), activeTab);
  }, [activeTab, selectedOrgId, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedOrgId) {
      const saved = (localStorage.getItem(lastTabKeyFor(selectedOrgId)) as TabKey) || DEFAULT_TAB;
      setActiveTab(TAB_KEYS.includes(saved) ? saved : DEFAULT_TAB);
      localStorage.setItem(LAST_ORG_KEY, selectedOrgId);
      trackEvent('organizer_tab_view', { tab: saved, org_id: selectedOrgId });
    }
  }, [selectedOrgId, trackEvent]);

  // Server-side scoped events (org only)
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const mountedRef = useRef(true);

  // Dashboard aggregated metrics from orders/tickets
  const [dashboardTotals, setDashboardTotals] = useState({
    events: 0,
    attendees: 0,
    revenue: 0,
  });

  const fetchScopedEvents = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          id, title, created_at, start_at, end_at, venue, category, cover_image_url, description, city, visibility, owner_context_type, owner_context_id,
          orders:orders!orders_event_id_fkey(total_cents, status),
          tickets:tickets!tickets_event_id_fkey(status)
        `)
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', selectedOrgId)
        .order('start_at', { ascending: false });

      if (error) throw error;

      const transformed: Event[] = (data || []).map(e => {
        // Calculate revenue from paid orders
        const paidOrders = (e.orders || []).filter((o: any) => o.status === 'paid');
        const revenue = paidOrders.reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0) / 100;
        
        // Count issued tickets (purchased tickets)
        const issuedTickets = (e.tickets || []).filter(
          (t: any) => t.status === 'issued' || t.status === 'transferred' || t.status === 'redeemed'
        );
        const attendees = issuedTickets.length;
        const tickets_sold = issuedTickets.length;

        return {
          id: e.id,
          title: e.title,
          status: 'active',
          date: e.start_at,
          attendees,
          revenue,
          views: 0,
          likes: 0,
          shares: 0,
          tickets_sold,
          capacity: 0,
          conversion_rate: 0,
          engagement_rate: 0,
          created_at: e.created_at,
          start_at: e.start_at,
          end_at: e.end_at,
          venue: e.venue,
          category: e.category,
          cover_image_url: e.cover_image_url,
          description: e.description,
          city: e.city,
          visibility: e.visibility,
          owner_context_type: e.owner_context_type as OwnerContextType,
          owner_context_id: e.owner_context_id,
        };
      });

      if (mountedRef.current) setEvents(transformed);
    } catch (err: any) {
      console.error('fetchScopedEvents error', err);
      toast({ title: 'Error loading events', description: err.message || 'Please try again.', variant: 'destructive' });
      if (mountedRef.current) setEvents([]);
    } finally {
      if (mountedRef.current) setLoadingEvents(false);
    }
  }, [selectedOrgId]);

  // Fetch aggregated dashboard metrics
  const fetchDashboardMetrics = useCallback(async () => {
    if (!selectedOrgId) return;
    try {
      const { data: eventsData, error } = await supabase
        .from('events')
        .select(`
          id,
          orders:orders!orders_event_id_fkey(
            total_cents,
            status
          ),
          tickets:tickets!tickets_event_id_fkey(
            status
          )
        `)
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', selectedOrgId);

      if (error) throw error;

      const totalEvents = eventsData?.length || 0;
      let revenueCents = 0;
      let attendeesCount = 0;

      for (const event of eventsData || []) {
        const paidOrders = (event.orders || []).filter(
          (o: any) => o.status === 'paid'
        );
        revenueCents += paidOrders.reduce(
          (sum: number, o: any) => sum + (o.total_cents || 0),
          0
        );
        // Count all issued tickets (purchased tickets), not just redeemed ones
        const issuedTickets = (event.tickets || []).filter(
          (t: any) => t.status === 'issued' || t.status === 'transferred' || t.status === 'redeemed'
        );
        attendeesCount += issuedTickets.length;
      }

      setDashboardTotals({
        events: totalEvents,
        revenue: revenueCents / 100, // convert cents to dollars
        attendees: attendeesCount,
      });
    } catch (err) {
      console.error('Error fetching dashboard metrics:', err);
      setDashboardTotals({ events: 0, revenue: 0, attendees: 0 });
    }
  }, [selectedOrgId]);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  useEffect(() => {
    mountedRef.current = true;
    fetchScopedEvents();

    if (!selectedOrgId) return;
    const ch = supabase
      .channel(`events-org-${selectedOrgId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `owner_context_type=eq.organization,owner_context_id=eq.${selectedOrgId}` },
        () => {
          fetchScopedEvents();
          fetchDashboardMetrics();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [selectedOrgId, fetchScopedEvents, fetchDashboardMetrics]);

  // Event select
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventDetails, setEventDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);
  
  const handleEventSelect = useCallback((event: Event) => {
    if (!selectedOrgId) return;
    trackEvent('dashboard_event_selected', { event_id: event.id, org_id: selectedOrgId });
    setSelectedEvent(event);
  }, [selectedOrgId, trackEvent]);

  // Fetch event details when an event is selected
  useEffect(() => {
    if (!selectedEvent) return;

    const fetchEventDetails = async () => {
      setLoadingDetails(true);
      try {
        // Fetch ticket tiers
        const { data: tiers } = await supabase
          .from('ticket_tiers')
          .select('id, name, price_cents, total_quantity, reserved_quantity, issued_quantity')
          .eq('event_id', selectedEvent.id)
          .order('price_cents', { ascending: true });

        // Fetch posts
        const { data: posts } = await supabase
          .from('event_posts')
          .select('id, text, created_at, media_urls, like_count, comment_count')
          .eq('event_id', selectedEvent.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10);

        setEventDetails({
          ticketTiers: (tiers || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            price: t.price_cents / 100,
            total: t.total_quantity,
            available: t.total_quantity - t.reserved_quantity - t.issued_quantity,
            sold: t.issued_quantity
          })),
          posts: posts || []
        });
      } catch (error) {
        console.error('Error fetching event details:', error);
        setEventDetails({ ticketTiers: [], posts: [] });
      } finally {
        setLoadingDetails(false);
      }
    };
    
    fetchEventDetails();
  }, [selectedEvent]);

  // Create event (pre-fills owner context to selected org)
  const goCreateEvent = () => {
    if (!selectedOrgId) return;
    const params = new URLSearchParams();
    params.set('owner_context_type', 'organization');
    params.set('owner_context_id', selectedOrgId);
    window.location.href = `/create-event?${params.toString()}`;
  };

  // Loading / empty states
  if (orgsLoading) return <LoadingSpinner />;

  if (!organizations.length) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-16 border rounded-lg">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="text-lg font-semibold mb-1">Create your first organization</h3>
          <p className="text-muted-foreground mb-4">You need an organization to access the organizer dashboard.</p>
          <Button onClick={() => (window.location.href = '/create-organization')}>
            <Building2 className="mr-2 h-4 w-4" /> New Organization
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedOrgId) return <LoadingSpinner />;

  // Event drill-in
  if (selectedEvent) {
    const e = selectedEvent;

    if (loadingDetails) {
      return (
        <div className="container mx-auto p-6">
          <LoadingSpinner />
        </div>
      );
    }

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
            organizer: organizations.find(o => o.id === selectedOrgId)?.name || 'Organizer',
            organizerId: selectedOrgId,
            startAtISO: eventWithDetails.start_at,
            dateLabel: new Date(eventWithDetails.start_at).toLocaleDateString(),
            location: eventWithDetails.venue || '',
            coverImage: eventWithDetails.cover_image_url || '',
            ticketTiers: eventDetails?.ticketTiers || [],
            attendeeCount: eventWithDetails.attendees,
            likes: eventWithDetails.likes,
            shares: eventWithDetails.shares,
            posts: eventDetails?.posts || [],
          }}
          onBack={() => setSelectedEvent(null)}
        />
      </div>
    );
  }

  const activeOrg = organizations.find(o => o.id === selectedOrgId);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Organizer Dashboard</h1>

            <OrgSwitcher
              organizations={organizations}
              value={selectedOrgId}
              onSelect={(nextOrgId) => {
                if (!nextOrgId) return; // no personal fallback
                const next = new URLSearchParams(searchParams);
                next.set('org', nextOrgId);
                setSearchParams(next, { replace: true });
                setSelectedOrgId(nextOrgId);
                localStorage.setItem(LAST_ORG_KEY, nextOrgId);
                trackEvent('dashboard_org_selected', { org_id: nextOrgId, source: 'switcher' });
              }}
              className="w-[260px]"
            />
          </div>

          <p className="text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="font-medium">{activeOrg?.name || 'Organization'}</span>
            {activeOrg?.is_verified && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <CheckCircle2 className="h-4 w-4" /> Verified
              </span>
            )}
            <span>• {dashboardTotals.events} event{dashboardTotals.events === 1 ? '' : 's'}</span>
            <span>• {dashboardTotals.attendees} attendees</span>
            <span>• ${dashboardTotals.revenue.toLocaleString()} revenue</span>
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
        <div className="w-full overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-auto min-w-full justify-start gap-2 p-1.5">
            <TabsTrigger value="events" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <CalendarDays className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Events</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <BarChart3 className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <Megaphone className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Campaigns</span>
            </TabsTrigger>
            <TabsTrigger value="messaging" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <Mail className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Messaging</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <Users className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Teams</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <Wallet className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Wallet</span>
            </TabsTrigger>
            <TabsTrigger value="payouts" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
              <DollarSign className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Payouts</span>
            </TabsTrigger>
            <button
              onClick={() => (window.location.href = `/organization-dashboard/${selectedOrgId}?tab=settings`)}
              className="flex-col gap-1.5 min-w-[90px] flex-shrink-0 inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-accent-foreground"
              title="Edit organization settings"
            >
              <Settings className="h-5 w-5" />
              <span className="text-xs whitespace-nowrap">Org Settings</span>
            </button>
          </TabsList>
        </div>

        <TabsContent value="events" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
            {(events?.length ?? 0) === 0 ? (
              <div className="text-center py-16 border rounded-lg">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No events yet</h3>
                <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
                <Button onClick={goCreateEvent}><Plus className="mr-2 h-4 w-4" />Create Event</Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Event list temporarily unavailable</p>
              </div>
            )}
          </Suspense>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
            <OrganizationTeamPanel organizationId={selectedOrgId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
            <AnalyticsHub initialOrgId={selectedOrgId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
            <CampaignDashboard orgId={selectedOrgId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
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
          </Suspense>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
            <OrgWalletDashboard orgId={selectedOrgId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <Suspense fallback={<LoadingSpinner />}>
            <PayoutPanel
              key={`${selectedOrgId}-payouts`}
              contextType="organization"
              contextId={selectedOrgId}
            />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
