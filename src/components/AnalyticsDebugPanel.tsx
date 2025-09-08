import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Bug, Database, Activity, Users } from 'lucide-react';

interface AnalyticsEvent {
  id: string;
  event_type: string;
  event_id?: string;
  user_id?: string;
  metadata?: any; // Using any to handle Json type from Supabase
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

/**
 * Debug panel for monitoring analytics events and system health
 * Only shown to organizers/admins for debugging purposes
 */
export const AnalyticsDebugPanel: React.FC = () => {
  const { user } = useAuth();
  const [recentEvents, setRecentEvents] = useState<AnalyticsEvent[]>([]);
  const [videoEvents, setVideoEvents] = useState<VideoEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentAnalytics = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch recent analytics events
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (analyticsError) throw analyticsError;

      // Fetch recent video events
      const { data: videoData, error: videoError } = await supabase
        .from('post_views')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (videoError) throw videoError;

      setRecentEvents(analyticsData || []);
      setVideoEvents(videoData || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Analytics debug fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentAnalytics();
  }, [user]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchRecentAnalytics, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bug className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Analytics Debug Panel</h2>
        </div>
        <Button onClick={fetchRecentAnalytics} disabled={loading} size="sm">
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">Error: {error}</p>
          </CardContent>
        </Card>
      )}

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

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Analytics Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent events</p>
                ) : (
                  recentEvents.map((event) => (
                    <div key={event.id} className="border-l-2 border-primary pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{event.event_type}</Badge>
                          {event.event_id && (
                            <span className="text-xs text-muted-foreground">
                              Event: {event.event_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <pre className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video">
          <Card>
            <CardHeader>
              <CardTitle>Recent Video Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {videoEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No recent video events</p>
                ) : (
                  videoEvents.map((event) => (
                    <div key={event.id} className="border-l-2 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={event.qualified ? 'default' : 'secondary'}>
                            {event.qualified ? 'Qualified' : 'Unqualified'} View
                          </Badge>
                          {event.completed && <Badge variant="default">Completed</Badge>}
                          <span className="text-xs text-muted-foreground">
                            Post: {event.post_id.slice(0, 8)}...
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Session: {event.session_id.slice(0, 12)}...
                        {event.user_id && ` | User: ${event.user_id.slice(0, 8)}...`}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Analytics Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recentEvents.length}</div>
                <p className="text-xs text-muted-foreground">Last 20 events</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Video Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{videoEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  {videoEvents.filter(e => e.qualified).length} qualified
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Completions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {videoEvents.filter(e => e.completed).length}
                </div>
                <p className="text-xs text-muted-foreground">Video completions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};