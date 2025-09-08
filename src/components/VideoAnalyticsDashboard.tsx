import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Play,
  MousePointer,
  Heart,
  MessageCircle,
  Share2,
  TrendingUp,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useEventAnalytics, useTopPostsAnalytics } from '@/hooks/useEventAnalytics';
import { formatDistanceToNow } from 'date-fns';

interface VideoAnalyticsDashboardProps {
  eventId: string;
  eventTitle: string;
}

type DateRangeKey = '7d' | '30d' | '90d';

const keyFor = (eventId: string, k: string) => `video-analytics:${eventId}:${k}`;

const getRange = (k: DateRangeKey) => {
  const now = new Date();
  const days = k === '7d' ? 7 : k === '90d' ? 90 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();
  return { from, to };
};

const safe = (n: any) => (Number.isFinite(n) ? Number(n) : 0);

export function VideoAnalyticsDashboard({ eventId, eventTitle }: VideoAnalyticsDashboardProps) {
  const persisted = (localStorage.getItem(keyFor(eventId, 'range')) as DateRangeKey) || '30d';
  const [rangeKey, setRangeKey] = useState<DateRangeKey>(persisted);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'performance'>('overview');
  const { analytics, loading: analyticsLoading, refetch: refetchAnalytics } = useEventAnalytics(eventId);
  const { topPosts, loading: postsLoading, refetch: refetchTopPosts } = useTopPostsAnalytics(eventId);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const reqRef = useRef(0);

  const counters = analytics?.counters || {
    views_unique: 0,
    views_total: 0,
    completions: 0,
    avg_dwell_ms: 0,
    clicks_tickets: 0,
    clicks_share: 0,
    clicks_comment: 0,
    likes: 0,
    comments: 0,
    shares: 0,
  };

  const totalEngagement = useMemo(
    () => safe(counters.likes) + safe(counters.comments) + safe(counters.shares),
    [counters]
  );

  const formatDuration = (ms: number) => {
    const seconds = Math.max(0, Math.floor(safe(ms) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCTR = (num: number, denom: number) => {
    const d = safe(denom);
    if (d <= 0) return '0%';
    return `${((safe(num) / d) * 100).toFixed(1)}%`;
  };

  const doRefresh = async () => {
    // Try parameterized refetch first, fall back to plain refetch
    const { from, to } = getRange(rangeKey);
    reqRef.current += 1;
    const myReq = reqRef.current;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ((refetchAnalytics as any)?.({ from, to }) ?? refetchAnalytics());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ((refetchTopPosts as any)?.({ from, to }) ?? refetchTopPosts());
      if (myReq === reqRef.current) setLastUpdated(Date.now());
    } catch {
      // no-op: hooks should surface their own errors if any
    }
  };

  // persist range + refresh on change
  useEffect(() => {
    localStorage.setItem(keyFor(eventId, 'range'), rangeKey);
    doRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey, eventId]);

  // initial stamp when analytics first appear
  useEffect(() => {
    if (analytics && !lastUpdated) setLastUpdated(Date.now());
  }, [analytics, lastUpdated]);

  const exportPostsCSV = () => {
    const rows = (topPosts?.posts || []).map((p) => [
      p.post_id,
      `"${(p.title || 'Post').replace(/"/g, '""')}"`,
      p.views_unique ?? 0,
      p.views_total ?? 0,
      p.completions ?? 0,
      p.clicks_tickets ?? 0,
      p.engagement_total ?? 0,
      (p.media_urls?.[0] || '').replace(/,/g, ' '),
      p.created_at,
    ]);
    const header = [
      'post_id',
      'title',
      'views_unique',
      'views_total',
      'completions',
      'clicks_tickets',
      'engagement_total',
      'first_media',
      'created_at',
    ];
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const fname = `${eventTitle.replace(/[^\w\s-]/g, '')}-top-posts.csv`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (analyticsLoading && !analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 bg-muted rounded w-64" />
          <div className="h-9 bg-muted rounded w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-20 mb-2" />
                <div className="h-8 bg-muted rounded w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Content &amp; Video Analytics</h2>
            <p className="text-muted-foreground">{eventTitle}</p>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as DateRangeKey[]).map((k) => (
              <Button
                key={k}
                size="sm"
                variant={rangeKey === k ? 'default' : 'outline'}
                onClick={() => setRangeKey(k)}
              >
                {k}
              </Button>
            ))}
          </div>
        </div>
        <div className="text-center py-10 text-muted-foreground">
          <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No analytics data available</p>
          <Button className="mt-4" variant="outline" onClick={doRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content &amp; Video Analytics</h2>
          <p className="text-muted-foreground">
            {eventTitle}
            {lastUpdated && (
              <span className="ml-2 text-xs">• Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as DateRangeKey[]).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={rangeKey === k ? 'default' : 'outline'}
              onClick={() => setRangeKey(k)}
            >
              {k}
            </Button>
          ))}
          <Button variant="outline" onClick={doRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium text-muted-foreground">Unique Views</p>
            </div>
            <p className="text-2xl font-bold">{safe(counters.views_unique).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {safe(counters.views_total).toLocaleString()} total views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-green-500" />
              <p className="text-sm font-medium text-muted-foreground">Completions</p>
            </div>
            <p className="text-2xl font-bold">{safe(counters.completions).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {formatCTR(counters.completions, counters.views_total)} completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-purple-500" />
              <p className="text-sm font-medium text-muted-foreground">Ticket CTR</p>
            </div>
            <p className="text-2xl font-bold">
              {formatCTR(counters.clicks_tickets, counters.views_unique)}
            </p>
            <p className="text-xs text-muted-foreground">
              {safe(counters.clicks_tickets).toLocaleString()} ticket clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <p className="text-sm font-medium text-muted-foreground">Engagement</p>
            </div>
            <p className="text-2xl font-bold">{totalEngagement.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {safe(counters.likes)} likes • {safe(counters.comments)} comments • {safe(counters.shares)} shares
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="content">Top Content</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Watch Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Average watch time</span>
                    <span className="text-sm font-medium">{formatDuration(counters.avg_dwell_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total qualified views</span>
                    <span className="text-sm font-medium">{safe(counters.views_total).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Click Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Ticket clicks</span>
                    <span className="text-sm font-medium">{safe(counters.clicks_tickets).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Share clicks</span>
                    <span className="text-sm font-medium">{safe(counters.clicks_share).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Comment clicks</span>
                    <span className="text-sm font-medium">{safe(counters.clicks_comment).toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-lg">Top Performing Posts</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPostsCSV} disabled={!topPosts?.posts?.length}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={doRefresh}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex gap-4">
                      <div className="w-16 h-16 bg-muted rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : topPosts?.posts?.length ? (
                <div className="space-y-4">
                  {topPosts.posts.map((post) => {
                    const thumb = post.media_urls?.[0];
                    const isVideo = !!thumb && thumb.startsWith('mux:');
                    return (
                      <div key={post.post_id} className="flex gap-4 p-4 border rounded-lg">
                        {thumb && (
                          <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                            {isVideo ? (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <Play className="w-6 h-6" />
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={thumb} alt="Post thumbnail" className="w-full h-full object-cover" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium truncate">{post.title || 'Post content'}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                              </p>
                            </div>
                            <div className="flex gap-2 text-xs">
                              <Badge variant="secondary">{safe(post.views_unique).toLocaleString()} views</Badge>
                              <Badge variant="secondary">
                                {formatCTR(safe(post.clicks_tickets), safe(post.views_unique))} CTR
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{safe(post.views_total).toLocaleString()} total views</span>
                            <span>{safe(post.completions).toLocaleString()} completions</span>
                            <span>{safe(post.clicks_tickets).toLocaleString()} ticket clicks</span>
                            <span>{safe(post.engagement_total).toLocaleString()} engagement</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No content data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Video Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg. watch time</span>
                    <span>{formatDuration(counters.avg_dwell_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion rate</span>
                    <span>{formatCTR(counters.completions, counters.views_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unique vs total</span>
                    <span>{formatCTR(counters.views_unique, counters.views_total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Click Through Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tickets</span>
                    <span>{formatCTR(counters.clicks_tickets, counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares</span>
                    <span>{formatCTR(counters.clicks_share, counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comments</span>
                    <span>{formatCTR(counters.clicks_comment, counters.views_unique)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Engagement Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Likes per view</span>
                    <span>{formatCTR(counters.likes, counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comments per view</span>
                    <span>{formatCTR(counters.comments, counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares per view</span>
                    <span>{formatCTR(counters.shares, counters.views_unique)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}