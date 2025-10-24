// src/components/EventAnalytics.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Users as UsersIcon,
  DollarSign as DollarSignIcon,
  Ticket as TicketIcon,
  Scan as ScanIcon,
  RefreshCw,
  Download,
  FileJson,
  Printer,
  Link as LinkIcon,
  AlertTriangle,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

/* -------------------------------- Types -------------------------------- */

interface EventKPIs {
  gross_revenue: number;
  net_revenue: number;
  platform_fees: number;
  tickets_sold: number;
  capacity: number;
  sell_through: number;
  checkin_rate: number;
  posts_created: number;
  feed_engagements: number;
}

interface TierPerformance {
  id: string;
  name: string;
  price_cents: number;
  quantity: number | null;
  sold: number;
  revenue: number;
  sell_through: number;
}

interface EventAnalyticsData {
  event: {
    id: string;
    title: string;
    start_at: string;
    end_at: string;
  };
  kpis: EventKPIs;
  sales_curve: Array<{
    date: string;
    cumulative_revenue: number;
    daily_revenue: number;
    daily_units: number;
  }>;
  checkin_timeline: Array<{
    date: string;
    scans: number;
    duplicates: number;
  }>;
  tier_performance: TierPerformance[];
  scan_summary: {
    total_scans: number;
    valid_scans: number;
    duplicate_scans: number;
  };
}

interface EventAnalyticsProps {
  eventId?: string;
}

/* ------------------------------- Helpers -------------------------------- */

const formatCurrency = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const clampPct = (n?: number) => Math.max(0, Math.min(100, Number.isFinite(n ?? 0) ? (n as number) : 0));
const pctText = (n?: number) => `${clampPct(n).toFixed(1)}%`;

const keyFor = (userId: string | undefined, k: string) => `event-analytics:${userId || 'anon'}:${k}`;

const getDateFromRange = (range: string): string => {
  const now = new Date();
  const ms = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  return new Date(now.getTime() - ms * 24 * 60 * 60 * 1000).toISOString();
};

const safeFileName = (s: string) =>
  (s || 'event')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

/** tiny sparkline bars without extra deps */
const SparkBars: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[3px] h-16" aria-hidden="true">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-2.5 rounded-sm bg-primary/70"
          style={{ height: `${(v / max) * 100}%` }}
          title={`${v}`}
        />
      ))}
    </div>
  );
};

/* ---------------------------- Main Component ---------------------------- */

const EventAnalytics: React.FC<EventAnalyticsProps> = ({ eventId: initialEventId }) => {
  const { user } = useAuth();
  const [selectedEvent, setSelectedEvent] = useState<string>(initialEventId || '');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [analytics, setAnalytics] = useState<EventAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Array<{ id: string; title: string; start_at: string }>>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ea.autoRefresh') === '1';
    } catch {
      return false;
    }
  });
  const [realtimeNudge, setRealtimeNudge] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);

  // prevent stale responses
  const requestIdRef = useRef(0);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /* --------------------------- Persisted controls -------------------------- */

  useEffect(() => {
    if (!user) return;
    const savedEvent = localStorage.getItem(keyFor(user.id, 'selectedEvent'));
    const savedRange = localStorage.getItem(keyFor(user.id, 'dateRange'));
    if (!initialEventId && savedEvent) setSelectedEvent(savedEvent);
    if (savedRange) setDateRange(savedRange);
  }, [user, initialEventId]);

  useEffect(() => {
    if (!user) return;
    if (selectedEvent) localStorage.setItem(keyFor(user.id, 'selectedEvent'), selectedEvent);
  }, [selectedEvent, user]);

  useEffect(() => {
    if (!user) return;
    localStorage.setItem(keyFor(user.id, 'dateRange'), dateRange);
  }, [dateRange, user]);

  useEffect(() => {
    try {
      localStorage.setItem('ea.autoRefresh', autoRefresh ? '1' : '0');
    } catch {
      // ignore
    }
  }, [autoRefresh]);

  /* -------------------------- Connectivity watcher ------------------------- */

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  /* ------------------------------ Load events ------------------------------ */

  useEffect(() => {
    if (user) {
      fetchUserEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /* --------------------------- Fetch analytics ---------------------------- */

  useEffect(() => {
    if (selectedEvent) {
      fetchEventAnalytics();
    } else {
      setAnalytics(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, dateRange]);

  // optional auto refresh every 60s
  useEffect(() => {
    if (!autoRefresh || !selectedEvent) return;
    const id = window.setInterval(fetchEventAnalytics, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, selectedEvent, dateRange]);

  // realtime “nudge” – if orders or tickets change for this event, prompt to refresh
  useEffect(() => {
    if (!selectedEvent) return;
    try {
      if (subRef.current) {
        supabase.removeChannel(subRef.current);
        subRef.current = null;
      }
      const channel = supabase
        .channel(`ea_${selectedEvent}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `event_id=eq.${selectedEvent}` }, () =>
          setRealtimeNudge(true)
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `event_id=eq.${selectedEvent}` }, () =>
          setRealtimeNudge(true)
        )
        .subscribe();
      subRef.current = channel;
      return () => {
        if (subRef.current) supabase.removeChannel(subRef.current);
        subRef.current = null;
      };
    } catch {
      // silent; RLS or table missing
    }
  }, [selectedEvent]);

  const fetchUserEvents = async () => {
    try {
      // Individual events
      const { data: individualEvents, error: indErr } = await supabase
        .from('events')
        .select('id, title, start_at')
        .eq('owner_context_type', 'individual')
        .eq('owner_context_id', user?.id)
        .order('start_at', { ascending: false });

      if (indErr) throw indErr;

      // Org memberships
      const { data: orgMemberships, error: memErr } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user?.id);

      if (memErr) throw memErr;

      const orgIds = orgMemberships?.map((m) => m.org_id) || [];
      let orgEvents: Array<{ id: string; title: string; start_at: string }> = [];

      if (orgIds.length > 0) {
        const { data, error } = await supabase
          .from('events')
          .select('id, title, start_at')
          .eq('owner_context_type', 'organization')
          .in('owner_context_id', orgIds)
          .order('start_at', { ascending: false });

        if (error) throw error;
        orgEvents = data || [];
      }

      // Merge & sort by start_at desc
      const all = [...(individualEvents || []), ...orgEvents].sort(
        (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime()
      );

      setEvents(all);
      if (all.length > 0 && !selectedEvent) {
        setSelectedEvent(all[0].id);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch events',
        variant: 'destructive',
      });
    }
  };

  const fetchEventAnalytics = async () => {
    if (!selectedEvent) return;
    setLoading(true);
    const myReqId = ++requestIdRef.current;

    try {
      const fromDate = getDateFromRange(dateRange);
      const toDate = new Date().toISOString();

      const { data, error } = await supabase.functions.invoke('analytics-event-overview', {
        body: { event_id: selectedEvent, from: fromDate, to: toDate },
      });

      if (error) throw error;

      if (myReqId !== requestIdRef.current) return; // ignore stale response
      setAnalytics(data as EventAnalyticsData);
      setLastUpdated(Date.now());
      setRealtimeNudge(false);
    } catch (error: any) {
      console.error('Error fetching event analytics:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to fetch event analytics',
        variant: 'destructive',
      });
    } finally {
      if (myReqId === requestIdRef.current) setLoading(false);
    }
  };

  /* --------------------------------- Memos -------------------------------- */

  const salesDailyUnits = useMemo(
    () => (analytics?.sales_curve || []).map((d) => d.daily_units ?? 0),
    [analytics?.sales_curve]
  );

  /* ------------------------------ Exporters ------------------------------- */

  const tierCsv = () => {
    if (!analytics?.tier_performance?.length) return '';
    const header = ['Tier', 'Price', 'Quantity', 'Sold', 'Revenue', 'SellThrough%'];
    const rows = analytics.tier_performance.map((t) => [
      `"${t.name.replace(/"/g, '""')}"`,
      (t.price_cents / 100).toFixed(2),
      t.quantity ?? '',
      t.sold,
      (t.revenue / 100).toFixed(2),
      t.sell_through.toFixed(2),
    ]);
    return [header, ...rows].map((r) => r.join(',')).join('\n');
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const downloadTiersCSV = () => {
    const csv = tierCsv();
    if (!csv) return;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const fname = `${safeFileName(analytics?.event.title || 'event')}-tiers.csv`;
    download(blob, fname);
    toast({ title: 'Exported', description: 'Tier performance CSV downloaded.' });
  };

  const downloadJSON = () => {
    if (!analytics) return;
    const blob = new Blob([JSON.stringify(analytics, null, 2)], { type: 'application/json' });
    const fname = `${safeFileName(analytics.event.title)}-analytics.json`;
    download(blob, fname);
  };

  const copyShareLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}?event=${selectedEvent}&range=${dateRange}`;
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Shareable report link copied to clipboard.' });
    } catch {
      // ignore
    }
  };

  /* --------------------------------- UI ---------------------------------- */

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please sign in to view analytics</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Event Analytics</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Detailed performance insights for your events
              {lastUpdated && (
                <span className="ml-2 text-xs">
                  • Updated {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {offline && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs text-yellow-700">
                  <AlertTriangle className="h-3.5 w-3.5" /> Offline
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={fetchEventAnalytics} disabled={loading} variant="outline" size="sm" className="h-8 px-3 text-xs">
              <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 px-3 text-xs">
              <Printer className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button variant="outline" size="sm" onClick={copyShareLink} className="h-8 px-3 text-xs">
              <LinkIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">Copy Link</span>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadJSON} disabled={!analytics} className="h-8 px-3 text-xs">
              <FileJson className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">JSON</span>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTiersCSV} disabled={!analytics?.tier_performance?.length} className="h-8 px-3 text-xs">
              <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 sm:mb-8">
        <Select value={selectedEvent} onValueChange={setSelectedEvent}>
          <SelectTrigger className="w-full sm:w-80" aria-label="Select event">
            <SelectValue placeholder="Select event" />
          </SelectTrigger>
          <SelectContent>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id}>
                <div className="flex flex-col">
                  <span className="truncate">{event.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(event.start_at)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Select date range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={autoRefresh ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAutoRefresh((v) => !v)}
          className="sm:w-auto w-full h-8 px-3 text-xs"
        >
          <RefreshCw className={`h-3 w-3 sm:h-4 sm:w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{autoRefresh ? 'Auto refresh: ON' : 'Auto refresh: OFF'}</span>
          <span className="sm:hidden">{autoRefresh ? 'Auto ON' : 'Auto OFF'}</span>
        </Button>
      </div>

      {/* Realtime nudge */}
      {realtimeNudge && (
        <Card className="mb-6 border-primary/30">
          <CardContent className="py-3 flex items-center justify-between">
            <div className="text-sm">
              New activity detected (orders/tickets). Data may be stale.
            </div>
            <Button size="sm" onClick={fetchEventAnalytics} className="h-8 px-3 text-xs">
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="hidden sm:inline">Update now</span>
              <span className="sm:hidden">Update</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-3 sm:h-4 bg-muted rounded w-3/4" />
              </CardHeader>
              <CardContent>
                <div className="h-6 sm:h-8 bg-muted rounded w-1/2 mb-2" />
                <div className="h-2 sm:h-3 bg-muted rounded w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : analytics ? (
        <div className="space-y-6">
          {/* Event Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="truncate">{analytics.event.title}</span>
                <Badge variant="outline">
                  {formatDate(analytics.event.start_at)} — {formatDate(analytics.event.end_at)}
                </Badge>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <Card role="region" aria-label="Revenue">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Revenue</CardTitle>
                <DollarSignIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold">{formatCurrency(analytics.kpis.gross_revenue)}</div>
                <p className="text-xs text-muted-foreground">Net: {formatCurrency(analytics.kpis.net_revenue)}</p>
              </CardContent>
            </Card>

            <Card role="region" aria-label="Tickets sold">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Tickets Sold</CardTitle>
                <TicketIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold">
                  {analytics.kpis.tickets_sold} / {analytics.kpis.capacity || '—'}
                </div>
                <div className="mt-2">
                  <div
                    className="h-2 w-full bg-muted rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={clampPct(analytics.kpis.sell_through)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Sell-through"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${clampPct(analytics.kpis.sell_through)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pctText(analytics.kpis.sell_through)} sell-through
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card role="region" aria-label="Check-ins">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Check-ins</CardTitle>
                <ScanIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold">{analytics.scan_summary.total_scans}</div>
                <div className="mt-2">
                  <div
                    className="h-2 w-full bg-muted rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={clampPct(analytics.kpis.checkin_rate)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Check-in rate"
                  >
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${clampPct(analytics.kpis.checkin_rate)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pctText(analytics.kpis.checkin_rate)} of tickets •{' '}
                    <span className="text-yellow-600">{analytics.scan_summary.duplicate_scans}</span> duplicates
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card role="region" aria-label="Engagement">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Engagement</CardTitle>
                <TrendingUpIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold">{analytics.kpis.feed_engagements}</div>
                <p className="text-xs text-muted-foreground">{analytics.kpis.posts_created} posts</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales sparkline */}
          {salesDailyUnits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Sales (Daily Units)</span>
                  <span className="text-xs text-muted-foreground">
                    Last {salesDailyUnits.length} days • Total{' '}
                    {salesDailyUnits.reduce((a, b) => a + b, 0).toLocaleString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SparkBars values={salesDailyUnits.slice(-30)} />
              </CardContent>
            </Card>
          )}

          {/* Tier Performance */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base sm:text-lg">Ticket Tier Performance</CardTitle>
              <Button variant="outline" size="sm" onClick={downloadTiersCSV} disabled={!analytics.tier_performance?.length} className="text-xs">
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              {analytics.tier_performance.length ? (
                <div className="space-y-3 sm:space-y-4">
                  {analytics.tier_performance.map((tier) => {
                    const soldPct =
                      tier.quantity && tier.quantity > 0
                        ? clampPct((tier.sold / tier.quantity) * 100)
                        : clampPct(tier.sell_through);
                    return (
                      <div key={tier.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-2 sm:space-y-0">
                        <div className="flex-1 sm:pr-4">
                          <h4 className="font-medium text-sm sm:text-base">{tier.name}</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {formatCurrency(tier.price_cents)} • {tier.sold}
                            {typeof tier.quantity === 'number' ? ` / ${tier.quantity}` : ''} sold
                          </p>
                          <div
                            className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={soldPct}
                            aria-label={`${tier.name} sell-through`}
                          >
                            <div className="h-full bg-primary" style={{ width: `${soldPct}%` }} />
                          </div>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium text-sm sm:text-base">{formatCurrency(tier.revenue)}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground">{pctText(soldPct)} sold</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No tiers found</div>
              )}
            </CardContent>
          </Card>

          {/* Scan Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Scan Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-green-600">{analytics.scan_summary.valid_scans}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Valid Scans</p>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold text-yellow-600">{analytics.scan_summary.duplicate_scans}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Duplicates</p>
                </div>
                <div className="text-center">
                  <div className="text-lg sm:text-2xl font-bold">{analytics.scan_summary.total_scans}</div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Scans</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-60" />
          <p className="text-muted-foreground">No events available yet</p>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      )}
    </div>
  );
};

export default EventAnalytics;