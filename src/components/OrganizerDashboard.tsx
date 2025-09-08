// src/components/OrganizerDashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useOrganizerAnalytics } from '@/hooks/useOrganizerAnalytics';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { VerificationBadge } from './VerificationBadge';
import { PayoutDashboard } from './PayoutDashboard';
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
}

// Placeholder when DB returns none
const mockEvents = [
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
  },
];

const fallbackSalesData = [
  { name: 'Jan', sales: 4000 },
  { name: 'Feb', sales: 3000 },
  { name: 'Mar', sales: 2000 },
  { name: 'Apr', sales: 2780 },
  { name: 'May', sales: 1890 },
  { name: 'Jun', sales: 2390 },
];

const formatUSD = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const formatInt = (n: number) => new Intl.NumberFormat().format(n || 0);

// Loose types to be resilient to hook shape changes
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
  // Optional: view_count?: number;
};

export function OrganizerDashboard({ user, onCreateEvent, onEventSelect }: OrganizerDashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'sales' | 'engagement' | 'payouts'>('overview');
  const { profile } = useAuth();

  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const { eventAnalytics, overallAnalytics, loading, error, refreshAnalytics } = useOrganizerAnalytics();

  // Pull creator’s events
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id,title,created_at')
          .eq('created_by', user.id)
          .order('created_at', { ascending: false });

        if (!cancelled) {
          if (error) {
            console.error('Error loading user events:', error);
            setUserEvents(mockEvents);
          } else {
            setUserEvents((data || []).length ? data! : mockEvents);
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

  // Derived totals w/ safe fallbacks
  const totalRevenue =
    (overallAnalytics as any)?.total_revenue ??
    analytics.reduce((sum, e) => sum + (e.total_revenue || 0), 0) ??
    userEvents.reduce((sum, e) => sum + (e.revenue || 0), 0);

  const totalAttendees =
    (overallAnalytics as any)?.total_attendees ??
    analytics.reduce((sum, e) => sum + (e.total_attendees || 0), 0) ??
    userEvents.reduce((sum, e) => sum + (e.attendees || 0), 0);

  const totalEvents = (overallAnalytics as any)?.total_events ?? (analytics.length || userEvents.length);
  const completedEvents = (overallAnalytics as any)?.completed_events ?? 0;

  // Views: prefer analytics.engagement_metrics.views; fallback to row.view_count; fallback to mock/userEvents.views
  const totalViews =
    analytics.reduce(
      (sum, e) =>
        sum +
        (e.engagement_metrics?.views ??
          // @ts-ignore (if your hook exposes view_count)
          (e as any).view_count ??
          0),
      0
    ) || userEvents.reduce((sum, e) => sum + (e.views || 0), 0);

  const likesTotal = analytics.reduce((s, e) => s + (e.engagement_metrics?.likes || 0), 0);
  const commentsTotal = analytics.reduce((s, e) => s + (e.engagement_metrics?.comments || 0), 0);
  const sharesTotal = analytics.reduce((s, e) => s + (e.engagement_metrics?.shares || 0), 0);
  const ticketsTotal = analytics.reduce((s, e) => s + (e.ticket_sales || 0), 0);

  // Period-aware refresh (passes the selected period if your hook supports it)
  const handleRefresh = async () => {
    try {
      // @ts-ignore – allow hooks that accept a period argument
      await (refreshAnalytics?.length ? refreshAnalytics(selectedPeriod) : refreshAnalytics());
    } catch (e) {
      console.error('Refresh failed', e);
    }
  };

  // Sharing (native share fallback to copy link)
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

  // Simple sales chart data: map analytics to bars (fallback if none)
  const salesChartData = useMemo(() => {
    if (!analytics.length) return fallbackSalesData;
    return analytics.map((e, idx) => ({
      name: e.event_title?.slice(0, 10) || `Event ${idx + 1}`,
      sales: e.total_revenue || 0,
    }));
  }, [analytics]);

  return (
    <div className="min-h-0 flex flex-col w-full">
      {/* Header */}
      <div className="border-b bg-card p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1>Organizer Dashboard</h1>
              <VerificationBadge status={(profile?.verification_status as any) || 'none'} />
            </div>
            <p className="text-sm text-muted-foreground">Welcome back, {user.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={onCreateEvent}>
              <Plus className="w-4 h-4 mr-1" />
              Create Event
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 p-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="h-full flex flex-col min-h-0">
          {/* Sticky tablist to avoid overlay issues */}
          <div className="relative z-20 sticky top-0 bg-background pb-2">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="events">Events ({totalEvents})</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="engagement">Engagement</TabsTrigger>
              <TabsTrigger value="payouts">Payouts</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Revenue</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{formatUSD(totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">All-time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Attendees</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{formatInt(totalAttendees)}</div>
                  <p className="text-xs text-muted-foreground">{formatInt(completedEvents)} completed events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Events</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{formatInt(totalEvents)}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatInt(totalEvents - completedEvents)} active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm">Total Views</CardTitle>
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">{formatInt(totalViews)}</div>
                  <p className="text-xs text-muted-foreground">Across all events</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent / Top events */}
            <Card>
              <CardHeader>
                <CardTitle>Your Events</CardTitle>
                <CardDescription>Manage and track your event performance</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center gap-4 p-4">
                          <div className="w-12 h-12 bg-muted rounded" />
                          <div className="flex-1">
                            <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                            <div className="h-3 bg-muted rounded w-1/4" />
                          </div>
                          <div className="w-20 h-8 bg-muted rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : analytics.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No events yet</h3>
                    <p className="mb-4">Create your first event to start building your audience</p>
                    <Button onClick={onCreateEvent}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Event
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.slice(0, 3).map((event) => (
                      <div
                        key={event.event_id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => onEventSelect(event)}
                        aria-label={`Open ${event.event_title}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center">
                            <Ticket className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-sm font-medium">{event.event_title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {formatInt(event.total_attendees || 0)} attendees • {formatInt(event.ticket_sales || 0)} tickets sold
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm">
                            <div className="font-medium">{formatUSD(event.total_revenue || 0)}</div>
                            <div className="text-muted-foreground">{formatInt(event.check_ins || 0)} check-ins</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              shareEvent(event.event_id, event.event_title);
                            }}
                            aria-label="Share event"
                          >
                            <Share className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EVENTS */}
          <TabsContent value="events" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Your Events</h2>
              <Button variant="outline" size="sm" onClick={onCreateEvent}>
                <Plus className="w-4 h-4 mr-2" />
                New Event
              </Button>
            </div>

            <div className="grid gap-4">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="animate-pulse flex">
                      <div className="w-32 h-24 bg-muted" />
                      <div className="flex-1 p-4">
                        <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                        <div className="h-3 bg-muted rounded w-1/4 mb-3" />
                        <div className="grid grid-cols-4 gap-4">
                          {[1, 2, 3, 4].map((j) => (
                            <div key={j} className="h-3 bg-muted rounded" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              ) : analytics.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No events yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first event to start building your audience</p>
                  <Button onClick={onCreateEvent}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                  </Button>
                </div>
              ) : (
                analytics.map((event) => (
                  <Card key={event.event_id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex">
                      <div className="w-32 h-24 bg-primary/10 flex items-center justify-center">
                        <Ticket className="w-8 h-8 text-primary" />
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-sm font-medium">{event.event_title}</h3>
                            <p className="text-xs text-muted-foreground">Event ID: {event.event_id.slice(-8)}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => onEventSelect(event)} aria-label="Open event">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => shareEvent(event.event_id, event.event_title)}
                              aria-label="Share event"
                            >
                              <Share className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 mt-3 text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{formatInt(event.total_attendees || 0)} attendees</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Ticket className="w-3 h-3" />
                            <span>{formatInt(event.ticket_sales || 0)} sold</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Heart className="w-3 h-3" />
                            <span>{formatInt(event.engagement_metrics?.likes || 0)} likes</span>
                          </div>
                          <div className="flex items-center gap-1 font-medium">
                            <DollarSign className="w-3 h-3" />
                            <span>{formatUSD(event.total_revenue || 0)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* SALES */}
          <TabsContent value="sales" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Sales Dashboard</h2>
              <div className="flex gap-2">
                {(['7d', '30d', '90d'] as const).map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod(period)}
                    aria-pressed={selectedPeriod === period}
                  >
                    {period}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Total Sales</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatUSD(totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground">All time revenue</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Tickets Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatInt(ticketsTotal)}</div>
                  <p className="text-xs text-muted-foreground">Total tickets</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Avg. Ticket Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {ticketsTotal ? formatUSD(Math.round(totalRevenue / ticketsTotal)) : '$0'}
                  </div>
                  <p className="text-xs text-muted-foreground">Per ticket</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Refunds</CardTitle>
                </CardHeader>
                <CardContent>
                  {/* If your hook exposes refunds, wire it here */}
                  <div className="text-2xl font-bold">0</div>
                  <p className="text-xs text-muted-foreground">Total refunded</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Revenue by Event</CardTitle>
                <CardDescription>Compare revenue across events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENGAGEMENT */}
          <TabsContent value="engagement" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg">Engagement Analytics</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Total Likes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatInt(likesTotal)}</div>
                  <p className="text-xs text-muted-foreground">Across all events</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Comments
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatInt(commentsTotal)}</div>
                  <p className="text-xs text-muted-foreground">Total comments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Share className="w-4 h-4" />
                    Shares
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatInt(sharesTotal)}</div>
                  <p className="text-xs text-muted-foreground">Total shares</p>
                </CardContent>
              </Card>
            </div>

            {analytics.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Event Engagement</CardTitle>
                  <CardDescription>Likes, comments, and shares by event</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.map((event) => (
                      <div key={event.event_id} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3">{event.event_title}</h4>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            <span>{formatInt(event.engagement_metrics?.likes || 0)} likes</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>{formatInt(event.engagement_metrics?.comments || 0)} comments</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Share className="w-4 h-4" />
                            <span>{formatInt(event.engagement_metrics?.shares || 0)} shares</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PAYOUTS */}
          <TabsContent value="payouts" className="space-y-4">
            <PayoutDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default OrganizerDashboard;
