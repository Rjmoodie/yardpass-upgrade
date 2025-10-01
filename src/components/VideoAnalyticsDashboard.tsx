import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye,
  Play,
  Clock,
  TrendingUp,
  RefreshCw,
  Download,
  FileJson,
  AlertCircle,
  BarChart,
} from 'lucide-react';
import { useMuxAnalytics } from '@/hooks/useMuxAnalytics';

interface VideoAnalyticsDashboardProps {
  eventId: string;
  eventTitle: string;
}

type DateRangeKey = '7d' | '30d' | '90d';

const getRange = (k: DateRangeKey) => {
  const now = new Date();
  const days = k === '7d' ? 7 : k === '90d' ? 90 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();
  return { from, to };
};

const formatDuration = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const safeFileName = (s: string) =>
  (s || 'export')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

export function VideoAnalyticsDashboard({ eventId, eventTitle }: VideoAnalyticsDashboardProps) {
  const [rangeKey, setRangeKey] = useState<DateRangeKey>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'videos' | 'performance'>('overview');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { from, to } = getRange(rangeKey);
  const { metrics, loading, error, refetch } = useMuxAnalytics(eventId, from, to);

  const doRefresh = () => {
    refetch();
    setLastUpdated(new Date());
  };

  useEffect(() => {
    doRefresh();
  }, [rangeKey]);

  const exportVideosCSV = () => {
    if (!metrics?.videos || metrics.videos.length === 0) return;
    const rows = [
      ['Asset ID', 'Plays', 'Unique Viewers', 'Avg Watch Time (s)', 'Completion Rate %'],
      ...metrics.videos.map(v => [
        v.asset_id,
        v.plays.toString(),
        v.unique_viewers.toString(),
        Math.round(v.avg_watch_time / 1000).toString(),
        (v.completion_rate * 100).toFixed(1)
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(eventTitle)}-videos-${rangeKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportOverviewCSV = () => {
    if (!metrics) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Plays', metrics.total_plays.toString()],
      ['Unique Viewers', metrics.unique_viewers.toString()],
      ['Avg Watch Time (s)', Math.round(metrics.avg_watch_time / 1000).toString()],
      ['Completion Rate', (metrics.completion_rate * 100).toFixed(1) + '%']
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(eventTitle)}-overview-${rangeKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = { metrics, range: rangeKey, exported: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeFileName(eventTitle)}-analytics-${rangeKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <h3 className="font-semibold text-lg">No video analytics available</h3>
            <p className="text-sm text-muted-foreground mt-1">{error || 'Unable to load Mux analytics'}</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Video Analytics</h2>
          <p className="text-muted-foreground">
            {eventTitle}
            {lastUpdated && (
              <span className="ml-2 text-xs">• Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
          <Button variant="outline" size="sm" onClick={doRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportOverviewCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportJSON}>
            <FileJson className="w-4 h-4 mr-2" />
            JSON
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Plays</p>
              <h3 className="text-2xl font-bold mt-1">{metrics.total_plays.toLocaleString()}</h3>
            </div>
            <Play className="w-8 h-8 text-primary opacity-70" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unique Viewers</p>
              <h3 className="text-2xl font-bold mt-1">{metrics.unique_viewers.toLocaleString()}</h3>
            </div>
            <Eye className="w-8 h-8 text-green-500 opacity-70" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Watch Time</p>
              <h3 className="text-2xl font-bold mt-1">{formatDuration(metrics.avg_watch_time)}</h3>
            </div>
            <Clock className="w-8 h-8 text-blue-500 opacity-70" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completion Rate</p>
              <h3 className="text-2xl font-bold mt-1">{(metrics.completion_rate * 100).toFixed(1)}%</h3>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500 opacity-70" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Play className="w-5 h-5" />
                Playback Metrics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Plays</span>
                  <span className="font-medium">{metrics.total_plays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unique Viewers</span>
                  <span className="font-medium">{metrics.unique_viewers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Watch Time</span>
                  <span className="font-medium">{formatDuration(metrics.avg_watch_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-medium">{(metrics.completion_rate * 100).toFixed(1)}%</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart className="w-5 h-5" />
                Video Performance
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Videos</span>
                  <span className="font-medium">{metrics.videos.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plays per Video</span>
                  <span className="font-medium">
                    {metrics.videos.length > 0 ? Math.round(metrics.total_plays / metrics.videos.length) : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Viewers per Video</span>
                  <span className="font-medium">
                    {metrics.videos.length > 0 ? Math.round(metrics.unique_viewers / metrics.videos.length) : 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="videos" className="mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Video Performance by Asset</h3>
              <Button variant="outline" size="sm" onClick={exportVideosCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            <div className="space-y-4">
              {metrics.videos && metrics.videos.length > 0 ? (
                metrics.videos.map((video, idx) => (
                  <div key={video.asset_id} className="flex items-start gap-4 p-4 rounded-lg border">
                    <div className="flex-shrink-0 w-12 h-12 rounded bg-primary/10 flex items-center justify-center font-bold text-primary">
                      #{idx + 1}
                    </div>
                    <img
                      src={`https://image.mux.com/${video.asset_id}/thumbnail.jpg?width=160&fit_mode=crop&time=0`}
                      alt=""
                      className="w-20 h-20 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium font-mono text-sm truncate">{video.asset_id}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Plays:</span>
                          <span className="ml-1 font-medium">{video.plays.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Viewers:</span>
                          <span className="ml-1 font-medium">{video.unique_viewers.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Watch Time:</span>
                          <span className="ml-1 font-medium">{formatDuration(video.avg_watch_time)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Completion:</span>
                          <span className="ml-1 font-medium">{(video.completion_rate * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No video data available for this period
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Engagement Metrics</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Play Rate</span>
                  <span className="font-medium">
                    {metrics.videos.length > 0
                      ? (metrics.total_plays / metrics.videos.length).toFixed(1)
                      : '0'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-medium">{(metrics.completion_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Watch Time</span>
                  <span className="font-medium">{formatDuration(metrics.avg_watch_time)}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold mb-4">Audience Reach</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Unique Viewers</span>
                  <span className="font-medium">{metrics.unique_viewers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Plays</span>
                  <span className="font-medium">{metrics.total_plays.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Replays</span>
                  <span className="font-medium">
                    {(metrics.total_plays - metrics.unique_viewers).toLocaleString()}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
