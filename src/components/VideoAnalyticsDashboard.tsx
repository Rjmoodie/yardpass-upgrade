import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Eye, Play, MousePointer, Heart, MessageCircle, Share2, TrendingUp } from 'lucide-react';
import { useEventAnalytics, useTopPostsAnalytics } from '@/hooks/useEventAnalytics';
import { formatDistanceToNow } from 'date-fns';

interface VideoAnalyticsDashboardProps {
  eventId: string;
  eventTitle: string;
}

export function VideoAnalyticsDashboard({ eventId, eventTitle }: VideoAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const { analytics, loading: analyticsLoading, refetch: refetchAnalytics } = useEventAnalytics(eventId);
  const { topPosts, loading: postsLoading, refetch: refetchTopPosts } = useTopPostsAnalytics(eventId);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatCTR = (clicks: number, views: number) => {
    if (views === 0) return '0%';
    return `${((clicks / views) * 100).toFixed(1)}%`;
  };

  if (analyticsLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-64 mb-4" />
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
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-8">
        <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-muted-foreground">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Content & Video Analytics</h2>
          <p className="text-muted-foreground">{eventTitle}</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => {
            refetchAnalytics();
            refetchTopPosts();
          }}
        >
          Refresh Data
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-500" />
              <p className="text-sm font-medium text-muted-foreground">Unique Views</p>
            </div>
            <p className="text-2xl font-bold">{analytics.counters.views_unique.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {analytics.counters.views_total.toLocaleString()} total views
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-green-500" />
              <p className="text-sm font-medium text-muted-foreground">Completions</p>
            </div>
            <p className="text-2xl font-bold">{analytics.counters.completions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {formatCTR(analytics.counters.completions, analytics.counters.views_total)} completion rate
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
              {formatCTR(analytics.counters.clicks_tickets, analytics.counters.views_unique)}
            </p>
            <p className="text-xs text-muted-foreground">
              {analytics.counters.clicks_tickets.toLocaleString()} ticket clicks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-red-500" />
              <p className="text-sm font-medium text-muted-foreground">Engagement</p>
            </div>
            <p className="text-2xl font-bold">
              {(analytics.counters.likes + analytics.counters.comments + analytics.counters.shares).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {analytics.counters.likes} likes • {analytics.counters.comments} comments • {analytics.counters.shares} shares
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
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
                    <span className="text-sm font-medium">
                      {formatDuration(analytics.counters.avg_dwell_ms)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total qualified views</span>
                    <span className="text-sm font-medium">
                      {analytics.counters.views_total.toLocaleString()}
                    </span>
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
                    <span className="text-sm font-medium">{analytics.counters.clicks_tickets}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Share clicks</span>
                    <span className="text-sm font-medium">{analytics.counters.clicks_share}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Comment clicks</span>
                    <span className="text-sm font-medium">{analytics.counters.clicks_comment}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Performing Posts</CardTitle>
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
                  {topPosts.posts.map((post) => (
                    <div key={post.post_id} className="flex gap-4 p-4 border rounded-lg">
                      {post.media_urls.length > 0 && (
                        <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                          {post.media_urls[0].startsWith('mux:') ? (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <Play className="w-6 h-6" />
                            </div>
                          ) : (
                            <img 
                              src={post.media_urls[0]} 
                              alt="Post thumbnail" 
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium truncate">
                              {post.title || 'Post content'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <Badge variant="secondary">
                              {post.views_unique} views
                            </Badge>
                            <Badge variant="secondary">
                              {formatCTR(post.clicks_tickets, post.views_unique)} CTR
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{post.views_total} total views</span>
                          <span>{post.completions} completions</span>
                          <span>{post.clicks_tickets} ticket clicks</span>
                          <span>{post.engagement_total} engagement</span>
                        </div>
                      </div>
                    </div>
                  ))}
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
                    <span>{formatDuration(analytics.counters.avg_dwell_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completion rate</span>
                    <span>{formatCTR(analytics.counters.completions, analytics.counters.views_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unique vs total</span>
                    <span>{formatCTR(analytics.counters.views_unique, analytics.counters.views_total)}</span>
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
                    <span>{formatCTR(analytics.counters.clicks_tickets, analytics.counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares</span>
                    <span>{formatCTR(analytics.counters.clicks_share, analytics.counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comments</span>
                    <span>{formatCTR(analytics.counters.clicks_comment, analytics.counters.views_unique)}</span>
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
                    <span>{formatCTR(analytics.counters.likes, analytics.counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Comments per view</span>
                    <span>{formatCTR(analytics.counters.comments, analytics.counters.views_unique)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares per view</span>
                    <span>{formatCTR(analytics.counters.shares, analytics.counters.views_unique)}</span>
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