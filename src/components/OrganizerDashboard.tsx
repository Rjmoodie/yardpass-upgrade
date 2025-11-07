import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  Users,
  DollarSign,
  Package,
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
  ArrowLeft,
  Shield,
  Loader2,
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
import { ErrorBoundary, SuspenseErrorFallback } from '@/components/ErrorBoundary';
import { formatCentsAsCurrency, formatNumber } from '@/utils/formatters';
import {
  isCommittedStatus,
  isPendingStatus,
  SPONSORSHIP_COMMITTED_STATUSES,
  SPONSORSHIP_PENDING_STATUSES
} from '@/constants/sponsorship';
import type {
  SponsorshipPackageRecord,
  SponsorshipOrderRecord,
  EventSponsorshipSummary,
  SponsorshipStats,
  EventSponsorshipRow
} from '@/types/sponsorship';

// Lazy load dashboard components
const AnalyticsHub = lazy(() => import('@/components/AnalyticsHub'));
const PayoutPanel = lazy(() => import('@/components/PayoutPanel').then(m => ({ default: m.PayoutPanel })));
const OrganizationTeamPanel = lazy(() => import('@/components/OrganizationTeamPanel').then(m => ({ default: m.OrganizationTeamPanel })));
const EventManagement = lazy(() => import('./EventManagement'));
const DashboardOverview = lazy(() => import('@/components/dashboard/DashboardOverview').then(m => ({ default: m.DashboardOverview })));
const OrgWalletDashboard = lazy(() => import('@/components/wallet/OrgWalletDashboard').then(m => ({ default: m.OrgWalletDashboard })));
const CampaignDashboard = lazy(() => import('@/components/campaigns/CampaignDashboard').then(m => ({ default: m.CampaignDashboard })));
const OrganizerCommsPanel = lazy(() => import('@/components/organizer/OrganizerCommsPanel').then(m => ({ default: m.OrganizerCommsPanel })));
const PackageEditorPanel = lazy(() => import('@/components/organizer/PackageEditor').then(m => ({ default: m.PackageEditor })));
const EventSponsorshipManagementPanel = lazy(() => import('@/components/EventSponsorshipManagement').then(m => ({ default: m.EventSponsorshipManagement })));

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

// Type imports now from @/types/sponsorship and constants from @/constants/sponsorship

// ─────────────────────────────────────────
// Navigation Configuration
const TAB_KEYS = ['events', 'analytics', 'campaigns', 'messaging', 'teams', 'wallet', 'payouts', 'sponsorship'] as const;
type TabKey = typeof TAB_KEYS[number];
const DEFAULT_TAB: TabKey = 'events';

// ─────────────────────────────────────────
// Dashboard Constants
const CLOCK_UPDATE_INTERVAL_MS = 60_000; // Update dashboard clock every minute
const MAX_RECENT_POSTS = 10; // Maximum number of recent posts to fetch for event details

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

  // Exit organizer mode function
  const exitOrganizerMode = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: 'attendee' })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Switched to Attendee Mode',
        description: 'You can access the organizer dashboard anytime from your profile.',
      });

      // Reload to update navigation
      window.location.href = '/';
    } catch (error) {
      console.error('Failed to switch mode:', error);
      toast({
        title: 'Error',
        description: 'Failed to switch mode. Please try again.',
        variant: 'destructive',
      });
    }
  }, [user?.id]);

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
    const interval = setInterval(() => setNow(new Date()), CLOCK_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Event pipeline controls
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<DerivedEventStatus | 'all'>('all');
  
  type EventSortOption = 
    | 'title-asc' 
    | 'title-desc' 
    | 'revenue-asc' 
    | 'revenue-desc' 
    | 'date-asc' 
    | 'date-desc'
    | 'start_desc'  // Legacy aliases
    | 'start_asc' 
    | 'attendees_desc';
  
  const [eventSort, setEventSort] = useState<EventSortOption>('date-desc');

  // Server-side scoped events (org only)
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(true);
  const mountedRef = useRef(true);

  const [sponsorshipPackages, setSponsorshipPackages] = useState<SponsorshipPackageRecord[]>([]);
  const [sponsorshipOrders, setSponsorshipOrders] = useState<SponsorshipOrderRecord[]>([]);
  const [sponsorshipLoading, setSponsorshipLoading] = useState(false);
  const [selectedSponsorshipEventId, setSelectedSponsorshipEventId] = useState<string | null>(null);

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
        // Type the nested arrays properly
        type OrderRecord = { status: string; total_cents?: number };
        type TicketRecord = { status: string };
        
        const paidOrders = (e.orders as OrderRecord[] || []).filter(o => o.status === 'paid');
        const revenue = paidOrders.reduce((sum: number, o) => sum + (o.total_cents || 0), 0) / 100;
        
        const issuedTickets = (e.tickets as TicketRecord[] || []).filter(
          t => t.status === 'issued' || t.status === 'transferred' || t.status === 'redeemed'
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      console.error('fetchScopedEvents error', err);
      toast({ title: 'Error loading events', description: message, variant: 'destructive' });
      if (mountedRef.current) {
        setEvents([]);
        setDashboardTotals({ events: 0, attendees: 0, revenue: 0 });
      }
    } finally {
      if (mountedRef.current) setLoadingEvents(false);
    }
  }, [selectedOrgId]);

  const fetchOrgSponsorshipData = useCallback(async () => {
    // Fetch summary data for all events for the overview table
    // Individual event management panel will load its own detailed data
    if (!selectedOrgId) {
      setSponsorshipPackages([]);
      setSponsorshipOrders([]);
      return;
    }

    setSponsorshipLoading(true);
    try {
      const eventIds = events.map(event => event.id);
      if (!eventIds.length) {
        setSponsorshipPackages([]);
        setSponsorshipOrders([]);
        return;
      }

      const { data: packageData, error: packageError } = await supabase
        .from('sponsorship_packages')
        .select('id, event_id, title, tier, price_cents, inventory, sold, visibility, is_active, benefits')
        .in('event_id', eventIds);

      if (packageError) throw packageError;

      const typedPackages: SponsorshipPackageRecord[] = (packageData || []).map(pkg => ({
        id: pkg.id,
        event_id: pkg.event_id,
        title: pkg.title ?? null,
        tier: pkg.tier ?? pkg.title ?? null,
        price_cents: pkg.price_cents ?? 0,
        inventory: pkg.inventory,
        sold: pkg.sold,
        visibility: pkg.visibility,
        is_active: pkg.is_active,
        benefits: pkg.benefits ?? {}, // Always object, consistent with type
      }));

      // Fetch orders without joins
      const { data: orderData, error: orderError} = await supabase
        .from('sponsorship_orders')
        .select('id, event_id, package_id, sponsor_id, amount_cents, status, created_at')
        .in('event_id', eventIds);

      if (orderError) throw orderError;

      // If there are orders, fetch related sponsors and packages
      let typedOrders: SponsorshipOrderRecord[] = [];
      if (orderData && orderData.length > 0) {
        const sponsorIds = [...new Set(orderData.map(o => o.sponsor_id))];
        const packageIds = [...new Set(orderData.map(o => o.package_id))];

        const { data: sponsorsData, error: sponsorsError } = await supabase
          .from('sponsors')
          .select('id, name')
          .in('id', sponsorIds);

        if (sponsorsError) {
          console.error('Error fetching sponsors for dashboard:', sponsorsError);
        }

        const { data: packagesData, error: packagesError } = await supabase
          .from('sponsorship_packages')
          .select('id, tier, title')
          .in('id', packageIds);

        if (packagesError) {
          console.error('Error fetching packages for dashboard:', packagesError);
        }

        const sponsorsMap = new Map(sponsorsData?.map(s => [s.id, s]) || []);
        const packagesMap = new Map(packagesData?.map(p => [p.id, p]) || []);

        typedOrders = orderData.map(order => {
          const sponsor = sponsorsMap.get(order.sponsor_id);
          const pkg = packagesMap.get(order.package_id);
          
          return {
            id: order.id,
            event_id: order.event_id,
            package_id: order.package_id,
            sponsor_id: order.sponsor_id,
            amount_cents: order.amount_cents ?? 0,
            status: order.status ?? 'pending',
            created_at: order.created_at,
            sponsor_name: sponsor?.name ?? null,
            package_tier: pkg?.tier ?? pkg?.title ?? null,
          };
        });
      }

      setSponsorshipPackages(typedPackages);
      setSponsorshipOrders(typedOrders);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      console.error('Error loading sponsorship data', error);
      toast({
        title: 'Error loading sponsorship data',
        description: message,
        variant: 'destructive',
      });
      setSponsorshipPackages([]);
      setSponsorshipOrders([]);
    } finally {
      setSponsorshipLoading(false);
    }
  }, [selectedOrgId, events, toast]);

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
      try { 
        supabase.removeChannel(ch); 
      } catch (error) {
        console.error('Error removing realtime channel:', error);
      }
    };
  }, [selectedOrgId, fetchScopedEvents]);

  // Fetch sponsorship data only after events are loaded to avoid race condition
  useEffect(() => {
    if (events.length > 0 && selectedOrgId) {
      fetchOrgSponsorshipData();
    }
  }, [events.length, selectedOrgId, fetchOrgSponsorshipData]);

  // Event select
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  
  interface EventDetails {
    ticketTiers: Array<{
      id: string;
      name: string;
      price: number;
      total: number;
      available: number;
      sold: number;
    }>;
    posts: any[]; // Could be typed more specifically if needed
  }
  
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    if (!events.length) {
      setSelectedSponsorshipEventId(null);
      return;
    }

    setSelectedSponsorshipEventId(prev => {
      if (prev && events.some(event => event.id === prev)) {
        return prev;
      }

      if (selectedEvent && events.some(event => event.id === selectedEvent.id)) {
        return selectedEvent.id;
      }

      return events[0]?.id ?? null;
    });
  }, [events, selectedEvent]);

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
        const { data: tiers, error: tiersError } = await supabase
          .from('ticket_tiers')
          .select('id, name, price_cents, total_quantity, reserved_quantity, issued_quantity')
          .eq('event_id', selectedEvent.id)
          .order('price_cents', { ascending: true });

        if (tiersError) {
          console.error('Error fetching ticket tiers:', tiersError);
        }

        const { data: posts, error: postsError } = await supabase
          .from('event_posts')
          .select('id, text, created_at, media_urls, like_count, comment_count')
          .eq('event_id', selectedEvent.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(MAX_RECENT_POSTS);

        if (postsError) {
          console.error('Error fetching event posts:', postsError);
        }

        // Type ticket tier records
        type TierRecord = {
          id: string;
          name: string;
          price_cents: number;
          total_quantity: number;
          reserved_quantity: number;
          issued_quantity: number;
        };

        setEventDetails({
          ticketTiers: (tiers as TierRecord[] || []).map(t => ({
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

  const sponsorshipStats = useMemo((): SponsorshipStats => {
    const committedOrders = sponsorshipOrders.filter(order => isCommittedStatus(order.status));
    const revenueCents = committedOrders.reduce((sum, order) => sum + (order.amount_cents ?? 0), 0);
    const activeSponsors = new Set(committedOrders.map(order => order.sponsor_id)).size;
    const pendingRequests = sponsorshipOrders.filter(order => isPendingStatus(order.status)).length;
    const soldOutPackages = sponsorshipPackages.filter(pkg => {
      const inventory = pkg.inventory ?? 0;
      if (inventory <= 0) return false;
      const soldCount =
        typeof pkg.sold === 'number'
          ? pkg.sold
          : committedOrders.filter(order => order.package_id === pkg.id).length;
      return soldCount >= inventory;
    }).length;

    return {
      totalRevenue: revenueCents / 100,
      activeSponsors,
      totalPackages: sponsorshipPackages.length,
      pendingRequests,
      soldOutPackages,
    };
  }, [sponsorshipOrders, sponsorshipPackages]);

  const eventSponsorshipSummaries = useMemo(() => {
    return events.reduce<Record<string, EventSponsorshipSummary>>((acc, event) => {
      const eventPackages = sponsorshipPackages.filter(pkg => pkg.event_id === event.id);
      const eventOrders = sponsorshipOrders.filter(order => order.event_id === event.id);
      const committed = eventOrders.filter(order => isCommittedStatus(order.status));
      const revenueCents = committed.reduce((sum, order) => sum + (order.amount_cents ?? 0), 0);
      const totalAvailable = eventPackages.reduce((sum, pkg) => sum + (pkg.inventory ?? 0), 0);
      const soldFromPackages = eventPackages.reduce((sum, pkg) => sum + (pkg.sold ?? 0), 0);
      const soldFromOrders = committed.length;
      const sold = soldFromPackages > 0 ? soldFromPackages : soldFromOrders;
      const pending = eventOrders.filter(order => isPendingStatus(order.status)).length;
      const sponsors = new Set(committed.map(order => order.sponsor_id)).size;

      acc[event.id] = {
        packages: eventPackages.length,
        totalAvailable,
        sold,
        revenue: revenueCents / 100,
        pending,
        sponsors,
      };

      return acc;
    }, {});
  }, [events, sponsorshipPackages, sponsorshipOrders]);

  const eventRows = useMemo(() => {
    return events
      .map(event => {
        const summary =
          eventSponsorshipSummaries[event.id] ?? {
            packages: 0,
            totalAvailable: 0,
            sold: 0,
            revenue: 0,
            pending: 0,
            sponsors: 0,
          };
        const startDate = event.start_at ? new Date(event.start_at) : null;
        return {
          id: event.id,
          title: event.title,
          startDate,
          summary,
        };
      })
      .sort((a, b) => {
        const aTime = a.startDate?.getTime() ?? 0;
        const bTime = b.startDate?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [events, eventSponsorshipSummaries]);

  const selectedSponsorshipEvent = useMemo(
    () => events.find(event => event.id === selectedSponsorshipEventId) || null,
    [events, selectedSponsorshipEventId]
  );

  const selectedEventSummary = selectedSponsorshipEventId
    ? eventSponsorshipSummaries[selectedSponsorshipEventId]
    : undefined;

  const selectedEventUtilization = useMemo(() => {
    if (!selectedEventSummary || selectedEventSummary.totalAvailable <= 0) return 0;
    return Math.min(
      100,
      (Math.min(selectedEventSummary.sold, selectedEventSummary.totalAvailable) /
        selectedEventSummary.totalAvailable) *
        100
    );
  }, [selectedEventSummary]);

  const selectedEventOpenSlots = useMemo(() => {
    if (!selectedEventSummary) return 0;
    return Math.max(selectedEventSummary.totalAvailable - selectedEventSummary.sold, 0);
  }, [selectedEventSummary]);

  // Callback for when sponsorship data changes - simply refetch
  const handleSponsorshipDataChange = useCallback(() => {
    fetchOrgSponsorshipData();
  }, [fetchOrgSponsorshipData]);

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
    <div className="container mx-auto p-4 sm:p-6 space-y-4 min-h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Organizer Dashboard</h1>

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
            
            {/* Mode Indicator Badge */}
            <div className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">Organizer</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{activeOrg?.name || 'Organization'}</span>
            {activeOrg?.is_verified && (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <CheckCircle2 className="h-4 w-4" /> Verified
              </span>
            )}
            <span>• {dashboardTotals.events.toLocaleString()} event{dashboardTotals.events === 1 ? '' : 's'}</span>
            <span>• {dashboardTotals.attendees.toLocaleString()} attendees</span>
            <span>• ${dashboardTotals.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} revenue</span>
          </p>
        </div>

        <div className="flex gap-2 flex-wrap items-center">
          {/* Exit Organizer Mode Button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={exitOrganizerMode}
            className="items-center gap-2 border-muted-foreground/30"
            title="Switch back to Attendee Mode"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs">Exit Organizer</span>
          </Button>
          
          {/* View Mode Toggle */}
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
          
          {/* Primary Actions */}
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="space-y-4">
        <div className="w-full overflow-x-auto scrollbar-hide">
          <TabsList className="inline-flex w-auto min-w-full justify-start gap-1.5 p-1">
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
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Upcoming Events</CardTitle>
                    <CalendarDays className="h-4 w-4 text-primary/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{statusCounts.upcoming.toLocaleString()}</div>
                    <p className="text-xs text-foreground/70 mt-1 font-medium">Scheduled for the future</p>
                  </CardContent>
                </Card>
                <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live Right Now</CardTitle>
                    <Activity className="h-4 w-4 text-green-500/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{statusCounts.live.toLocaleString()}</div>
                    <p className="text-xs text-foreground/70 mt-1 font-medium">Currently in progress</p>
                  </CardContent>
                </Card>
                <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Completed</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-blue-500/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{statusCounts.completed.toLocaleString()}</div>
                    <p className="text-xs text-foreground/70 mt-1 font-medium">Past events</p>
                  </CardContent>
                </Card>
                <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tickets Issued</CardTitle>
                    <Ticket className="h-4 w-4 text-primary/60" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{totalTicketsIssued.toLocaleString()}</div>
                    <p className="text-xs text-foreground/70 mt-1 font-medium">All active events</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-4">
                  <div>
                    <CardTitle className="text-xl font-bold tracking-tight">Event pipeline</CardTitle>
                    <CardDescription>Search, prioritize, and drill into the events that matter most.</CardDescription>
                  </div>
                  <Button size="sm" onClick={goCreateEvent}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Event
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
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
                                <div className="font-semibold text-sm sm:text-base">{event.title}</div>
                                <div className="text-xs text-foreground/70 font-medium">
                                  {[event.city, event.venue].filter(Boolean).join(' • ') || 'Location TBD'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{startLabel}</div>
                                <div className="text-xs text-foreground/70">{scheduleHint || 'Awaiting updates'}</div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusBadgeVariant as any} className="capitalize font-medium">
                                  {event.derivedStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm font-semibold">
                                  {event.tickets_sold.toLocaleString()} {event.capacity > 0 ? `of ${event.capacity.toLocaleString()}` : ''}
                                </div>
                                {typeof event.occupancyRate === 'number' && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <Progress value={event.occupancyRate} className="h-1.5 w-24" />
                                    <span className="text-xs text-foreground/75 font-medium">{Math.round(event.occupancyRate)}%</span>
              </div>
            )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-bold tracking-tight">
                                ${event.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-3 lg:grid-cols-3">
                <Card className="lg:col-span-2 border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle className="text-lg font-bold tracking-tight">Operational insights</CardTitle>
                      <CardDescription>Track fulfillment and highlight where to focus next.</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Avg Capacity</p>
                      <p className="text-2xl font-bold tracking-tight">{averageOccupancy !== null ? `${averageOccupancy}%` : '—'}</p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {averageOccupancy !== null ? (
                      <div className="space-y-3">
                        <Progress value={averageOccupancy} className="h-2.5" />
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          On average, you're filling <span className="font-semibold text-foreground">{averageOccupancy}%</span> of available capacity. Monitor upcoming events to keep momentum high.
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground/70">
                        Provide capacity on your events to track utilization in real time.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-gradient-to-br from-card/80 to-card/60 backdrop-blur-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-4">
                    <div>
                      <CardTitle className="text-lg font-bold tracking-tight">Performance alerts</CardTitle>
                      <CardDescription>Wins and gaps</CardDescription>
                    </div>
                    <TrendingUp className="h-5 w-5 text-primary/60" />
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {topGrossingEvent ? (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <p className="text-xs uppercase tracking-wide text-primary/80 font-medium mb-1">Top Grossing</p>
                        <p className="font-semibold text-foreground">{topGrossingEvent.title}</p>
                        <p className="text-xs text-foreground/70 font-medium">${topGrossingEvent.revenue.toLocaleString()} collected</p>
                      </div>
                    ) : (
                      <p className="text-foreground/70">Ticketed events will surface here once revenue starts flowing.</p>
                    )}

                    {needsAttentionEvent ? (
                      <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                        <p className="text-xs uppercase tracking-wide text-warning font-medium mb-1">Needs Promotion</p>
                        <p className="font-semibold text-foreground">{needsAttentionEvent.title}</p>
                        <p className="text-xs text-foreground/70">
                          {needsAttentionEvent.occupancyRate ? `${Math.round(needsAttentionEvent.occupancyRate)}%` : 'Limited'} of tickets claimed.
                          Launch a campaign to boost conversions.
                        </p>
                      </div>
                    ) : (
                      <p className="text-foreground/70">
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
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <OrganizationTeamPanel organizationId={selectedOrgId} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <AnalyticsHub initialOrgId={selectedOrgId} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <CampaignDashboard orgId={selectedOrgId} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <ErrorBoundary>
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
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-6">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <OrgWalletDashboard orgId={selectedOrgId} />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <PayoutPanel
                key={`${selectedOrgId}-payouts`}
                contextType="organization"
                contextId={selectedOrgId}
              />
            </Suspense>
          </ErrorBoundary>
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
                    Publish sponsorship packages, review partner interest, and track revenue in one place.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Sponsors</CardTitle>
                    <HandshakeIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(sponsorshipStats.activeSponsors)}</div>
                    <p className="text-xs text-muted-foreground">Across all events</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Sponsorship Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCentsAsCurrency(sponsorshipStats.totalRevenue * 100)}</div>
                    <p className="text-xs text-muted-foreground">Committed across accepted deals</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Packages Live</CardTitle>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(sponsorshipStats.totalPackages)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(sponsorshipStats.soldOutPackages)} sold out
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(sponsorshipStats.pendingRequests)}</div>
                    <p className="text-xs text-muted-foreground">Awaiting your response</p>
                  </CardContent>
                </Card>
              </div>

              {loadingEvents ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading your events…
                </div>
              ) : events.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 p-10 text-center">
                  <HandshakeIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Create an event to unlock sponsorship tools</h3>
                  <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">
                    Sponsorship packages are tied to individual events. Once your first event is live you can publish tiers, approve
                    partners, and track fulfillment here.
                  </p>
                  <Button onClick={goCreateEvent}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Event
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Choose an event to manage sponsorships</h3>
                      <p className="text-sm text-muted-foreground">
                        Publish packages, review sponsor interest, and monitor delivery per event.
                      </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                      <Select
                        value={selectedSponsorshipEventId ?? undefined}
                        onValueChange={value => setSelectedSponsorshipEventId(value)}
                      >
                        <SelectTrigger className="w-full sm:w-64">
                          <SelectValue placeholder="Select event" />
                        </SelectTrigger>
                        <SelectContent>
                          {events.map(event => (
                            <SelectItem key={event.id} value={event.id}>
                              {event.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="outline" onClick={goCreateEvent} className="w-full sm:w-auto">
                        <Plus className="mr-2 h-4 w-4" />
                        New Event
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <h4 className="text-sm font-semibold">Event sponsorship overview</h4>
                      <span className="text-xs text-muted-foreground">Click a row to jump to that event</span>
                    </div>
                    {sponsorshipLoading ? (
                      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Refreshing sponsorship data…
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Event</TableHead>
                              <TableHead>Packages</TableHead>
                              <TableHead>Sold</TableHead>
                              <TableHead>Inventory</TableHead>
                              <TableHead>Revenue</TableHead>
                              <TableHead>Pending</TableHead>
                              <TableHead>Sponsors</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {eventRows.map(row => {
                              const summary = row.summary;
                              const isSelected = row.id === selectedSponsorshipEventId;
                              return (
                                <TableRow
                                  key={row.id}
                                  className={`cursor-pointer transition-colors ${isSelected ? 'bg-muted/60' : 'hover:bg-muted/40'}`}
                                  onClick={() => setSelectedSponsorshipEventId(row.id)}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      <span>{row.title}</span>
                                      {row.startDate && (
                                        <span className="text-xs text-muted-foreground">
                                          {row.startDate.toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>{formatNumber(summary.packages)}</TableCell>
                                  <TableCell>{formatNumber(summary.sold)}</TableCell>
                                  <TableCell>
                                    {summary.totalAvailable > 0 ? (
                                      <span>
                                        {formatNumber(Math.max(summary.totalAvailable - summary.sold, 0))} open of{' '}
                                        {formatNumber(summary.totalAvailable)}
                                      </span>
                                    ) : (
                                      '—'
                                    )}
                                  </TableCell>
                                  <TableCell>{formatCentsAsCurrency(summary.revenue * 100)}</TableCell>
                                  <TableCell>{formatNumber(summary.pending)}</TableCell>
                                  <TableCell>{formatNumber(summary.sponsors)}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {selectedSponsorshipEventId && (
                    <div className="space-y-6">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <ErrorBoundary>
                          <Suspense
                            fallback={
                              <div className="flex items-center justify-center rounded-lg border border-dashed py-10 text-sm text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading package editor…
                              </div>
                            }
                          >
                            <PackageEditorPanel eventId={selectedSponsorshipEventId} onCreated={handleSponsorshipDataChange} />
                          </Suspense>
                        </ErrorBoundary>
                        <Card>
                          <CardHeader>
                            <CardTitle>Event sponsorship snapshot</CardTitle>
                            {selectedSponsorshipEvent && (
                              <CardDescription>
                                {selectedSponsorshipEvent.start_at
                                  ? `Event starts ${new Date(selectedSponsorshipEvent.start_at).toLocaleDateString()}`
                                  : 'Event date to be announced'}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Packages live</p>
                                <p className="text-lg font-semibold">
                                  {formatNumber(selectedEventSummary?.packages ?? 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Committed sponsors</p>
                                <p className="text-lg font-semibold">
                                  {formatNumber(selectedEventSummary?.sponsors ?? 0)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Revenue</p>
                                <p className="text-lg font-semibold">
                                  {formatCentsAsCurrency((selectedEventSummary?.revenue ?? 0) * 100)}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Pending requests</p>
                                <p className="text-lg font-semibold">
                                  {formatNumber(selectedEventSummary?.pending ?? 0)}
                                </p>
                              </div>
                            </div>
                            {selectedEventSummary && selectedEventSummary.totalAvailable > 0 ? (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Inventory utilization</span>
                                  <span>{Math.round(selectedEventUtilization)}%</span>
                                </div>
                                <Progress value={selectedEventUtilization} />
                                <p className="text-xs text-muted-foreground">
                                  {formatNumber(selectedEventOpenSlots)} slots remaining out of{' '}
                                  {formatNumber(selectedEventSummary.totalAvailable)} total
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Add inventory counts to your packages to monitor utilization in real time.
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                      <ErrorBoundary>
                        <Suspense
                          fallback={
                            <div className="flex items-center justify-center rounded-lg border border-dashed py-10 text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading sponsorship management…
                            </div>
                          }
                        >
                          <EventSponsorshipManagementPanel
                            eventId={selectedSponsorshipEventId}
                            onDataChange={handleSponsorshipDataChange}
                          />
                        </Suspense>
                      </ErrorBoundary>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
