import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  Users,
  DollarSign,
  Plus,
  BarChart3,
  Building2,
  CheckCircle2,
  Wallet,
  Megaphone,
  Settings,
  Mail,
  Activity,
  Ticket,
  Search,
  Filter,
  TrendingUp,
  HandshakeIcon,
  LayoutDashboard,
  Smartphone,
} from 'lucide-react';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { useOrganizations } from '@/hooks/useOrganizations';
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Lazy load dashboard components
const AnalyticsHub = lazy(() => import('@/components/AnalyticsHub'));
const PayoutPanel = lazy(() => import('@/components/PayoutPanel').then(m => ({ default: m.PayoutPanel })));
const OrganizationTeamPanel = lazy(() => import('@/components/OrganizationTeamPanel').then(m => ({ default: m.OrganizationTeamPanel })));
const EventManagement = lazy(() => import('./EventManagement'));
const DashboardOverview = lazy(() => import('@/components/dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const OrgWalletDashboard = lazy(() => import('@/components/wallet/OrgWalletDashboard').then(m => ({ default: m.OrgWalletDashboard })));
const CampaignDashboard = lazy(() => import('@/components/campaigns/CampaignDashboard').then(m => ({ default: m.CampaignDashboard })));
const OrganizerCommsPanel = lazy(() => import('@/components/organizer/OrganizerCommsPanel').then(m => ({ default: m.OrganizerCommsPanel })));

type OwnerContextType = 'individual' | 'organization';

type DerivedEventStatus = 'upcoming' | 'live' | 'completed' | 'draft';

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

interface EnhancedEvent extends Event {
  derivedStatus: DerivedEventStatus;
  startDate: Date | null;
  endDate: Date | null;
  occupancyRate: number | null;
  daysUntilStart: number | null;
  daysSinceEnd: number | null;
}

// ─────────────────────────────────────────
// Navigation Configuration
const TAB_KEYS = ['events', 'analytics', 'campaigns', 'messaging', 'teams', 'wallet', 'payouts', 'sponsorship'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'events';

// App View tabs (lightweight mobile-friendly view)
const APP_VIEW_TABS: TabKey[] = ['events', 'messaging', 'teams'];

// Full Dashboard tabs (desktop/complete view with all heavy utilities)
const FULL_DASHBOARD_TABS: TabKey[] = ['events', 'analytics', 'campaigns', 'messaging', 'teams', 'wallet', 'payouts', 'sponsorship'];

type ViewMode = 'app' | 'full';
const VIEW_MODE_KEY = 'organizer.viewMode';
const lastTabKeyFor = (orgId: string) => `organizer.lastTab.${orgId}`;
const LAST_ORG_KEY = 'organizer.lastOrgId';
// ─────────────────────────────────────────

export default function OrganizerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackEvent } = useAnalyticsIntegration();
  const isBrowser = typeof window !== 'undefined';
  const [now, setNow] = useState(() => new Date());

  // View Mode (app vs full dashboard)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (!isBrowser) return 'full';
    const saved = localStorage.getItem(VIEW_MODE_KEY) as ViewMode | null;
    // Default to 'full' for desktop, 'app' for mobile
    if (saved && (saved === 'app' || saved === 'full')) return saved;
    return window.innerWidth < 768 ? 'app' : 'full';
  });

  // Get available tabs based on view mode
  const availableTabs = viewMode === 'app' ? APP_VIEW_TABS : FULL_DASHBOARD_TABS;

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
      if (isBrowser) {
      localStorage.setItem(LAST_ORG_KEY, urlOrg);
      }
      return;
    }

    // Else try last visited
    const last = isBrowser ? localStorage.getItem(LAST_ORG_KEY) : null;
    if (last && organizations.some(o => o.id === last)) {
      setSelectedOrgId(last);
      const next = new URLSearchParams(searchParams);
      next.set('org', last);
      setSearchParams(next, { replace: true });
      return;
    }

    // Else default to first org
    const first = organizations[0]?.id;
    if (first) {
    setSelectedOrgId(first);
    const next = new URLSearchParams(searchParams);
    next.set('org', first);
    setSearchParams(next, { replace: true });
      if (isBrowser) {
        localStorage.setItem(LAST_ORG_KEY, first);
      }
    }
  }, [orgsLoading, organizations, urlOrg, searchParams, setSearchParams, isBrowser]);

  // Persist view mode changes
  useEffect(() => {
    if (isBrowser) {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    }
  }, [viewMode, isBrowser]);

  // Toggle view mode function
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'app' ? 'full' : 'app');
    trackEvent('view_mode_toggled', { new_mode: viewMode === 'app' ? 'full' : 'app' });
  }, [viewMode, trackEvent]);

  // Tabs (per-org memory)
  const scope = selectedOrgId ?? 'none';
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab') as TabKey | null;
    if (fromUrl && TAB_KEYS.includes(fromUrl)) return fromUrl;
    const stored = isBrowser ? (localStorage.getItem(lastTabKeyFor(scope)) as TabKey | null) : null;
    if (stored && TAB_KEYS.includes(stored)) return stored;
    return DEFAULT_TAB;
  });

  // Sync activeTab to URL and localStorage
  useEffect(() => {
    if (!selectedOrgId) return;
    const current = searchParams.get('tab');
    if (current !== activeTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', activeTab);
      setSearchParams(next, { replace: true });
    }
    if (isBrowser) {
      localStorage.setItem(lastTabKeyFor(selectedOrgId), activeTab);
    }
  }, [activeTab, selectedOrgId, searchParams, setSearchParams, isBrowser]);

  // Initialize activeTab when selectedOrgId changes (run once per org)
  useEffect(() => {
    if (!selectedOrgId) return;
    
    const saved = isBrowser ? (localStorage.getItem(lastTabKeyFor(selectedOrgId)) as TabKey | null) : null;
    const tabToActivate = saved && TAB_KEYS.includes(saved) ? saved : DEFAULT_TAB;
    
    // Only update if different to prevent loop
    setActiveTab(prev => prev === tabToActivate ? prev : tabToActivate);
    
    if (isBrowser) {
      localStorage.setItem(LAST_ORG_KEY, selectedOrgId);
    }
    trackEvent('organizer_tab_view', { tab: tabToActivate, org_id: selectedOrgId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]); // Only run when selectedOrgId changes

  // Handle view mode changes - switch to default tab if current tab not available
  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(DEFAULT_TAB);
    }
  }, [viewMode, availableTabs, activeTab]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Event pipeline controls
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<DerivedEventStatus | 'all'>('all');
  const [eventSort, setEventSort] = useState<'start_desc' | 'start_asc' | 'revenue_desc' | 'attendees_desc'>('start_desc');

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
        const paidOrders = (e.orders || []).filter((o: any) => o.status === 'paid');
        const revenue = paidOrders.reduce((sum: number, o: any) => sum + (o.total_cents || 0), 0) / 100;
        
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

      if (mountedRef.current) {
        setEvents(transformed);
        const totals = transformed.reduce(
          (acc, event) => {
            acc.events += 1;
            acc.attendees += event.attendees;
            acc.revenue += event.revenue;
            return acc;
          },
          { events: 0, attendees: 0, revenue: 0 }
        );
        setDashboardTotals({
          events: totals.events,
          attendees: totals.attendees,
          revenue: totals.revenue,
        });
      }
    } catch (err: any) {
      console.error('fetchScopedEvents error', err);
      toast({ title: 'Error loading events', description: err.message || 'Please try again.', variant: 'destructive' });
      if (mountedRef.current) {
        setEvents([]);
        setDashboardTotals({ events: 0, attendees: 0, revenue: 0 });
      }
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
        () => {
          fetchScopedEvents();
        }
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      try { supabase.removeChannel(ch); } catch {}
    };
  }, [selectedOrgId, fetchScopedEvents]);

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
        const { data: tiers } = await supabase
          .from('ticket_tiers')
          .select('id, name, price_cents, total_quantity, reserved_quantity, issued_quantity')
          .eq('event_id', selectedEvent.id)
          .order('price_cents', { ascending: true });

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

  // All hooks must be called before any conditional returns
  const activeOrg = organizations.find(o => o.id === selectedOrgId);

  const enhancedEvents = useMemo<EnhancedEvent[]>(() => {
    const nowMs = now.getTime();
    const dayMs = 1000 * 60 * 60 * 24;

    return events.map(event => {
      const startDate = event.start_at ? new Date(event.start_at) : null;
      const endDate = event.end_at ? new Date(event.end_at) : startDate;

      let derivedStatus: DerivedEventStatus = 'draft';
      if (startDate) {
        if (startDate.getTime() > nowMs) {
          derivedStatus = 'upcoming';
        } else if (endDate && endDate.getTime() < nowMs) {
          derivedStatus = 'completed';
        } else {
          derivedStatus = 'live';
        }
      }

      const capacity = event.capacity ?? 0;
      const occupancyRate = capacity > 0 ? Math.min(100, (event.tickets_sold / capacity) * 100) : null;
      const daysUntilStart = startDate ? Math.max(0, Math.ceil((startDate.getTime() - nowMs) / dayMs)) : null;
      const daysSinceEnd = endDate ? Math.max(0, Math.ceil((nowMs - endDate.getTime()) / dayMs)) : null;

      return {
        ...event,
        derivedStatus,
        startDate,
        endDate,
        occupancyRate,
        daysUntilStart,
        daysSinceEnd,
      };
    });
  }, [events, now]);

  const statusCounts = useMemo(() => {
    return enhancedEvents.reduce(
      (acc, event) => {
        acc[event.derivedStatus] += 1;
        return acc;
      },
      { upcoming: 0, live: 0, completed: 0, draft: 0 }
    );
  }, [enhancedEvents]);

  const totalTicketsIssued = useMemo(
    () => enhancedEvents.reduce((sum, event) => sum + (event.tickets_sold || 0), 0),
    [enhancedEvents]
  );

  const averageOccupancy = useMemo(() => {
    const occupancies = enhancedEvents
      .map(event => event.occupancyRate)
      .filter((value): value is number => typeof value === 'number');
    if (!occupancies.length) return null;
    const total = occupancies.reduce((sum, rate) => sum + rate, 0);
    return Math.round(total / occupancies.length);
  }, [enhancedEvents]);

  const filteredEvents = useMemo(() => {
    const searchLower = eventSearch.trim().toLowerCase();
    return enhancedEvents.filter(event => {
      const matchesStatus = eventStatusFilter === 'all' || event.derivedStatus === eventStatusFilter;
      const matchesSearch =
        [event.title, event.venue, event.description]
          .filter(Boolean)
          .some(value => value!.toLowerCase().includes(searchLower));
      return matchesStatus && matchesSearch;
    });
  }, [enhancedEvents, eventSearch, eventStatusFilter]);

  const sortedEvents = useMemo(() => {
    const next = [...filteredEvents];
    const compareByDate = (a: Date | null, b: Date | null, direction: 'asc' | 'desc') => {
      const aTime = a ? a.getTime() : 0;
      const bTime = b ? b.getTime() : 0;
      return direction === 'asc' ? aTime - bTime : bTime - aTime;
    };

    switch (eventSort) {
      case 'title-asc':
        next.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title-desc':
        next.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'revenue-asc':
        next.sort((a, b) => (a.revenue || 0) - (b.revenue || 0));
        break;
      case 'revenue-desc':
        next.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
        break;
      case 'date-asc':
        next.sort((a, b) => compareByDate(a.startDate, b.startDate, 'asc'));
        break;
      case 'date-desc':
      default:
        next.sort((a, b) => compareByDate(a.startDate, b.startDate, 'desc'));
    }
    return next;
  }, [filteredEvents, eventSort]);

  const topGrossingEvent = useMemo(() => {
    return [...enhancedEvents]
      .filter(event => event.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)[0] || null;
  }, [enhancedEvents]);

  const needsAttentionEvent = useMemo(() => {
    return enhancedEvents
      .filter(event => event.derivedStatus === 'upcoming' && (event.occupancyRate ?? 100) < 50)
      .sort((a, b) => (a.occupancyRate ?? 100) - (b.occupancyRate ?? 100))[0] || null;
  }, [enhancedEvents]);

  // Loading / empty states - now after all hooks
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

  // TEMPORARILY COMMENTED OUT DUPLICATE HOOKS TO FIX REACT HOOKS ORDER ERROR
  /*
  const enhancedEvents = useMemo<EnhancedEvent[]>(() => {
    const nowMs = now.getTime();
    const dayMs = 1000 * 60 * 60 * 24;

    return events.map(event => {
      const startDate = event.start_at ? new Date(event.start_at) : null;
      const endDate = event.end_at ? new Date(event.end_at) : startDate;

      let derivedStatus: DerivedEventStatus = 'draft';
      if (startDate) {
        if (startDate.getTime() > nowMs) {
          derivedStatus = 'upcoming';
        } else if (endDate && endDate.getTime() < nowMs) {
          derivedStatus = 'completed';
        } else {
          derivedStatus = 'live';
        }
      }

      const capacity = event.capacity ?? 0;
      const occupancyRate = capacity > 0 ? Math.min(100, (event.tickets_sold / capacity) * 100) : null;
      const daysUntilStart = startDate ? Math.max(0, Math.ceil((startDate.getTime() - nowMs) / dayMs)) : null;
      const daysSinceEnd = endDate ? Math.max(0, Math.ceil((nowMs - endDate.getTime()) / dayMs)) : null;

      return {
        ...event,
        derivedStatus,
        startDate,
        endDate,
        occupancyRate,
        daysUntilStart,
        daysSinceEnd,
      };
    });
  }, [events, now]);

  const statusCounts = useMemo(() => {
    return enhancedEvents.reduce(
      (acc, event) => {
        acc[event.derivedStatus] += 1;
        return acc;
      },
      { upcoming: 0, live: 0, completed: 0, draft: 0 }
    );
  }, [enhancedEvents]);

  const totalTicketsIssued = useMemo(
    () => enhancedEvents.reduce((sum, event) => sum + (event.tickets_sold || 0), 0),
    [enhancedEvents]
  );

  const averageOccupancy = useMemo(() => {
    const occupancies = enhancedEvents
      .map(event => event.occupancyRate)
      .filter((value): value is number => typeof value === 'number');
    if (!occupancies.length) return null;
    const total = occupancies.reduce((sum, rate) => sum + rate, 0);
    return Math.round(total / occupancies.length);
  }, [enhancedEvents]);

  const filteredEvents = useMemo(() => {
    const searchLower = eventSearch.trim().toLowerCase();
    return enhancedEvents.filter(event => {
      const matchesStatus = eventStatusFilter === 'all' || event.derivedStatus === eventStatusFilter;
      const matchesSearch =
        !searchLower ||
        [event.title, event.city, event.venue, event.category]
          .filter(Boolean)
          .some(value => value!.toLowerCase().includes(searchLower));
      return matchesStatus && matchesSearch;
    });
  }, [enhancedEvents, eventSearch, eventStatusFilter]);

  const sortedEvents = useMemo(() => {
    const next = [...filteredEvents];
    const compareByDate = (a: Date | null, b: Date | null, direction: 'asc' | 'desc') => {
      const aTime = a ? a.getTime() : 0;
      const bTime = b ? b.getTime() : 0;
      return direction === 'asc' ? aTime - bTime : bTime - aTime;
    };

    switch (eventSort) {
      case 'start_asc':
        next.sort((a, b) => compareByDate(a.startDate, b.startDate, 'asc'));
        break;
      case 'revenue_desc':
        next.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
        break;
      case 'attendees_desc':
        next.sort((a, b) => (b.attendees || 0) - (a.attendees || 0));
        break;
      default:
        next.sort((a, b) => compareByDate(a.startDate, b.startDate, 'desc'));
    }
    return next;
  }, [filteredEvents, eventSort]);

  const topGrossingEvent = useMemo(() => {
    return [...enhancedEvents]
      .filter(event => event.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)[0] || null;
  }, [enhancedEvents]);

  const needsAttentionEvent = useMemo(() => {
    return enhancedEvents
      .filter(event => event.derivedStatus === 'upcoming' && (event.occupancyRate ?? 100) < 50)
      .sort((a, b) => (a.occupancyRate ?? 100) - (b.occupancyRate ?? 100))[0] || null;
  }, [enhancedEvents]);
  */

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 min-h-full">
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
                if (isBrowser) {
                localStorage.setItem(LAST_ORG_KEY, nextOrgId);
                }
                trackEvent('dashboard_org_selected', { org_id: nextOrgId, source: 'switcher' });
              }}
              className="w-[200px]"
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

        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={toggleViewMode}
            className="hidden sm:flex items-center gap-2"
            title={viewMode === 'app' ? 'Switch to Full Dashboard' : 'Switch to App View'}
          >
            {viewMode === 'app' ? (
              <>
                <LayoutDashboard className="h-4 w-4" />
                <span className="text-xs">Full Dashboard</span>
              </>
            ) : (
              <>
                <Smartphone className="h-4 w-4" />
                <span className="text-xs">App View</span>
              </>
            )}
          </Button>
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
            {availableTabs.includes('events') && (
              <TabsTrigger value="events" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Events</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('analytics') && (
              <TabsTrigger value="analytics" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <BarChart3 className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Analytics</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('campaigns') && (
              <TabsTrigger value="campaigns" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <Megaphone className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Campaigns</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('messaging') && (
              <TabsTrigger value="messaging" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <Mail className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Messaging</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('teams') && (
              <TabsTrigger value="teams" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <Users className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Teams</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('wallet') && (
              <TabsTrigger value="wallet" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <Wallet className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Wallet</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('payouts') && (
              <TabsTrigger value="payouts" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <DollarSign className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Payouts</span>
              </TabsTrigger>
            )}
            {availableTabs.includes('sponsorship') && (
              <TabsTrigger value="sponsorship" className="flex-col gap-1.5 min-w-[90px] flex-shrink-0">
                <HandshakeIcon className="h-5 w-5" />
                <span className="text-xs whitespace-nowrap">Sponsorship</span>
              </TabsTrigger>
            )}
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
          {loadingEvents ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : events.length === 0 ? (
              <div className="text-center py-16 border rounded-lg">
                <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No events yet</h3>
                <p className="text-muted-foreground mb-4">Create your first event to get started.</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={goCreateEvent}><Plus className="mr-2 h-4 w-4" />Create Event</Button>
              </div>
              </div>
            ) : (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Upcoming events</CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statusCounts.upcoming}</div>
                    <p className="text-xs text-muted-foreground">Scheduled for the future</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Live right now</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statusCounts.live}</div>
                    <p className="text-xs text-muted-foreground">Events currently in progress</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Completed</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{statusCounts.completed}</div>
                    <p className="text-xs text-muted-foreground">Past events with results</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tickets issued</CardTitle>
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalTicketsIssued.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Across all active events</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-xl">Event pipeline</CardTitle>
                    <CardDescription>Search, prioritize, and drill into the events that matter most.</CardDescription>
                  </div>
                  <Button size="sm" onClick={goCreateEvent}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Event
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                      <div className="relative w-full md:max-w-xs">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={eventSearch}
                          onChange={event => setEventSearch(event.target.value)}
                          placeholder="Search by name, city, or venue"
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto">
                        <Badge variant="outline" className="px-2 py-1 text-xs font-medium">
                          <Filter className="mr-1 h-3 w-3" /> Filters
                        </Badge>
                        {(
                          [
                            { key: 'all', label: 'All' },
                            { key: 'upcoming', label: 'Upcoming' },
                            { key: 'live', label: 'Live' },
                            { key: 'completed', label: 'Completed' },
                            { key: 'draft', label: 'Draft' },
                          ] as const
                        ).map(option => (
                          <Button
                            key={option.key}
                            variant={eventStatusFilter === option.key ? 'default' : 'ghost'}
                            size="sm"
                            className="min-w-[88px]"
                            onClick={() => setEventStatusFilter(option.key)}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="w-full lg:w-60">
                      <Select
                        value={eventSort}
                        onValueChange={value => setEventSort(value as typeof eventSort)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sort events" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="start_desc">Start date • Newest</SelectItem>
                          <SelectItem value="start_asc">Start date • Oldest</SelectItem>
                          <SelectItem value="revenue_desc">Revenue • Highest</SelectItem>
                          <SelectItem value="attendees_desc">Attendance • Highest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {sortedEvents.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                      <p>No events match your filters yet.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Schedule</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Tickets</TableHead>
                          <TableHead className="text-right">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedEvents.map(event => {
                          const startLabel = event.startDate
                            ? event.startDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'Date TBD';
                          const statusBadgeVariant = event.derivedStatus === 'live'
                            ? 'secondary'
                            : event.derivedStatus === 'completed'
                            ? 'outline'
                            : 'default';
                          let scheduleHint = '';
                          if (event.derivedStatus === 'upcoming' && typeof event.daysUntilStart === 'number') {
                            scheduleHint = event.daysUntilStart === 0
                              ? 'Starts today'
                              : `Starts in ${event.daysUntilStart} day${event.daysUntilStart === 1 ? '' : 's'}`;
                          } else if (event.derivedStatus === 'live') {
                            scheduleHint = 'In progress';
                          } else if (event.derivedStatus === 'completed' && typeof event.daysSinceEnd === 'number') {
                            scheduleHint = event.daysSinceEnd === 0
                              ? 'Ended today'
                              : `Ended ${event.daysSinceEnd} day${event.daysSinceEnd === 1 ? '' : 's'} ago`;
                          }

                          return (
                            <TableRow
                              key={event.id}
                              className="cursor-pointer"
                              onClick={() => handleEventSelect(event)}
                            >
                              <TableCell>
                                <div className="font-medium text-sm sm:text-base">{event.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {[event.city, event.venue].filter(Boolean).join(' • ') || 'Location TBD'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{startLabel}</div>
                                <div className="text-xs text-muted-foreground">{scheduleHint || 'Awaiting updates'}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant as any} className="capitalize">
                                  {event.derivedStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-medium">
                                  {event.tickets_sold.toLocaleString()} {event.capacity > 0 ? `of ${event.capacity.toLocaleString()}` : ''}
                                </div>
                                {typeof event.occupancyRate === 'number' && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <Progress value={event.occupancyRate} className="h-2 w-24" />
                                    <span className="text-xs text-muted-foreground">{Math.round(event.occupancyRate)}%</span>
              </div>
            )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold">
                                ${event.revenue.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Operational insights</CardTitle>
                      <CardDescription>Track fulfillment and highlight where to focus next.</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Average capacity filled</p>
                      <p className="text-2xl font-bold">{averageOccupancy !== null ? `${averageOccupancy}%` : '—'}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {averageOccupancy !== null ? (
                      <div className="space-y-4">
                        <Progress value={averageOccupancy} className="h-3" />
                        <p className="text-sm text-muted-foreground">
                          On average, organizers are filling {averageOccupancy}% of available capacity. Monitor upcoming events to keep momentum high.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Provide capacity on your events to track utilization in real time.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">Performance alerts</CardTitle>
                      <CardDescription>Celebrate wins and spot gaps before they widen.</CardDescription>
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    {topGrossingEvent ? (
                      <div className="rounded-lg border p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Top grossing</p>
                        <p className="font-semibold">{topGrossingEvent.title}</p>
                        <p className="text-xs text-muted-foreground">${topGrossingEvent.revenue.toLocaleString()} collected</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Ticketed events will surface here once revenue starts flowing.</p>
                    )}

                    {needsAttentionEvent ? (
                      <div className="rounded-lg border border-dashed p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Needs promotion</p>
                        <p className="font-semibold">{needsAttentionEvent.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {needsAttentionEvent.occupancyRate ? `${Math.round(needsAttentionEvent.occupancyRate)}%` : 'Limited'} of tickets claimed.
                          Launch a campaign or send a message to boost conversions.
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        All upcoming events are pacing well. Keep momentum going with targeted campaigns when needed.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Suspense fallback={<LoadingSpinner />}>
                <DashboardOverview events={enhancedEvents} onEventSelect={handleEventSelect} />
          </Suspense>
            </div>
          )}
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

        <TabsContent value="sponsorship" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                  <HandshakeIcon className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Sponsorship Management</CardTitle>
                  <CardDescription>
                    Connect with sponsors, manage packages, and track sponsorship revenue
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Sponsors</CardTitle>
                    <HandshakeIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Across all events</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sponsorship Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">$0</div>
                    <p className="text-xs text-muted-foreground">Total committed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Packages</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">0</div>
                    <p className="text-xs text-muted-foreground">Sponsorship tiers</p>
                  </CardContent>
                </Card>
              </div>

              <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
                <HandshakeIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sponsorship Tools Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Create sponsorship packages, manage sponsor relationships, and track ROI for your events. 
                  This feature is currently in development.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" disabled>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Package
                  </Button>
                  <Button variant="outline" disabled>
                    <Users className="mr-2 h-4 w-4" />
                    Manage Sponsors
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
