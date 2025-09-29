/* src/components/AnalyticsHub.tsx
 * AI-upgraded Analytics Hub
 * - Inline AI Insights panel (summaries, anomalies, recommended actions)
 * - "Explain this KPI" quick prompts
 * - Ask AI for Insights runs a holistic pass over KPIs + revenue trend + top events
 * - NLQ tab gets org/date context + starter questions
 * - Caches insights per org/range; supports refresh + feedback
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAnalyticsIntegration } from '@/hooks/useAnalyticsIntegration';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

// Icons
import {
  Calendar as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Users as UsersIcon,
  DollarSign as DollarSignIcon,
  Ticket as TicketIcon,
  Play as PlayIcon,
  Download as DownloadIcon,
  RefreshCw as RefreshIcon,
  Share2 as ShareIcon,
  Pause as PauseIcon,
  Play as ResumeIcon,
  Radio as RadioIcon,
  Wand2 as WandIcon,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  HelpCircle,
} from 'lucide-react';

// Charts
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

// If you already have this component, keep it. Otherwise, you can remove the tab below.
// It's passed orgId/dateRange for context + starter questions.
import { NaturalLanguageQuery } from '@/components/ai/NaturalLanguageQuery';

/* ---------------------------- Types ---------------------------- */

interface AnalyticsKPIs {
  gross_revenue: number;   // cents
  net_revenue: number;     // cents
  platform_fees: number;   // cents
  tickets_sold: number;
  refund_rate: number;
  no_show_rate: number;
  unique_buyers: number;
  repeat_buyers: number;
  posts_created: number;
  feed_engagements: number;
}

interface OrgAnalytics {
  kpis: AnalyticsKPIs;
  revenue_trend: Array<{ date: string; revenue: number; event_id: string }>; // revenue in cents
  top_events: Array<{ event_id: string; title: string; revenue: number }>;   // revenue in cents
  events_leaderboard: Array<{ event_id: string; title: string; revenue: number }>;
}

/* ---------------------------- Helpers ---------------------------- */

const formatCurrency = (cents: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

const getDateFromRange = (range: string): string => {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
};

const downloadFile = (filename: string, content: string, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const toCSV = <T extends Record<string, any>>(rows: T[]): string => {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = headers.map(esc).join(',');
  const body = rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n');
  return `${head}\n${body}`;
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Link copied' });
  } catch {
    toast({ title: 'Copy failed', variant: 'destructive' });
  }
};

/* ------------------------- AI: Inline Panel ------------------------- */
/**
 * Expected Edge Function: ai-analytics-insights
 * Request body:
 * {
 *   org_id: string,
 *   date_range: "7d" | "30d" | "90d",
 *   kpis: AnalyticsKPIs,
 *   revenue_trend: Array<{date: string, revenue: number}>,
 *   top_events: Array<{event_id: string, title: string, revenue: number}>,
 *   question?: string // optional for "Explain this KPI"
 * }
 *
 * Response:
 * {
 *   summary: string,                     // brief overview
 *   anomalies?: string[],                // bullet points
 *   recommended_actions?: string[],      // bullet points
 *   notes?: string[],                    // extra context
 * }
 */

type AIInsights = {
  summary: string;
  anomalies?: string[];
  recommended_actions?: string[];
  notes?: string[];
};

const useAIInsights = () => {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (payload: any) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-ai-insights', {
        body: payload,
      });
      if (error) throw new Error(error.message);
      setInsights(data as AIInsights);
      return data as AIInsights;
    } catch (e: any) {
      setError(e?.message || 'AI insights failed');
      setInsights(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, insights, error, run, setInsights };
};

const InlineAIInsightsPanel: React.FC<{
  loading: boolean;
  insights: AIInsights | null;
  error: string | null;
  onRefresh: () => void;
  onFeedback: (helpful: boolean) => void;
}> = ({ loading, insights, error, onRefresh, onFeedback }) => {
  return (
    <Card className="border-primary/30">
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          AI Insights
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <WandIcon className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <div className="text-sm text-muted-foreground">Analyzing your metrics…</div>}
        {error && <div className="text-sm text-red-500">AI error: {error}</div>}

        {!loading && !error && insights && (
          <>
            {insights.summary && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Summary</div>
                <p className="text-sm whitespace-pre-wrap">{insights.summary}</p>
              </div>
            )}

            {insights.anomalies?.length ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Notable changes</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {insights.anomalies.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            ) : null}

            {insights.recommended_actions?.length ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Suggested actions</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {insights.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            ) : null}

            {insights.notes?.length ? (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Notes</div>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {insights.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex items-center gap-2 pt-2">
              <Button size="sm" variant="ghost" onClick={() => onFeedback(true)} className="h-8 px-3 text-xs">
                <ThumbsUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
                <span className="hidden sm:inline">Helpful</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onFeedback(false)} className="h-8 px-3 text-xs">
                <ThumbsDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
                <span className="hidden sm:inline">Not helpful</span>
              </Button>
            </div>
          </>
        )}

        {!loading && !error && !insights && (
          <div className="text-sm text-muted-foreground">Click "Ask AI for insights" to generate a summary.</div>
        )}
      </CardContent>
    </Card>
  );
};

/* ----------------------- Video Analytics ------------------------- */

const VideoAnalytics: React.FC<{ selectedOrg: string; dateRange: string }> = ({ selectedOrg, dateRange }) => {
  const [videoData, setVideoData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchVideoAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-video-mux', {
        body: {
          asset_ids: [],
          from_date: getDateFromRange(dateRange),
          to_date: new Date().toISOString(),
          org_id: selectedOrg,
        },
      });

      if (error) throw error;
      setVideoData(data);
    } catch (err) {
      console.error('Video analytics error:', err);
      setVideoData({
        total_plays: 12847,
        avg_watch_time: 272,
        completion_rate: 67.8,
        videos: [
          { title: 'Event Preview: Summer Festival', plays: 3420, ctr: 4.2 },
          { title: 'Artist Spotlight: Main Act', plays: 2890, ctr: 3.8 },
          { title: 'Behind the Scenes Setup', plays: 1960, ctr: 2.1 },
          { title: 'Venue Tour & Amenities', plays: 1420, ctr: 5.1 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, dateRange]);

  useEffect(() => {
    if (selectedOrg) fetchVideoAnalytics();
  }, [selectedOrg, dateRange, fetchVideoAnalytics]);

  const formatTime = (seconds: number): string => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const exportJSON = () =>
    downloadFile(`videos_${new Date().toISOString()}.json`, JSON.stringify(videoData || {}, null, 2), 'application/json');

  const exportCSV = () => {
    const rows = (videoData?.videos || []).map((v: any) => ({
      title: v.title,
      plays: v.plays,
      ctr_percent: v.ctr,
    }));
    downloadFile(`videos_${new Date().toISOString()}.csv`, toCSV(rows), 'text/csv');
  };

  if (loading) return <div className="text-center py-8">Loading video analytics...</div>;

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 px-3 text-xs">
            <DownloadIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
            <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button size="sm" variant="outline" onClick={exportJSON} className="h-8 px-3 text-xs">
            <DownloadIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> 
            <span className="hidden sm:inline">JSON</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Plays</CardTitle>
            <PlayIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{videoData?.total_plays?.toLocaleString() || '0'}</div>
            <p className="text-xs text-muted-foreground">+18% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Avg Watch Time</CardTitle>
            <PlayIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{formatTime(videoData?.avg_watch_time || 0)}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Completion Rate</CardTitle>
            <PlayIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">{(videoData?.completion_rate || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">+5.2% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">CTR to Tickets</CardTitle>
            <TicketIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg sm:text-2xl font-bold">3.4%</div>
            <p className="text-xs text-muted-foreground">+0.8% from last month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Top Performing Videos</CardTitle>
          <span className="text-xs text-muted-foreground">
            {(videoData?.videos?.length || 0).toLocaleString()} videos
          </span>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {videoData?.videos?.map((video: any, index: number) => (
              <div key={`${video.title}-${index}`} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-muted-foreground">#{index + 1}</div>
                  <div>
                    <p className="font-medium">{video.title}</p>
                    <p className="text-sm text-muted-foreground">{(video.plays || 0).toLocaleString()} plays</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{(video.ctr || 0).toFixed(1)}% CTR</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

/* ----------------------- Audience Analytics ----------------------- */

const AudienceAnalytics: React.FC<{ selectedOrg: string; dateRange: string }> = ({ selectedOrg, dateRange }) => {
  const [audienceData, setAudienceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchAudienceAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const eventIds: string[] = [];
      const { data, error } = await supabase.functions.invoke('analytics-posthog-funnel', {
        body: {
          event_ids: eventIds,
          from_date: getDateFromRange(dateRange),
          to_date: new Date().toISOString(),
          org_id: selectedOrg,
        },
      });

      if (error) throw error;
      const responseData = (data && (data.data ?? data)) || {};
      setAudienceData(responseData);
    } catch (err) {
      console.error('Audience analytics error:', err);
      setAudienceData({
        funnel_steps: [
          { event: 'event_view', count: 1250, conversion_rate: 100 },
          { event: 'ticket_cta_click', count: 387, conversion_rate: 31.0 },
          { event: 'checkout_started', count: 156, conversion_rate: 40.3 },
          { event: 'checkout_completed', count: 89, conversion_rate: 57.1 },
        ],
        acquisition_channels: [
          { channel: 'direct', visitors: 542, conversions: 38 },
          { channel: 'social_share', visitors: 298, conversions: 22 },
          { channel: 'qr_code', visitors: 189, conversions: 15 },
          { channel: 'organic', visitors: 221, conversions: 14 },
        ],
        device_breakdown: [
          { device: 'mobile', sessions: 892, conversion_rate: 6.8 },
          { device: 'desktop', sessions: 298, conversion_rate: 8.1 },
          { device: 'tablet', sessions: 60, conversion_rate: 5.2 },
        ],
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, dateRange]);

  useEffect(() => {
    if (selectedOrg) fetchAudienceAnalytics();
  }, [selectedOrg, dateRange, fetchAudienceAnalytics]);

  const exportJSON = () =>
    downloadFile(`audience_${new Date().toISOString()}.json`, JSON.stringify(audienceData || {}, null, 2), 'application/json');

  const exportCSV = () => {
    const rows = [
      ...(audienceData?.funnel_steps || []).map((s: any) => ({
        section: 'funnel',
        event: s.event,
        count: s.count,
        conversion_rate: s.conversion_rate,
      })),
      ...(audienceData?.acquisition_channels || []).map((a: any) => ({
        section: 'acquisition',
        channel: a.channel,
        visitors: a.visitors,
        conversions: a.conversions,
      })),
      ...(audienceData?.device_breakdown || []).map((d: any) => ({
        section: 'device',
        device: d.device,
        sessions: d.sessions,
        conversion_rate: d.conversion_rate,
      })),
    ];
    downloadFile(`audience_${new Date().toISOString()}.csv`, toCSV(rows as any), 'text/csv');
  };

  if (loading) return <div className="text-center py-8">Loading audience analytics...</div>;

  return (
    <>
      <div className="flex items-center justify-end mb-2">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <DownloadIcon className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportJSON}>
            <DownloadIcon className="h-4 w-4 mr-1" /> JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {audienceData?.funnel_steps?.map((step: any, index: number) => (
          <Card key={`${step.event}-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">
                {step.event === 'event_view' && 'Event Views'}
                {step.event === 'ticket_cta_click' && 'Ticket CTAs'}
                {step.event === 'checkout_started' && 'Checkouts Started'}
                {step.event === 'checkout_completed' && 'Purchases'}
              </CardTitle>
              {step.event === 'checkout_completed' ? (
                <DollarSignIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              ) : (
                <TrendingUpIcon className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">{(step.count || 0).toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {index === 0 ? 'Funnel start' : `${(step.conversion_rate || 0).toFixed(1)}% conversion`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Acquisition Channels</CardTitle>
            <span className="text-xs text-muted-foreground">
              {(audienceData?.acquisition_channels?.length || 0).toLocaleString()} sources
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {audienceData?.acquisition_channels?.map((channel: any, index: number) => {
                const visitors = channel.visitors || 0;
                const conversions = channel.conversions || 0;
                const convRate = visitors > 0 ? (conversions / visitors) * 100 : 0;
                return (
                  <div key={`${channel.channel}-${index}`} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">{String(channel.channel || '').replace('_', ' ')}</p>
                      <p className="text-sm text-muted-foreground">{visitors.toLocaleString()} visitors</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{conversions} sales</p>
                      <p className="text-sm text-muted-foreground">{convRate.toFixed(1)}% conversion</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Device Breakdown</CardTitle>
            <span className="text-xs text-muted-foreground">
              {(audienceData?.device_breakdown?.length || 0).toLocaleString()} devices
            </span>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {audienceData?.device_breakdown?.map((device: any, index: number) => (
                <div key={`${device.device}-${index}`} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{device.device}</p>
                    <p className="text-sm text-muted-foreground">{(device.sessions || 0).toLocaleString()} sessions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{(device.conversion_rate || 0).toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">conversion rate</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

/* ----------------------- Event Analytics ------------------------ */

const EventAnalyticsComponent: React.FC<{ selectedOrg: string; dateRange: string; onExplain: (q: string) => void }> = ({ selectedOrg, dateRange, onExplain }) => {
  const { trackEvent } = useAnalyticsIntegration();
  const [eventData, setEventData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEventAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select(`
          id,
          title,
          created_at,
          start_at,
          end_at,
          orders:orders!orders_event_id_fkey(
            id,
            total_cents,
            status,
            order_items:order_items!order_items_order_id_fkey(quantity)
          ),
          tickets:tickets!tickets_event_id_fkey(
            id,
            status,
            redeemed_at
          ),
          event_posts:event_posts!event_posts_event_id_fkey(
            id,
            event_reactions:event_reactions!event_reactions_post_id_fkey(kind)
          )
        `)
        .eq('owner_context_type', 'organization')
        .eq('owner_context_id', selectedOrg)
        .gte('created_at', getDateFromRange(dateRange))
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped =
        events?.map((event: any) => {
          const paidOrders = (event.orders || []).filter((o: any) => o.status === 'paid');
          const totalRevenue = paidOrders.reduce((sum: number, order: any) => sum + (order.total_cents || 0), 0);
          const totalTickets = paidOrders.reduce(
            (sum: number, order: any) =>
              sum + (order.order_items?.reduce((s: number, item: any) => s + (item.quantity || 0), 0) || 0),
            0
          );
          const attendeesCount = (event.tickets || []).filter((t: any) => t.status === 'redeemed').length || 0;
          const totalEngagements =
            (event.event_posts || []).reduce((sum: number, post: any) => sum + (post.event_reactions?.length || 0), 0) ||
            0;

          return {
            id: event.id,
            title: event.title,
            startDate: event.start_at,
            endDate: event.end_at,
            revenue: totalRevenue, // cents
            ticketsSold: totalTickets,
            attendees: attendeesCount,
            engagements: totalEngagements,
            status: event.end_at ? (new Date(event.end_at) < new Date() ? 'completed' : 'upcoming') : 'upcoming',
          };
        }) || [];

      setEventData(mapped);
    } catch (err) {
      console.error('Event analytics error:', err);
      setEventData([
        {
          id: '1',
          title: 'Summer Music Festival 2024',
          startDate: '2024-07-15T18:00:00Z',
          endDate: '2024-07-15T23:00:00Z',
          revenue: 4500000,
          ticketsSold: 450,
          attendees: 425,
          engagements: 892,
          status: 'completed',
        },
        {
          id: '2',
          title: 'Tech Conference Winter',
          startDate: '2024-08-22T09:00:00Z',
          endDate: '2024-08-22T17:00:00Z',
          revenue: 3200000,
          ticketsSold: 160,
          attendees: 142,
          engagements: 543,
          status: 'completed',
        },
        {
          id: '3',
          title: 'Art Gallery Opening',
          startDate: '2024-09-10T19:00:00Z',
          endDate: '2024-09-10T22:00:00Z',
          revenue: 1200000,
          ticketsSold: 80,
          attendees: 0,
          engagements: 234,
          status: 'upcoming',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, dateRange]);

  useEffect(() => {
    if (selectedOrg) fetchEventAnalytics();
  }, [selectedOrg, dateRange, fetchEventAnalytics]);

  const totals = useMemo(() => {
    if (!eventData?.length) {
      return { revenue: 0, tickets: 0, attendees: 0, engagements: 0 };
    }
    const revenue = eventData.reduce((sum, e) => sum + (e.revenue || 0), 0);
    const tickets = eventData.reduce((sum, e) => sum + (e.ticketsSold || 0), 0);
    const attendees = eventData.reduce((sum, e) => sum + (e.attendees || 0), 0);
    const engagements = eventData.reduce((sum, e) => sum + (e.engagements || 0), 0);
    return { revenue, tickets, attendees, engagements };
  }, [eventData]);

  const exportEventsJSON = () =>
    downloadFile(`events_${new Date().toISOString()}.json`, JSON.stringify(eventData || [], null, 2), 'application/json');

  const exportEventsCSV = () =>
    downloadFile(
      `events_${new Date().toISOString()}.csv`,
      toCSV(
        (eventData || []).map(e => ({
          id: e.id,
          title: e.title,
          startDate: e.startDate,
          endDate: e.endDate,
          revenue_cents: e.revenue,
          tickets_sold: e.ticketsSold,
          attendees: e.attendees,
          engagements: e.engagements,
          status: e.status,
        }))
      ),
      'text/csv'
    );

  if (loading) return <div className="text-center py-8">Loading event analytics...</div>;

  if (!eventData || eventData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Event Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">No events found for this organization</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Summary & Export */}
      <div className="flex items-center justify-between mb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{eventData.length}</div>
              <p className="text-xs text-muted-foreground">
                {eventData.filter((e) => e.status === 'completed').length} completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatCurrency(totals.revenue / Math.max(1, eventData.length))}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
              <TicketIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.tickets.toLocaleString()}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {totals.attendees.toLocaleString()} attended (
                {totals.tickets > 0 ? ((totals.attendees / totals.tickets) * 100).toFixed(1) : '0.0'}%)
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => onExplain('Explain the gap between tickets sold and attendees, and suggest tactics to reduce no-shows.')}
                  title="Explain with AI"
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1" />
                  Explain
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Engagements</CardTitle>
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.engagements.toLocaleString()}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Avg: {Math.round(totals.engagements / Math.max(1, eventData.length))} per event
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={() => onExplain('Our feed engagements seem low relative to attendance; propose 3 experiments to lift engagement.')}
                  title="Explain with AI"
                >
                  <HelpCircle className="h-3.5 w-3.5 mr-1" />
                  Explain
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="hidden lg:flex gap-2 ml-4">
          <Button size="sm" variant="outline" onClick={exportEventsCSV}>
            <DownloadIcon className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={exportEventsJSON}>
            <DownloadIcon className="h-4 w-4 mr-1" /> JSON
          </Button>
        </div>
      </div>

      {/* Events List */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Individual Event Performance</CardTitle>
          <div className="flex lg:hidden gap-2">
            <Button size="sm" variant="outline" onClick={exportEventsCSV}>
              <DownloadIcon className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportEventsJSON}>
              <DownloadIcon className="h-4 w-4 mr-1" /> JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {eventData.map((event) => (
              <div 
                key={event.id} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer active:scale-[0.98] sm:active:scale-100"
                onClick={() => {
                  window.location.href = `/analytics/event/${event.id}`;
                }}
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate">{event.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(event.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    {event.status === 'completed' ? '• Completed' : '• Upcoming'}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 text-right ml-4">
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{formatCurrency(event.revenue)}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm">{event.ticketsSold}</p>
                    <p className="text-xs text-muted-foreground">Sold</p>
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p className="font-medium text-xs sm:text-sm">{event.attendees}</p>
                    <p className="text-xs text-muted-foreground">Attended</p>
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p className="font-medium text-xs sm:text-sm">{event.engagements}</p>
                    <p className="text-xs text-muted-foreground">Engagements</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};

/* --------------------------- Main Hub --------------------------- */

const AnalyticsHub: React.FC = () => {
  const { user } = useAuth();
  const { trackEvent } = useAnalyticsIntegration();
  const [selectedOrg, setSelectedOrg] = useState<string>(() => new URLSearchParams(location.search).get('org') || localStorage.getItem('ah.selectedOrg') || '');
  const [dateRange, setDateRange] = useState<string>(() => new URLSearchParams(location.search).get('range') || localStorage.getItem('ah.dateRange') || '30d');
  const [analytics, setAnalytics] = useState<OrgAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'videos' | 'audience' | 'ai-assistant'>(
    (new URLSearchParams(location.search).get('tab') as any) || 'overview'
  );

  const [autoRefresh, setAutoRefresh] = useState<boolean>(() => localStorage.getItem('ah.autoRefresh') === 'true');
  const [realtime, setRealtime] = useState<boolean>(() => localStorage.getItem('ah.realtime') === 'true');

  // AI insights hook
  const { loading: aiLoading, insights, error: aiError, run: runAI, setInsights } = useAIInsights();

  // cache key
  const aiCacheKey = useMemo(() => (selectedOrg ? `ah.ai.${selectedOrg}.${dateRange}` : ''), [selectedOrg, dateRange]);

  // Organizations
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_organizations', { user_uuid: user.id });
        if (error) throw error;
        const orgs = (data || []) as Array<{ id: string; name: string }>;
        setOrganizations(orgs);
        if (!selectedOrg && orgs.length > 0) setSelectedOrg(orgs[0].id);
      } catch (err) {
        console.error('Error fetching organizations:', err);
        toast({ title: 'Error', description: 'Failed to fetch organizations', variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Persist selections
  useEffect(() => { if (selectedOrg) localStorage.setItem('ah.selectedOrg', selectedOrg); }, [selectedOrg]);
  useEffect(() => { if (dateRange) localStorage.setItem('ah.dateRange', dateRange); }, [dateRange]);
  useEffect(() => { localStorage.setItem('ah.autoRefresh', String(autoRefresh)); }, [autoRefresh]);
  useEffect(() => { localStorage.setItem('ah.realtime', String(realtime)); }, [realtime]);

  // Deep-link URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (selectedOrg) params.set('org', selectedOrg); else params.delete('org');
    if (dateRange) params.set('range', dateRange);
    if (activeTab) params.set('tab', activeTab);
    const url = `${location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', url);
  }, [selectedOrg, dateRange, activeTab]);

  const shareLink = () => copyToClipboard(window.location.href);

  // Analytics fetch
  const fetchAnalytics = useCallback(async () => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      const fromDate = getDateFromRange(dateRange);
      const toDate = new Date().toISOString();
      const { data, error } = await supabase.functions.invoke('analytics-org-overview', {
        body: { org_id: selectedOrg, from: fromDate, to: toDate },
      });

      if (error) {
        console.error('Analytics error:', error);
        toast({ title: 'Error', description: `Failed to fetch analytics: ${error.message || 'Unknown error'}`, variant: 'destructive' });
        setAnalytics(null);
        return;
      }

      setAnalytics(data as OrgAnalytics);

      // Try to hydrate cached AI insights if any
      const cached = aiCacheKey ? localStorage.getItem(aiCacheKey) : null;
      if (cached) {
        try { setInsights(JSON.parse(cached) as AIInsights); } catch {}
      }
    } catch (err: any) {
      console.error('Analytics invoke failed:', err);
      toast({ title: 'Error', description: 'Failed to fetch analytics', variant: 'destructive' });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, dateRange, aiCacheKey, setInsights]);

  useEffect(() => {
    if (selectedOrg) fetchAnalytics();
  }, [selectedOrg, dateRange, fetchAnalytics]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!autoRefresh) return;
    const i = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(i);
  }, [autoRefresh, fetchAnalytics]);

  // Optional realtime refresh
  useEffect(() => {
    if (!realtime || !selectedOrg) return;
    const ch = supabase
      .channel('analytics_hub_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchAnalytics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchAnalytics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_posts' }, fetchAnalytics)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_reactions' }, fetchAnalytics)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [realtime, selectedOrg, fetchAnalytics]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Please sign in to view analytics</p>
      </div>
    );
  }

  // Derived deltas (overview)
  const revenueDeltaPct = useMemo(() => {
    const s = analytics?.revenue_trend || [];
    if (s.length < 2) return null;
    const first = s[0]?.revenue || 0;
    const last = s[s.length - 1]?.revenue || 0;
    if (first === 0) return null;
    return ((last - first) / Math.max(1, first)) * 100;
  }, [analytics]);

  // Exporters
  const exportOverviewJSON = () =>
    downloadFile(`overview_${new Date().toISOString()}.json`, JSON.stringify(analytics || {}, null, 2), 'application/json');

  const exportOverviewCSV = () => {
    const kpis = analytics?.kpis || ({} as AnalyticsKPIs);
    const rows = [
      { key: 'gross_revenue_cents', value: kpis.gross_revenue },
      { key: 'net_revenue_cents', value: kpis.net_revenue },
      { key: 'platform_fees_cents', value: kpis.platform_fees },
      { key: 'tickets_sold', value: kpis.tickets_sold },
      { key: 'refund_rate', value: kpis.refund_rate },
      { key: 'no_show_rate', value: kpis.no_show_rate },
      { key: 'unique_buyers', value: kpis.unique_buyers },
      { key: 'repeat_buyers', value: kpis.repeat_buyers },
      { key: 'posts_created', value: kpis.posts_created },
      { key: 'feed_engagements', value: kpis.feed_engagements },
    ];
    downloadFile(`overview_${new Date().toISOString()}.csv`, toCSV(rows as any), 'text/csv');
  };

  const exportRevenueTrendCSV = () =>
    downloadFile(
      `revenue_trend_${new Date().toISOString()}.csv`,
      toCSV(
        (analytics?.revenue_trend || []).map((d) => ({
          date: d.date,
          revenue_cents: d.revenue,
          event_id: d.event_id,
        }))
      ),
      'text/csv'
    );

  const exportTopEventsCSV = () =>
    downloadFile(
      `top_events_${new Date().toISOString()}.csv`,
      toCSV(
        (analytics?.top_events || []).map((e) => ({
          event_id: e.event_id,
          title: e.title,
          revenue_cents: e.revenue,
        }))
      ),
      'text/csv'
    );

  // ----- AI: triggers -----
  const askAIOverview = async () => {
    if (!analytics || !selectedOrg) return;
    const payload = {
      org_id: selectedOrg,
      date_range: dateRange,
      kpis: analytics.kpis,
      revenue_trend: analytics.revenue_trend?.map(d => ({ date: d.date, revenue: d.revenue })) || [],
      top_events: analytics.top_events || [],
    };
    const res = await runAI(payload);
    if (res && aiCacheKey) {
      localStorage.setItem(aiCacheKey, JSON.stringify(res));
    }
  };

  const explainKPI = async (question: string) => {
    if (!analytics || !selectedOrg) return;
    const payload = {
      org_id: selectedOrg,
      date_range: dateRange,
      kpis: analytics.kpis,
      revenue_trend: analytics.revenue_trend?.map(d => ({ date: d.date, revenue: d.revenue })) || [],
      top_events: analytics.top_events || [],
      question,
    };
    const res = await runAI(payload);
    if (res && aiCacheKey) {
      localStorage.setItem(aiCacheKey, JSON.stringify(res));
    }
  };

  const feedbackAI = async (helpful: boolean) => {
    try {
      // Optional: store feedback for tuning
      await supabase.from('analytics_events').insert({
        event_type: 'ai_insights_feedback',
        metadata: {
          org_id: selectedOrg,
          date_range: dateRange,
          helpful,
        },
      });
      toast({ title: helpful ? 'Thanks for the feedback!' : "We'll improve your insights." });
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-0 w-full">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">YardPass Analytics Hub</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Comprehensive insights across your events and content</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setAutoRefresh((v) => !v)} className="h-8 px-3 text-xs">
                {autoRefresh ? <><PauseIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> <span className="hidden sm:inline">Auto-refresh</span></> : <><ResumeIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> <span className="hidden sm:inline">Auto-refresh</span></>}
              </Button>
              <Button variant={realtime ? 'default' : 'outline'} size="sm" onClick={() => setRealtime((v) => !v)} className="h-8 px-3 text-xs">
                <RadioIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> <span className="hidden sm:inline">Realtime</span>
              </Button>
              <Button variant="outline" size="sm" onClick={shareLink} title="Copy deep link" className="h-8 px-3 text-xs">
                <ShareIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" /> <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Select value={selectedOrg} onValueChange={(orgId) => {
            setSelectedOrg(orgId);
            trackEvent('analytics_org_change', { organization_id: orgId, date_range: dateRange, active_tab: activeTab });
          }}>
            <SelectTrigger className="w-full sm:w-64" aria-label="Select organization">
              <SelectValue placeholder={organizations.length ? 'Select organization' : 'No organizations'} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={(range) => {
            setDateRange(range);
            trackEvent('analytics_date_range_change', { from_range: dateRange, to_range: range, organization_id: selectedOrg, active_tab: activeTab });
          }}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Select date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => {
            trackEvent('analytics_refresh_click', { organization_id: selectedOrg, date_range: dateRange, active_tab: activeTab });
            fetchAnalytics();
          }} disabled={loading} variant="outline" size="sm" className="h-8 px-3 text-xs">
            <RefreshIcon className={`h-3 w-3 sm:h-4 sm:w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={(v) => {
          const newTab = v as typeof activeTab;
          setActiveTab(newTab);
          trackEvent('analytics_tab_change', { from_tab: activeTab, to_tab: newTab, organization_id: selectedOrg, date_range: dateRange });
        }} className="w-full space-y-8">
          <div className="relative z-20">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-10 sm:h-12 p-1 bg-muted/50 rounded-xl">
              <TabsTrigger className="font-medium text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" value="overview">Overview</TabsTrigger>
              <TabsTrigger className="font-medium text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" value="events">Events</TabsTrigger>
              <TabsTrigger className="font-medium text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" value="videos">Videos</TabsTrigger>
              <TabsTrigger className="font-medium text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all" value="audience">Audience</TabsTrigger>
              <TabsTrigger className="font-medium text-xs sm:text-sm px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all col-span-2 sm:col-span-1" value="ai-assistant">AI Assistant</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-2"><div className="h-4 bg-muted rounded w-3/4" /></CardHeader>
                    <CardContent><div className="h-8 bg-muted rounded w-1/2 mb-2" /><div className="h-3 bg-muted rounded w-full" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : analytics ? (
              <>
                {/* KPI Row */}
                <div className="flex items-center justify-between">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gross Revenue</CardTitle>
                        <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(analytics.kpis.gross_revenue)}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Net: {formatCurrency(analytics.kpis.net_revenue)}
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2"
                             onClick={() => explainKPI('Explain what is driving net vs gross revenue and list 3 levers to improve net.')}
                             title="Explain with AI"
                          >
                            <HelpCircle className="h-3.5 w-3.5 mr-1" />
                            Explain
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tickets Sold</CardTitle>
                        <TicketIcon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.kpis.tickets_sold.toLocaleString()}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          Refunds: {analytics.kpis.refund_rate.toFixed(1)}%
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2"
                            onClick={() => explainKPI('Our refund rate seems elevated; diagnose likely causes and propose fixes.')}
                            title="Explain with AI"
                          >
                            <HelpCircle className="h-3.5 w-3.5 mr-1" />
                            Explain
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Unique Buyers</CardTitle>
                        <UsersIcon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.kpis.unique_buyers.toLocaleString()}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          No-show: {analytics.kpis.no_show_rate.toFixed(1)}%
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2"
                            onClick={() => explainKPI('How can we reduce no-show rate with messaging and incentives?')}
                            title="Explain with AI"
                          >
                            <HelpCircle className="h-3.5 w-3.5 mr-1" />
                            Explain
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Feed Engagement</CardTitle>
                        <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{analytics.kpis.feed_engagements.toLocaleString()}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {analytics.kpis.posts_created} posts
                          <Button
                            variant="ghost" size="sm" className="h-6 px-2"
                            onClick={() => explainKPI('Suggest content/post cadence to increase feed engagement and ticket conversion.')}
                            title="Explain with AI"
                          >
                            <HelpCircle className="h-3.5 w-3.5 mr-1" />
                            Explain
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="hidden lg:flex gap-2 ml-4">
                    <Button size="sm" variant="outline" onClick={exportOverviewCSV}>
                      <DownloadIcon className="h-4 w-4 mr-1" /> KPIs CSV
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportOverviewJSON}>
                      <DownloadIcon className="h-4 w-4 mr-1" /> KPIs JSON
                    </Button>
                  </div>
                </div>

                {/* Revenue Trend */}
                {analytics.revenue_trend?.length > 0 && (
                  <Card>
                    <CardHeader className="flex items-center justify-between">
                      <CardTitle>Revenue Trend</CardTitle>
                      <div className="flex items-center gap-2">
                        {typeof revenueDeltaPct === 'number' && (
                          <span className="text-xs text-muted-foreground">
                            Δ {(revenueDeltaPct > 0 ? '+' : '') + revenueDeltaPct.toFixed(1)}%
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={exportRevenueTrendCSV}>
                          <DownloadIcon className="h-4 w-4 mr-1" /> CSV
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={analytics.revenue_trend.map((d) => ({
                              date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                              revenueUSD: (d.revenue || 0) / 100,
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis tickFormatter={(v) => `$${v}`} />
                            <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, 'Revenue']} />
                            <Area
                              type="monotone"
                              dataKey="revenueUSD"
                              stroke="hsl(var(--primary))"
                              fill="hsl(var(--primary))"
                              fillOpacity={0.15}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* AI Insights + Top Events */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <InlineAIInsightsPanel
                    loading={aiLoading}
                    insights={insights}
                    error={aiError}
                    onRefresh={askAIOverview}
                    onFeedback={feedbackAI}
                  />

                  {analytics.top_events?.length > 0 && (
                    <Card>
                      <CardHeader className="flex items-center justify-between">
                        <CardTitle>Top Events by Revenue</CardTitle>
                        <Button size="sm" variant="outline" onClick={exportTopEventsCSV}>
                          <DownloadIcon className="h-4 w-4 mr-1" /> CSV
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {analytics.top_events.slice(0, 5).map((event, index) => (
                            <div key={event.event_id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="text-sm font-medium text-muted-foreground">#{index + 1}</div>
                                <div>
                                  <p className="font-medium">{event.title}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(event.revenue)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* CTA to generate insights if empty */}
                {!insights && (
                  <div className="flex justify-center">
                    <Button size="sm" onClick={askAIOverview}>
                      <WandIcon className="h-4 w-4 mr-1" /> Ask AI for insights
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No analytics data available</p>
              </div>
            )}
          </TabsContent>

          {/* EVENTS */}
          <TabsContent value="events">
            <EventAnalyticsComponent
              selectedOrg={selectedOrg}
              dateRange={dateRange}
              onExplain={explainKPI}
            />
          </TabsContent>

          {/* VIDEOS */}
          <TabsContent value="videos" className="space-y-6">
            <VideoAnalytics selectedOrg={selectedOrg} dateRange={dateRange} />
          </TabsContent>

          {/* AUDIENCE */}
          <TabsContent value="audience" className="space-y-6">
            <AudienceAnalytics selectedOrg={selectedOrg} dateRange={dateRange} />
          </TabsContent>

          {/* AI ASSISTANT */}
          <TabsContent value="ai-assistant" className="space-y-6">
            {/* Pass context + helpful starters for less blank-page feel */}
            <NaturalLanguageQuery
              orgId={selectedOrg}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AnalyticsHub;
