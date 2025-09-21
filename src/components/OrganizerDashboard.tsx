// src/pages/OrganizerDashboard.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2 } from 'lucide-react';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import EventManagement from './EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { LoadingSpinner } from '@/components/dashboard/LoadingSpinner';
import { useOrganizerData } from '@/hooks/useOrganizerData';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';
import OrganizationDashboard from './OrganizationDashboard';

// --- Types ---
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
}

// Tab constants (stable keys)
const TAB_KEYS = ['dashboard', 'events', 'organizations', 'teams', 'payouts'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'dashboard';
const LAST_TAB_KEY = 'organizer.lastTab';

export function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // --- Auth state ---
  const [user, setUser] = useState<any>(null);
  
  // read org deep-link (?org=uuid or handle) to jump straight into org dashboard
  const initialOrgParam = searchParams.get('org');
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(initialOrgParam);
  
  // selected event management pane
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // --- Tab state: URL -> state & remember last tab ---
  const tabFromUrl = (searchParams.get('tab') as TabKey) || (localStorage.getItem(LAST_TAB_KEY) as TabKey) || DEFAULT_TAB;
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_KEYS.includes(tabFromUrl) ? tabFromUrl : DEFAULT_TAB);

  // analytics
  const { trackEvent } = useAnalyticsIntegration();
  
  // data hooks - always called in same order
  const { userEvents, loading, refetchEvents } = useOrganizerData(user);
  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);

  // --- Derived counts for overview header ---
  const totals = useMemo(() => {
    const events = userEvents || [];
    const revenue = events.reduce((s, e) => s + (e.revenue || 0), 0);
    const attendees = events.reduce((s, e) => s + (e.attendees || 0), 0);
    return { events: events.length, revenue, attendees };
  }, [userEvents]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => mounted && setUser(user));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setUser(sess?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // keep URL in sync on tab change (and remember)
  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    localStorage.setItem(LAST_TAB_KEY, activeTab);
  }, [activeTab, searchParams, setSearchParams]);

  useEffect(() => {
    trackEvent('organizer_tab_view', { tab: activeTab });
  }, [activeTab, trackEvent]);

  // --- Handlers ---
  const handleEventSelect = useCallback((event: Event) => {
    trackEvent('dashboard_event_selected', {
      event_id: event.id,
      user_id: user?.id,
      timestamp: Date.now(),
    });
    setSelectedEvent(event);
  }, [trackEvent, user?.id]);

  // quick keyboard: "n" to create event (only when not typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || (e.target as HTMLElement).isContentEditable;
      if (!typing && e.key.toLowerCase() === 'n') {
        window.location.href = '/create-event';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // event create (kept for API parity; dashboard CTA still routes to /create-event)
  const createNewEvent = useCallback(async (values: any) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: values.title,
          description: values.description,
          start_at: values.start_at,
          end_at: values.end_at,
          venue: values.venue,
          category: values.category,
          created_by: user?.id,
          owner_context_type: 'individual',
          owner_context_id: user?.id,
          visibility: 'public',
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Success!', description: 'Event created successfully.' });
      await refetchEvents?.();
      return data;
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [refetchEvents, user?.id]);

  // --- Early loading state ---
  if (loading && !userEvents.length) {
    return <LoadingSpinner />;
  }

  // --- Drill-in: Organization Dashboard ---
  if (selectedOrganization) {
    return (
      <div className="container mx-auto p-6">
        <OrganizationDashboard
          user={{ id: user?.id || '', name: user?.email || 'User', role: 'organizer' }}
          organizationId={selectedOrganization}
          onBack={() => {
            setSelectedOrganization(null);
            // clear ?org=… from URL for a clean back stack
            const next = new URLSearchParams(searchParams);
            next.delete('org');
            setSearchParams(next, { replace: true });
          }}
          onCreateEvent={() => (window.location.href = '/create-event')}
        />
      </div>
    );
  }

  // --- Drill-in: Event Management ---
  if (selectedEvent) {
    const eventWithDetails = {
      ...selectedEvent,
      created_at: selectedEvent.created_at || new Date().toISOString(),
      start_at: selectedEvent.start_at,
      end_at: selectedEvent.end_at,
      venue: selectedEvent.venue || '',
      category: selectedEvent.category || '',
      cover_image_url: selectedEvent.cover_image_url || '',
      description: selectedEvent.description || '',
      city: selectedEvent.city || '',
      visibility: selectedEvent.visibility || 'public',
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


  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold">Organizer Dashboard</h1>

            {organizations.length > 0 && (
              <OrgSwitcher
                organizations={organizations}
                value={selectedOrganization ? selectedOrganization : "individual"}
                onSelect={(value) => {
                  if (value === "individual") {
                    // clear org context
                    if (selectedOrganization) {
                      setSelectedOrganization(null);
                      const next = new URLSearchParams(searchParams);
                      next.delete("org");
                      setSearchParams(next, { replace: true });
                    }
                  } else {
                    // optimistic URL + state update
                    const next = new URLSearchParams(searchParams);
                    next.set("org", value);
                    setSearchParams(next, { replace: true });
                    setSelectedOrganization(value);
                    trackEvent("dashboard_org_selected", { org_id: value, source: "switcher" });
                  }
                }}
                className="w-[240px]"
              />
            )}
          </div>
          <p className="text-muted-foreground">
            {totals.events} event{totals.events === 1 ? '' : 's'} • {totals.attendees} attendees • ${totals.revenue.toLocaleString()} revenue
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="w-full sm:w-auto" onClick={() => (window.location.href = '/create-event')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
          {/* Optional: quick org create */}
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => (window.location.href = '/organization/create')}>
            <Building2 className="mr-2 h-4 w-4" />
            New Org
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="dashboard" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Events</span>
          </TabsTrigger>
          <TabsTrigger value="organizations" className="flex-col h-auto py-2 sm:py-3 px-1 sm:px-2">
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 mb-1" />
            <span className="text-xs">Orgs</span>
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
          <DashboardOverview events={userEvents} onEventSelect={handleEventSelect} />
          {/* Optional: AI insights (kept hidden if you removed the tab) */}
          <div className="hidden">
            <AnalyticsHub />
          </div>
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="space-y-6">
          {userEvents.length === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">No events yet</h3>
              <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
              <Button onClick={() => (window.location.href = '/create-event')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          ) : (
            <EventsList events={userEvents} onEventSelect={handleEventSelect} />
          )}
        </TabsContent>

        {/* ORGANIZATIONS */}
        <TabsContent value="organizations" className="space-y-6">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Organizations</h2>
              <Button onClick={() => (window.location.href = '/organization/create')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Organization
              </Button>
            </div>

            {orgsLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : organizations.length === 0 ? (
              <div className="text-center py-16 border rounded-lg">
                <Building2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No organizations</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first organization.
                </p>
                <Button onClick={() => (window.location.href = '/organization/create')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Organization
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="bg-card rounded-lg border p-6 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => {
                      // reflect choice in URL for deep-linking/back
                      const next = new URLSearchParams(searchParams);
                      next.set('org', org.id);
                      setSearchParams(next, { replace: true });
                      setSelectedOrganization(org.id);
                      trackEvent('dashboard_org_selected', { org_id: org.id });
                    }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{org.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">Click to manage</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TEAMS (kept lightweight; pass first event id if available) */}
        <TabsContent value="teams" className="space-y-6">
          <OrganizerCommsPanel eventId={userEvents[0]?.id || ''} />
        </TabsContent>

        {/* PAYOUTS */}
        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel contextType="individual" contextId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OrganizerDashboard;
