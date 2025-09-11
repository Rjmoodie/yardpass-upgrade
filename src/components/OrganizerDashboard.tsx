// src/components/OrganizerDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';
import { useOrganizerAnalytics } from '@/hooks/useOrganizerAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationBadge } from './VerificationBadge';
import { PayoutDashboard } from './PayoutDashboard';
import { OrganizerRolesPanel } from './organizer/OrganizerRolesPanel';
import { EventManagement } from './EventManagement';
import { EventCreator } from './EventCreator';
import { CreateEventFlow } from './CreateEventFlow';
import {
  Plus,
  Users,
  DollarSign,
  Calendar,
  Eye,
  Heart,
  Share,
  MoreVertical,
  RefreshCw,
  Ticket,
  MessageSquare,
  UserPlus,
  Mail,
  Search,
  Filter,
  Download,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  AlertCircle,
  Settings,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Target,
  Award,
  Star,
  Globe,
  Lock,
  Unlock,
  Edit,
  Trash2,
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Square,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'attendee' | 'organizer';
}

interface OrganizerDashboardProps {
  user: User;
  onCreateEvent: () => void;
  onEventSelect: (event: any) => void;
  selectedEventId?: string;
}

// Enhanced event interface
interface Event {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'live' | 'completed' | 'cancelled';
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
}

// Mock data with enhanced metrics
const mockEvents: Event[] = [
  {
    id: '1',
    title: 'Summer Music Festival 2024',
    status: 'published',
    date: 'July 15-17, 2024',
    attendees: 1243,
    revenue: 89540,
    views: 15600,
    likes: 892,
    shares: 156,
    tickets_sold: 1243,
    capacity: 2000,
    conversion_rate: 7.9,
    engagement_rate: 6.7,
    created_at: '2024-01-15T10:00:00Z',
    start_at: '2024-07-15T18:00:00Z',
    end_at: '2024-07-17T23:00:00Z',
    venue: 'Central Park',
    category: 'Music',
    cover_image_url: '/api/placeholder/400/200'
  },
  {
    id: '2',
    title: 'Tech Innovation Summit',
    status: 'draft',
    date: 'August 22, 2024',
    attendees: 67,
    revenue: 8940,
    views: 2300,
    likes: 45,
    shares: 12,
    tickets_sold: 67,
    capacity: 500,
    conversion_rate: 2.9,
    engagement_rate: 2.5,
    created_at: '2024-01-20T14:30:00Z',
    start_at: '2024-08-22T09:00:00Z',
    end_at: '2024-08-22T17:00:00Z',
    venue: 'Convention Center',
    category: 'Technology',
    cover_image_url: '/api/placeholder/400/200'
  },
];

const fallbackSalesData = [
  { name: 'Jan', sales: 4000, attendees: 120, events: 2 },
  { name: 'Feb', sales: 3000, attendees: 90, events: 1 },
  { name: 'Mar', sales: 2000, attendees: 60, events: 1 },
  { name: 'Apr', sales: 2780, attendees: 85, events: 2 },
  { name: 'May', sales: 1890, attendees: 55, events: 1 },
  { name: 'Jun', sales: 2390, attendees: 70, events: 1 },
];

const formatUSD = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const formatInt = (n: number) => new Intl.NumberFormat().format(n || 0);
const formatPercent = (n: number) => `${n.toFixed(1)}%`;

// Enhanced analytics type
type EventAnalyticsRow = {
  event_id: string;
  event_title: string;
  ticket_sales?: number;
  total_revenue?: number;
  total_attendees?: number;
  check_ins?: number;
  engagement_metrics?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  conversion_rate?: number;
  engagement_rate?: number;
};

export function OrganizerDashboard({ user, onCreateEvent, onEventSelect, selectedEventId }: OrganizerDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'sales' | 'engagement' | 'payouts' | 'teams' | 'comms'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'published' | 'live' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'revenue' | 'attendees' | 'engagement'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventCreator, setShowEventCreator] = useState(false);
  const [showEventManagement, setShowEventManagement] = useState(false);
  const { profile } = useAuth();

  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const { eventAnalytics, overallAnalytics, loading, error, refreshAnalytics } = useOrganizerAnalytics();

  // Enhanced event loading with real data
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingEvents(true);
        const { data, error } = await supabase
          .from('events')
          .select(`
            id,
            title,
            status,
            created_at,
            start_at,
            end_at,
            venue,
            category,
            cover_image_url,
            ticket_tiers (
              id,
              name,
              price_cents,
              quantity,
              sold_count
            )
          `)
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        if (!cancelled) {
          if (error) {
            console.error('Error loading user events:', error);
            setUserEvents(mockEvents);
          } else {
            // Transform the data to match our interface
            const transformedEvents = (data || []).map(event => {
              const ticketTiers = event.ticket_tiers || [];
              const totalCapacity = ticketTiers.reduce((sum: number, tier: any) => sum + (tier.quantity || 0), 0);
              const totalSold = ticketTiers.reduce((sum: number, tier: any) => sum + (tier.sold_count || 0), 0);
              const totalRevenue = ticketTiers.reduce((sum: number, tier: any) => sum + ((tier.price_cents || 0) * (tier.sold_count || 0)), 0);
              
              return {
                id: event.id,
                title: event.title,
                status: event.status || 'draft',
                date: new Date(event.start_at).toLocaleDateString(),
                attendees: totalSold,
                revenue: totalRevenue / 100, // Convert cents to dollars
                views: Math.floor(Math.random() * 10000) + 1000, // Mock for now
                likes: Math.floor(Math.random() * 500) + 50,
                shares: Math.floor(Math.random() * 100) + 10,
                tickets_sold: totalSold,
                capacity: totalCapacity,
                conversion_rate: totalSold > 0 ? (totalSold / totalCapacity) * 100 : 0,
                engagement_rate: Math.random() * 10 + 2, // Mock for now
                created_at: event.created_at,
                start_at: event.start_at,
                end_at: event.end_at,
                venue: event.venue,
                category: event.category,
                cover_image_url: event.cover_image_url
              };
            });
            
            setUserEvents(transformedEvents.length ? transformedEvents : mockEvents);
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error fetching user events:', e);
          setUserEvents(mockEvents);
        }
      } finally {
        if (!cancelled) setLoadingEvents(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const analytics = (eventAnalytics || []) as EventAnalyticsRow[];

  // Enhanced analytics calculations
  const totalRevenue = (overallAnalytics as any)?.total_revenue ?? 
    analytics.reduce((sum, e) => sum + (e.total_revenue || 0), 0) ?? 
    userEvents.reduce((sum, e) => sum + e.revenue, 0);

  const totalAttendees = (overallAnalytics as any)?.total_attendees ?? 
    analytics.reduce((sum, e) => sum + (e.total_attendees || 0), 0) ?? 
    userEvents.reduce((sum, e) => sum + e.attendees, 0);

  const totalEvents = (overallAnalytics as any)?.total_events ?? userEvents.length;
  const completedEvents = userEvents.filter(e => e.status === 'completed').length;
  const activeEvents = userEvents.filter(e => ['published', 'live'].includes(e.status)).length;

  const totalViews = analytics.reduce((sum, e) => sum + (e.engagement_metrics?.views ?? 0), 0) || 
    userEvents.reduce((sum, e) => sum + e.views, 0);

  const likesTotal = analytics.reduce((s, e) => s + (e.engagement_metrics?.likes || 0), 0);
  const commentsTotal = analytics.reduce((s, e) => s + (e.engagement_metrics?.comments || 0), 0);
  const sharesTotal = analytics.reduce((s, e) => s + (e.engagement_metrics?.shares || 0), 0);
  const ticketsTotal = analytics.reduce((s, e) => s + (e.ticket_sales || 0), 0);

  // Enhanced filtering and sorting
  const filteredEvents = useMemo(() => {
    let filtered = userEvents;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.venue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(event => event.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'revenue':
          aValue = a.revenue;
          bValue = b.revenue;
          break;
        case 'attendees':
          aValue = a.attendees;
          bValue = b.attendees;
          break;
        case 'engagement':
          aValue = a.engagement_rate;
          bValue = b.engagement_rate;
          break;
        default:
          aValue = new Date(a.start_at).getTime();
          bValue = new Date(b.start_at).getTime();
      }

      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [userEvents, searchQuery, statusFilter, sortBy, sortOrder]);

  // Enhanced refresh with period support
  const handleRefresh = async () => {
    try {
      await (refreshAnalytics?.length ? refreshAnalytics(selectedPeriod) : refreshAnalytics());
    } catch (e) {
      console.error('Refresh failed', e);
    }
  };

  // Enhanced sharing with analytics
  const shareEvent = async (eventId: string, title: string) => {
    const url = `${window.location.origin}/event/${eventId}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title, text: title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // ignore
    }
  };

  // Enhanced sales chart data
  const salesChartData = useMemo(() => {
    if (!analytics.length) return fallbackSalesData;
    return analytics.map((e, idx) => ({
      name: e.event_title?.slice(0, 10) || `Event ${idx + 1}`,
      sales: e.total_revenue || 0,
      attendees: e.total_attendees || 0,
      events: 1
    }));
  }, [analytics]);

  // Event status management
  const updateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', eventId);

      if (error) throw error;

      // Update local state
      setUserEvents(prev => prev.map(event => 
        event.id === eventId ? { ...event, status: newStatus as any } : event
      ));
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  // Quick actions
  const quickActions = [
    { label: 'Create Event', icon: Plus, action: () => setShowEventCreator(true), variant: 'default' as const },
    { label: 'View Analytics', icon: BarChart3, action: () => setActiveTab('sales'), variant: 'outline' as const },
    { label: 'Manage Team', icon: Users, action: () => setActiveTab('teams'), variant: 'outline' as const },
    { label: 'View Payouts', icon: DollarSign, action: () => setActiveTab('payouts'), variant: 'outline' as const },
  ];

  // Event management handlers
  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setShowEventManagement(true);
  };

  const handleBackToDashboard = () => {
    setShowEventManagement(false);
    setShowEventCreator(false);
    setSelectedEvent(null);
  };

  // If showing event management, render that instead
  if (showEventManagement && selectedEvent) {
    return <EventManagement event={selectedEvent} onBack={handleBackToDashboard} />;
  }

  // If showing event creator, render that instead
  if (showEventCreator) {
    return <CreateEventFlow onBack={handleBackToDashboard} onCreate={handleBackToDashboard} />;
  }

  return (
    <div className="min-h-0 flex flex-col w-full">
      {/* Enhanced Header */}
      <div className="border-b border-accent bg-card p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-accent">Organizer Dashboard</h1>
              <VerificationBadge status={(profile?.verification_status as any) || 'none'} />
            </div>
            <p className="text-sm text-accent-muted">Welcome back, {user.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="btn-enhanced border-accent">
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={() => setShowEventCreator(true)} className="btn-enhanced">
              <Plus className="w-4 h-4 mr-1" />
              Create Event
            </Button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              size="sm"
              onClick={action.action}
              className="btn-enhanced"
            >
              <action.icon className="w-4 h-4 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col min-h-0">
          {/* Enhanced mobile-optimized tablist */}
          <div className="relative z-20 sticky top-0 bg-background pb-2">
            <div className="tabs-mobile">
              <TabsTrigger value="overview" className="tab-enhanced">Overview</TabsTrigger>
              <TabsTrigger value="events" className="tab-enhanced">Events ({totalEvents})</TabsTrigger>
              <TabsTrigger value="sales" className="tab-enhanced">Sales</TabsTrigger>
              <TabsTrigger value="engagement" className="tab-enhanced">Engagement</TabsTrigger>
              <TabsTrigger value="payouts" className="tab-enhanced">Payouts</TabsTrigger>
              <TabsTrigger value="teams" className="tab-enhanced">Teams</TabsTrigger>
              <TabsTrigger value="comms" className="tab-enhanced">Comms</TabsTrigger>
            </div>
          </div>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="card-enhanced">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm text-accent">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-accent-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-accent">{formatUSD(totalRevenue)}</div>
                  <p className="text-xs text-accent-muted">All-time</p>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm text-accent">Total Attendees</CardTitle>
                  <Users className="h-4 w-4 text-accent-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-accent">{formatInt(totalAttendees)}</div>
                  <p className="text-xs text-accent-muted">{formatInt(completedEvents)} completed events</p>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm text-accent">Active Events</CardTitle>
                  <Calendar className="h-4 w-4 text-accent-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-accent">{formatInt(activeEvents)}</div>
                  <p className="text-xs text-accent-muted">{formatInt(totalEvents)} total events</p>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm text-accent">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-accent-muted" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl text-accent">{formatInt(totalViews)}</div>
                  <p className="text-xs text-accent-muted">Across all events</p>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Engagement Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatPercent((likesTotal + commentsTotal + sharesTotal) / Math.max(totalViews, 1) * 100)}
                  </div>
                  <p className="text-sm text-accent-muted">Likes, comments, shares</p>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Conversion Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatPercent(totalAttendees / Math.max(totalViews, 1) * 100)}
                  </div>
                  <p className="text-sm text-accent-muted">Views to attendees</p>
                </CardContent>
              </Card>

              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Avg Revenue/Event</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatUSD(totalEvents > 0 ? totalRevenue / totalEvents : 0)}
                  </div>
                  <p className="text-sm text-accent-muted">Per event average</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Events */}
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="text-accent">Recent Events</CardTitle>
                <CardDescription className="text-accent-muted">Your latest event activity</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingEvents ? (
                  <div className="text-center py-4 text-accent-muted">Loading events...</div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-8 text-accent-muted">
                    <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No events found.</p>
                    <p className="text-sm">Create your first event to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.slice(0, 5).map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 border border-accent rounded-lg hover:border-strong transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center border border-accent">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-accent">{event.title}</div>
                            <div className="text-sm text-accent-muted">
                              {event.date} • {event.venue}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="badge-enhanced">
                            {event.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEventSelect(event)}
                            className="btn-enhanced border-accent"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS TAB */}
          <TabsContent value="events" className="space-y-6">
            {/* Enhanced Event Management */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-enhanced w-full sm:w-64"
                />
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="input-enhanced w-full sm:w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="input-enhanced w-32">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                    <SelectItem value="attendees">Attendees</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="btn-enhanced border-accent"
                >
                  {sortOrder === 'asc' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Events Grid/List */}
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {filteredEvents.map((event) => (
                <Card key={event.id} className="card-enhanced hover:shadow-lg transition-all duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-accent line-clamp-2">{event.title}</CardTitle>
                        <CardDescription className="text-accent-muted">
                          {event.date} • {event.venue}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary" className="badge-enhanced">
                        {event.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Event Metrics */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-accent font-medium">{formatUSD(event.revenue)}</div>
                        <div className="text-accent-muted">Revenue</div>
                      </div>
                      <div>
                        <div className="text-accent font-medium">{formatInt(event.attendees)}</div>
                        <div className="text-accent-muted">Attendees</div>
                      </div>
                      <div>
                        <div className="text-accent font-medium">{formatInt(event.views)}</div>
                        <div className="text-accent-muted">Views</div>
                      </div>
                      <div>
                        <div className="text-accent font-medium">{formatPercent(event.conversion_rate)}</div>
                        <div className="text-accent-muted">Conversion</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEventSelect(event)}
                        className="btn-enhanced border-accent flex-1"
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => shareEvent(event.id, event.title)}
                        className="btn-enhanced border-accent"
                      >
                        <Share className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-6">
            <Card className="card-enhanced">
              <CardHeader>
                <CardTitle className="text-accent">Revenue Analytics</CardTitle>
                <CardDescription className="text-accent-muted">Track your sales performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => [formatUSD(Number(value)), 'Revenue']} />
                      <Area type="monotone" dataKey="sales" stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENGAGEMENT TAB */}
          <TabsContent value="engagement" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Total Likes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{formatInt(likesTotal)}</div>
                </CardContent>
              </Card>
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Total Comments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{formatInt(commentsTotal)}</div>
                </CardContent>
              </Card>
              <Card className="card-enhanced">
                <CardHeader>
                  <CardTitle className="text-accent">Total Shares</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{formatInt(sharesTotal)}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PAYOUTS TAB */}
          <TabsContent value="payouts" className="space-y-6">
            <PayoutDashboard />
          </TabsContent>

          {/* TEAMS TAB */}
          <TabsContent value="teams" className="space-y-6">
            {selectedEventId ? (
              <OrganizerRolesPanel eventId={selectedEventId} />
            ) : (
              <Card className="card-enhanced">
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-accent-muted" />
                  <h3 className="text-lg font-semibold text-accent mb-2">Select an Event</h3>
                  <p className="text-accent-muted">Choose an event to manage team members and roles.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* COMMS TAB */}
          <TabsContent value="comms" className="space-y-6">
            <Card className="card-enhanced">
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-accent-muted" />
                <h3 className="text-lg font-semibold text-accent mb-2">Communication Center</h3>
                <p className="text-accent-muted">Send announcements, manage notifications, and communicate with your team.</p>
                <Button className="btn-enhanced mt-4">
                  <Mail className="h-4 w-4 mr-2" />
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}