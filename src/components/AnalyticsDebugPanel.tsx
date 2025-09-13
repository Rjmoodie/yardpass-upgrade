import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Bug,
  Database,
  Activity,
  Users,
  RefreshCw,
  Pause,
  Play,
  Download,
  Filter,
  Search,
  Clipboard as ClipboardIcon,
} from 'lucide-react';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_id?: string;
  user_id?: string;
  metadata?: any; // Supabase JSON
  created_at: string;
}

interface VideoEvent {
  id: string;
  post_id: string;
  event_id: string;
  user_id?: string;
  session_id: string;
  qualified: boolean;
  completed: boolean;
  created_at: string;
}

/** Small helper: copy text to clipboard with fallback */
function copy(text: string) {
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

/** Collapsible JSON preview to keep UI tidy */
const JSONPreview: React.FC<{ data: any }> = ({ data }) => {
  const [open, setOpen] = useState(false);
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) return null;
  return (
    <div className="mt-2">
      <button
        className="text-xs underline text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? 'Hide metadata' : 'Show metadata'}
      </button>
      {open && (
        <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded overflow-x-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
};

/** Export helpers */
function downloadFile(filename: string, content: string, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCSV<T extends Record<string, any>>(rows: T[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    // Escape quotes
    const q = s.replace(/"/g, '""');
    return `"${q}"`;
  };
  const head = headers.map(escape).join(',');
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(',')).join('\n');
  return [head, body].join('\n');
}

/**
 * Debug panel for monitoring analytics events and system health
 * Only shown to organizers/admins for debugging purposes
 */
export const AnalyticsDebugPanel: React.FC = () => {
  const { user } = useAuth();

  // Data
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [videoEvents, setVideoEvents] = useState<VideoEvent[]>([]);

  // UI/Network state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & controls
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '24h' | '7d' | 'all'>('1h');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [eventIdFilter, setEventIdFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [onlyQualified, setOnlyQualified] = useState(false);
  const [onlyCompleted, setOnlyCompleted] = useState(false);
  const [limit, setLimit] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Compute since datetime for server filtering
  const sinceISO = useMemo(() => {
    if (timeRange === 'all') return undefined;
    const now = new Date();
    const d = new Date(now);
    if (timeRange === '15m') d.setMinutes(d.getMinutes() - 15);
    if (timeRange === '1h') d.setHours(d.getHours() - 1);
    if (timeRange === '24h') d.setDate(d.getDate() - 1);
    if (timeRange === '7d') d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, [timeRange]);

  const fetchRecentAnalytics = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      // --- analytics_events ---
      let ae = supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sinceISO) ae = ae.gte('created_at', sinceISO);
      if (eventTypeFilter.trim()) ae = ae.ilike('event_type', `%${eventTypeFilter.trim()}%`);
      if (eventIdFilter.trim()) ae = ae.ilike('event_id', `%${eventIdFilter.trim()}%`);
      if (userIdFilter.trim()) ae = ae.ilike('user_id', `%${userIdFilter.trim()}%`);

      const [{ data: analyticsData, error: analyticsError }] = await Promise.all([ae]);

      if (analyticsError) throw analyticsError;

      // --- post_views (video events) ---
      let pv = supabase
        .from('post_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (sinceISO) pv = pv.gte('created_at', sinceISO);
      if (eventIdFilter.trim()) pv = pv.ilike('event_id', `%${eventIdFilter.trim()}%`);
      if (userIdFilter.trim()) pv = pv.ilike('user_id', `%${userIdFilter.trim()}%`);
      if (onlyQualified) pv = pv.eq('qualified', true);
      if (onlyCompleted) pv = pv.eq('completed', true);

      const { data: videoData, error: videoError } = await pv;
      if (videoError) throw videoError;

      setRecentEvents(analyticsData || []);
      setVideoEvents(videoData || []);
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
      console.error('Analytics debug fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [
    user,
    sinceISO,
    eventTypeFilter,
    eventIdFilter,
    userIdFilter,
    onlyQualified,
    onlyCompleted,
    limit,
  ]);

  // Initial + whenever filters change
  useEffect(() => {
    fetchRecentAnalytics();
  }, [fetchRecentAnalytics]);

  // Auto-refresh every 30s (toggleable)
  useEffect(() => {
    if (!autoRefresh) return;
    const i = setInterval(fetchRecentAnalytics, 30000);
    return () => clearInterval(i);
  }, [autoRefresh, fetchRecentAnalytics]);

  // Realtime subscriptions (insert/update/delete)
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('analytics_debug_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'analytics_events' },
        () => fetchRecentAnalytics()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_views' },
        () => fetchRecentAnalytics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchRecentAnalytics]);

  if (!user) return null;

  // -------- Summary calculations --------
  const perTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of recentEvents) {
      map.set(e.event_type, (map.get(e.event_type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [recentEvents]);

  const uniqueUsers = useMemo(() => {
    const s = new Set(recentEvents.map((e) => e.user_id).filter(Boolean) as string[]);
    return s.size;
  }, [recentEvents]);

  const qualifiedCount = videoEvents.filter((e) => e.qualified).length;
  const completedCount = videoEvents.filter((e) => e.completed).length;
  const qualifiedRate = videoEvents.length ? Math.round((qualifiedCount / videoEvents.length) * 100) : 0;
  const completedRate = videoEvents.length ? Math.round((completedCount / videoEvents.length) * 100) : 0;

  // -------- Export handlers --------
  const exportEventsJSON = () =>
    downloadFile(
      `analytics_events_${new Date().toISOString()}.json`,
      JSON.stringify(recentEvents, null, 2),
      'application/json'
    );

  const exportEventsCSV = () => downloadFile(
    `analytics_events_${new Date().toISOString()}.csv`,
    toCSV(recentEvents as any),
    'text/csv'
  );

  const exportVideoJSON = () =>
    downloadFile(
      `video_events_${new Date().toISOString()}.json`,
      JSON.stringify(videoEvents, null, 2),
      'application/json'
    );

  const exportVideoCSV = () => downloadFile(
    `video_events_${new Date().toISOString()}.csv`,
    toCSV(videoEvents as any),
    'text/csv'
  );

  // -------- UI --------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Analytics Debug Panel</h2>
          <Badge variant="outline" className="ml-2">Live</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh((v) => !v)}>
            {autoRefresh ? <><Pause className="w-4 h-4 mr-1" /> Pause</> : <><Play className="w-4 h-4 mr-1" /> Resume</>}
          </Button>
          <Button onClick={fetchRecentAnalytics} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters & Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="flex flex-col">
            <label className="text-xs mb-1">Time Range</label>
            <div className="flex flex-wrap gap-1">
              {(['15m', '1h', '24h', '7d', 'all'] as const).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={timeRange === r ? 'default' : 'outline'}
                  onClick={() => setTimeRange(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1 flex items-center gap-1"><Search className="w-3 h-3" /> Event Type</label>
            <input
              className="w-full px-3 py-2 rounded border bg-background"
              placeholder="e.g. view, like, click"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">Event ID contains</label>
            <input
              className="w-full px-3 py-2 rounded border bg-background"
              placeholder="UUID or partial"
              value={eventIdFilter}
              onChange={(e) => setEventIdFilter(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">User ID contains</label>
            <input
              className="w-full px-3 py-2 rounded border bg-background"
              placeholder="UUID or partial"
              value={userIdFilter}
              onChange={(e) => setUserIdFilter(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">Rows</label>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setLimit((n) => Math.max(20, n - 20))} disabled={limit <= 20}>-20</Button>
              <div className="text-sm self-center w-12 text-center">{limit}</div>
              <Button size="sm" variant="outline" onClick={() => setLimit((n) => n + 20)}>+20</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Analytics Events
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            Video Events
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Summary
          </TabsTrigger>
        </TabsList>

        {/* Analytics Events */}
        <TabsContent value="events">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Analytics Events</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={exportEventsCSV}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={exportEventsJSON}>
                  <Download className="w-4 h-4 mr-1" /> JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent events</p>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="border-l-2 border-primary pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary">{event.event_type}</Badge>
                          {event.event_id && (
                            <button
                              className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                              title="Copy event_id"
                              onClick={() => copy(event.event_id!)}
                            >
                              <ClipboardIcon className="w-3 h-3" />
                              Event: {event.event_id.slice(0, 8)}…
                            </button>
                          )}
                          {event.user_id && (
                            <button
                              className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                              title="Copy user_id"
                              onClick={() => copy(event.user_id!)}
                            >
                              <ClipboardIcon className="w-3 h-3" />
                              User: {event.user_id.slice(0, 8)}…
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <JSONPreview data={event.metadata} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video Events */}
        <TabsContent value="video">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Video Events</CardTitle>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={onlyQualified}
                      onChange={(e) => setOnlyQualified(e.target.checked)}
                    />
                    Only qualified
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={onlyCompleted}
                      onChange={(e) => setOnlyCompleted(e.target.checked)}
                    />
                    Only completed
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={exportVideoCSV}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={exportVideoJSON}>
                  <Download className="w-4 h-4 mr-1" /> JSON
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {videoEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent video events</p>
                ) : (
                  videoEvents.map((event) => (
                    <div key={event.id} className="border-l-2 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={event.qualified ? 'default' : 'secondary'}>
                            {event.qualified ? 'Qualified' : 'Unqualified'}
                          </Badge>
                          {event.completed && <Badge variant="default">Completed</Badge>}
                          <button
                            className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                            title="Copy post_id"
                            onClick={() => copy(event.post_id)}
                          >
                            <ClipboardIcon className="w-3 h-3" />
                            Post: {event.post_id.slice(0, 8)}…
                          </button>
                          <button
                            className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                            title="Copy event_id"
                            onClick={() => copy(event.event_id)}
                          >
                            <ClipboardIcon className="w-3 h-3" />
                            Event: {event.event_id.slice(0, 8)}…
                          </button>
                          {event.user_id && (
                            <button
                              className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                              title="Copy user_id"
                              onClick={() => copy(event.user_id!)}
                            >
                              <ClipboardIcon className="w-3 h-3" />
                              User: {event.user_id.slice(0, 8)}…
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Session: {event.session_id.slice(0, 12)}…
                        <button
                          className="ml-2 text-xs underline"
                          title="Copy session_id"
                          onClick={() => copy(event.session_id)}
                        >
                          copy
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary */}
        <TabsContent value="summary">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Analytics Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recentEvents.length}</div>
                <p className="text-xs text-muted-foreground">Last {limit} (filtered)</p>
                <div className="mt-3">
                  <div className="text-xs font-medium mb-1">Top types</div>
                  {perTypeCounts.slice(0, 5).map(({ type, count }) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[60%]">{type}</span>
                      <span className="text-muted-foreground">{count}</span>
                    </div>
                  ))}
                  {!perTypeCounts.length && (
                    <div className="text-xs text-muted-foreground">No types found.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Unique Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{uniqueUsers}</div>
                <p className="text-xs text-muted-foreground">From analytics events</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Video Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{qualifiedRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Qualified ({qualifiedCount}/{videoEvents.length})
                </p>
                <div className="mt-3 text-2xl font-bold">{completedRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Completed ({completedCount}/{videoEvents.length})
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};