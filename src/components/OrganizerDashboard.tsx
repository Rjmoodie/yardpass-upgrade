import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2, CheckCircle2, Wallet } from 'lucide-react';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizationTeamPanel } from '@/components/OrganizationTeamPanel';
import EventManagement from './EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { LoadingSpinner } from '@/components/dashboard/LoadingSpinner';
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

// ─────────────────────────────────────────
const TAB_KEYS = ['events', 'analytics', 'teams', 'wallet', 'payouts'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'events';
const lastTabKeyFor = (orgId: string) => `organizer.lastTab.${orgId}`;
const LAST_ORG_KEY = 'organizer.lastOrgId';
// ─────────────────────────────────────────

export default function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsIntegration();

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

  const fetchScopedEvents = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoadingEvents(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`id, title, created_at, start_at, end_at, venue, category, cover_image_url, description, city, visibility, owner_context_type, owner_context_id`)
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', selectedOrgId)
        .order('start_at', { ascending: false });

      if (error) throw error;

      const transformed: Event[] = (data || []).map(e => ({
        id: e.id,
        title: e.title,
        status: 'active',
        date: e.start_at,
        attendees: 0,
        revenue: 0,
        views: 0,
        likes: 0,
        shares: 0,
        tickets_sold: 0,
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
      }));

      if (mountedRef.current) setEvents(transformed);
    } catch (err: any) {
      console.error('fetchScopedEvents error', err);
      toast({ title: 'Error loading events', description: err.message || 'Please try again.', variant: 'destructive' });
      if (mountedRef.current) setEvents([]);
    } finally {
      if (mountedRef.current) setLoadingEvents(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchScopedEvents();

    if (!selectedOrgId) return;
    const ch = supabase
      .channel(`events-org-${selectedOrgId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `owner_context_type=eq.organization,owner_context_id=eq.${selectedOrgId}` },
        () => fetchScopedEvents()
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [selectedOrgId, fetchScopedEvents]);

  // Totals
  const totals = useMemo(() => {
    const evs = events || [];
    const revenue = evs.reduce((s, e) => s + (e.revenue || 0), 0);
    const attendees = evs.reduce((s, e) => s + (e.attendees || 0), 0);
    return { events: evs.length, revenue, attendees };
  }, [events]);

  // Event select
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const handleEventSelect = useCallback((event: Event) => {
    if (!selectedOrgId) return;
    trackEvent('dashboard_event_selected', { event_id: event.id, org_id: selectedOrgId });
    setSelectedEvent(event);
  }, [selectedOrgId, trackEvent]);

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
            <span>• {totals.events} event{totals.events === 1 ? '' : 's'}</span>
            <span>• {totals.attendees} attendees</span>
            <span>• ${totals.revenue.toLocaleString()} revenue</span>
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
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="events" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Event Management</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <Wallet className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Wallet</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Payouts</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-6">
          {(events?.length ?? 0) === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">No events yet</h3>
              <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
              <Button onClick={goCreateEvent}><Plus className="mr-2 h-4 w-4" />Create Event</Button>
            </div>
          ) : (
            <EventsList events={events} onEventSelect={handleEventSelect} />
          )}
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <OrganizationTeamPanel organizationId={selectedOrgId} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsHub />
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5" />
              <h2 className="text-xl font-semibold">Organization Wallet</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                <p className="font-medium mb-1">Coming Soon</p>
                <p className="text-sm text-muted-foreground">
                  Organization-level wallets are currently being developed. Each organization will have its own shared credit balance for ad campaigns, managed by org admins.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">What to Expect:</h3>
                <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
                  <li>Shared credit balance for the organization</li>
                  <li>Transaction history visible to all admins</li>
                  <li>Credit purchases managed by org admins and owners</li>
                  <li>Separate from personal user wallets</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground pt-2 border-t">
                For now, use your personal wallet at <a href="/wallet" className="text-primary hover:underline font-medium">/wallet</a> to manage ad credits.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel
            key={`${selectedOrgId}-payouts`}
            contextType="organization"
            contextId={selectedOrgId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
