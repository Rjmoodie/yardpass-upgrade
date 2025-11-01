// Sponsorship AI Dashboard - Complete view of AI matching system
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { SponsorRecommendations } from "@/components/sponsorship/SponsorRecommendations";
import { EventSponsorMatches } from "@/components/sponsorship/EventSponsorMatches";
import { LiveMatchCalculator } from "@/components/sponsorship/LiveMatchCalculator";
import { getQueueStatus, processMatchQueue, refreshSponsorshipMVs } from "@/lib/sponsorship";
import { 
  Sparkles, 
  RefreshCw, 
  Database, 
  TrendingUp,
  Building2,
  Calendar,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function SponsorshipAIDashboard() {
  const [user, setUser] = useState<any>(null);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<{ pendingCount: number } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      // Fetch user's sponsors
      const { data: sponsorsData } = await supabase
        .from("sponsors")
        .select("*")
        .limit(10);
      setSponsors(sponsorsData || []);

      // Fetch user's events
      const { data: eventsData } = await supabase
        .from("events")
        .select("id, title, start_at, category")
        .order("start_at", { ascending: false })
        .limit(10);
      setEvents(eventsData || []);

      // Get queue status
      refreshQueueStatus();
    }

    init();
  }, []);

  async function refreshQueueStatus() {
    try {
      const status = await getQueueStatus();
      setQueueStatus(status);
    } catch (err) {
      console.error("Failed to get queue status:", err);
    }
  }

  async function handleProcessQueue() {
    setProcessing(true);
    
    try {
      const processed = await processMatchQueue(50);
      toast.success(`Processed ${processed} match calculations`);
      await refreshQueueStatus();
    } catch (err) {
      console.error("Failed to process queue:", err);
      toast.error("Failed to process queue");
    } finally {
      setProcessing(false);
    }
  }

  async function handleRefreshMVs() {
    setRefreshing(true);
    
    try {
      await refreshSponsorshipMVs(false);
      toast.success("Materialized views refreshed");
    } catch (err) {
      console.error("Failed to refresh MVs:", err);
      toast.error("Failed to refresh views");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="h-8 w-8 text-brand-600" />
          <h1 className="text-4xl font-bold">AI-Powered Sponsorship Matching</h1>
        </div>
        <p className="text-neutral-600">
          Intelligent sponsor-event matching powered by machine learning
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Queue Status</p>
                <p className="text-2xl font-bold">
                  {queueStatus?.pendingCount ?? '...'}
                </p>
                <p className="text-xs text-neutral-500">Pending calculations</p>
              </div>
              <Database className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Sponsors</p>
                <p className="text-2xl font-bold">{sponsors.length}</p>
                <p className="text-xs text-neutral-500">With profiles</p>
              </div>
              <Building2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Events</p>
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-xs text-neutral-500">Available</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Actions */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>System Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button 
              onClick={handleProcessQueue}
              disabled={processing}
              variant="outline"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Process Queue ({queueStatus?.pendingCount || 0})
                </>
              )}
            </Button>

            <Button 
              onClick={handleRefreshMVs}
              disabled={refreshing}
              variant="outline"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Refresh Views
                </>
              )}
            </Button>

            <Button 
              onClick={() => navigate('/sponsorships/marketplace')}
              variant="default"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              View Marketplace
            </Button>
          </div>

          <div className="mt-4 text-xs text-neutral-500">
            💡 Queue processes automatically every 10 minutes via cron job
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="sponsors" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sponsors">
            <Building2 className="h-4 w-4 mr-2" />
            For Sponsors
          </TabsTrigger>
          <TabsTrigger value="organizers">
            <Calendar className="h-4 w-4 mr-2" />
            For Organizers
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Sparkles className="h-4 w-4 mr-2" />
            Live Calculator
          </TabsTrigger>
        </TabsList>

        {/* Sponsor View */}
        <TabsContent value="sponsors" className="space-y-4">
          {sponsors.length > 0 ? (
            sponsors.map((sponsor) => (
              <div key={sponsor.id}>
                <h3 className="text-lg font-semibold mb-4">{sponsor.name}</h3>
                <SponsorRecommendations sponsorId={sponsor.id} limit={5} />
              </div>
            ))
          ) : (
            <Card variant="outlined">
              <CardContent className="text-center py-12">
                <Building2 className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                <p className="text-neutral-600">No sponsors found</p>
                <p className="text-sm text-neutral-500 mt-2">
                  Create a sponsor profile to see recommendations
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Organizer View */}
        <TabsContent value="organizers" className="space-y-4">
          {events.length > 0 ? (
            events.map((event) => (
              <div key={event.id}>
                <h3 className="text-lg font-semibold mb-4">{event.title}</h3>
                <EventSponsorMatches eventId={event.id} minScore={0.5} />
              </div>
            ))
          ) : (
            <Card variant="outlined">
              <CardContent className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                <p className="text-neutral-600">No events found</p>
                <p className="text-sm text-neutral-500 mt-2">
                  Create an event to get sponsor recommendations
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Live Calculator */}
        <TabsContent value="calculator" className="space-y-4">
          {sponsors.length > 0 && events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sponsors.slice(0, 3).map((sponsor) =>
                events.slice(0, 2).map((event) => (
                  <LiveMatchCalculator
                    key={`${event.id}-${sponsor.id}`}
                    eventId={event.id}
                    sponsorId={sponsor.id}
                  />
                ))
              )}
            </div>
          ) : (
            <Card variant="outlined">
              <CardContent className="text-center py-12">
                <Sparkles className="h-12 w-12 mx-auto text-neutral-300 mb-4" />
                <p className="text-neutral-600">Need sponsors and events to calculate matches</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

