// src/pages/OrganizerDashboard.tsx
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
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import EventManagement from './EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { LoadingSpinner } from '@/components/dashboard/LoadingSpinner';
import { useOrganizerData } from '@/hooks/useOrganizerData';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';

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
  // If available in your schema, these help client-side filtering
  owner_context_type?: 'individual' | 'organization';
  owner_context_id?: string | null;
}

// Tab constants (stable keys)
const TAB_KEYS = ['dashboard', 'events', 'teams', 'payouts'] as const; // 👈 removed 'organizations'
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'dashboard';

// We’ll scope the “last tab” to the active context (personal vs org)
const lastTabKeyFor = (scope: string) => `organizer.lastTab.${scope}`;

export function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Auth state ---
  const [user, setUser] = useState<any>(null);

  // Selected context (null => personal)
  const initialOrgParam = searchParams.get('org'); // UUID or null
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(initialOrgParam);

  // Scope key for per-context memory
  const scopeKey = selectedOrganization || 'individual';

  // --- Tab state (per scope) ---
  const initialTabFromStorage = (localStorage.getItem(lastTabKeyFor(scopeKey)) as TabKey) || DEFAULT_TAB;
  const initialTabFromUrl = (searchParams.get('tab') as TabKey) || initialTabFromStorage || DEFAULT_TAB;
  const [activeTab, setActiveTab] = useState<TabKey>(TAB_KEYS.includes(initialTabFromUrl) ? initialTabFromUrl : DEFAULT_TAB);

  // selected event management pane
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // analytics
  const { trackEvent } = useAnalyticsIntegration();

  // Load auth user
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data: { user } }) => mounted && setUser(user));
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => setUser(sess?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Organizations for the switcher
  const { organizations, loading: orgsLoading } = useOrganizations(user?.id);

  // Data hook (update this to accept org context if your hook supports it)
  // If your useOrganizerData already supports an org filter, pass it here.
  // Otherwise we’ll filter client-side below as a fallback.
  const { userEvents, loading, refetchEvents } = useOrganizerData(user);

  // Keep URL in sync on tab change (and remember per-scope)
  useEffect(() => {
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    localStorage.setItem(lastTabKeyFor(scopeKey), activeTab);
  }, [activeTab, searchParams, scopeKey, setSearchParams]);

  // Remember tab view for analytics
  useEffect(() => {
    trackEvent('organizer_tab_view', { tab: activeTab, scope: scopeKey });
  }, [activeTab, scopeKey, trackEvent]);

  // When org context changes, keep tab but persist new scope’s last tab if present
  useEffect(() => {
    const saved = (localStorage.getItem(lastTabKeyFor(scopeKey)) as TabKey) || DEFAULT_TAB;
    setActiveTab(TAB_KEYS.includes(saved) ? saved : DEFAULT_TAB);
    // Trigger a refetch in the new context
    refetchEvents?.();
  }, [scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick keyboard: "n" to create event (only when not typing)
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

  // Derived: filter events by active context if needed (fallback)
  const scopedEvents = useMemo(() => {
    if (!selectedOrganization) return userEvents; // personal
    // If your hook already returns org-scoped events, just return userEvents.
    // Otherwise filter by owner_context_id when available:
    const hasOwnerFields = (userEvents?.[0] && ('owner_context_type' in userEvents[0]));
    if (hasOwnerFields) {
      return (userEvents || []).filter(
        (e: any) =>
          e.owner_context_type === 'organization' &&
          e.owner_context_id === selectedOrganization
      );
    }
    // If no owner info, return as-is (your hook should handle org scoping)
    return userEvents;
  }, [userEvents, selectedOrganization]);

  // Totals for header
  const totals = useMemo(() => {
    const events = scopedEvents || [];
    const revenue = events.reduce((s, e) => s + (e.revenue || 0), 0);
    const attendees = events.reduce((s, e) => s + (e.attendees || 0), 0);
    return { events: events.length, revenue, attendees };
  }, [scopedEvents]);

  // Handlers
  const handleEventSelect = useCallback((event: Event) => {
    trackEvent('dashboard_event_selected', {
      event_id: event.id,
      user_id: user?.id,
      scope: scopeKey,
      timestamp: Date.now(),
    });
    setSelectedEvent(event);
  }, [trackEvent, user?.id, scopeKey]);

  // Context-aware event creation
  const createNewEvent = useCallback(async (values: any) => {
    try {
      const isOrg = !!selectedOrganization;
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
          owner_context_type: isOrg ? 'organization' : 'individual',
          owner_context_id: isOrg ? selectedOrganization : user?.id,
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
  }, [refetchEvents, selectedOrganization, user?.id]);

  // --- Early loading state ---
  if ((loading && !(scopedEvents?.length)) || (orgsLoading && !organizations.length)) {
    return <LoadingSpinner />;
  }

  // Drill-in: Event Management
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

  const activeOrgName =
    selectedOrganization
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
                  // optimistic URL + state update
                  const next = new URLSearchParams(searchParams);
                  next.set("org", value);
                  setSearchParams(next, { replace: true });
                  setSelectedOrganization(value);
                  trackEvent("dashboard_org_selected", { org_id: value, source: "switcher" });
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
          <Button
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = '/create-event')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
          {/* Quick org create stays here if you want it */}
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => (window.location.href = '/organization/create')}
          >
            <Building2 className="mr-2 h-4 w-4" />
            New Org
          </Button>
        </div>
      </div>

      {/* Tabs (no "Organizations" tab anymore) */}
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
          <DashboardOverview events={scopedEvents} onEventSelect={handleEventSelect} />
          {/* Optional: AI insights */}
          <div className="hidden">
            <AnalyticsHub />
          </div>
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="space-y-6">
          {(scopedEvents?.length ?? 0) === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">No events yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first event to get started.
              </p>
              <Button onClick={() => (window.location.href = '/create-event')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          ) : (
            <EventsList events={scopedEvents} onEventSelect={handleEventSelect} />
          )}
        </TabsContent>

        {/* TEAMS (example uses first event id in scope, tweak as needed) */}
        <TabsContent value="teams" className="space-y-6">
          <OrganizerCommsPanel eventId={scopedEvents?.[0]?.id || ''} />
        </TabsContent>

        {/* PAYOUTS — context-aware */}
        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel
            contextType={selectedOrganization ? 'organization' : 'individual'}
            contextId={selectedOrganization || user?.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OrganizerDashboard;