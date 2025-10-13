// src/pages/OrganizerDashboard.tsx
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  Users,
  DollarSign,
  Plus,
  BarChart3,
  Building2,
  Megaphone,
  Settings,
  Mail,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizationTeamPanel } from '@/components/OrganizationTeamPanel';
import EventManagement from '@/components/EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import LoadingSpinner from '@/components/dashboard/LoadingSpinner';
import { LoadingSpinner as BrandedLoadingSpinner } from '@/components/LoadingSpinner';
import { CampaignDashboard } from '@/components/campaigns/CampaignDashboard';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import { useOrganizerDashboardState } from '@/hooks/useOrganizerDashboardState';
import type { OrganizerEventSummary } from '@/types/organizer';

// Helper components
function StatTile({ icon: Icon, label, value, helper }: any) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {helper && <div className="text-xs text-muted-foreground">{helper}</div>}
    </div>
  );
}

// Helper formatters
const formatNumber = (n: number) => n.toLocaleString();
const formatCurrency = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function OrganizerDashboard() {
  const {
    user,
    organizations,
    orgsLoading,
    selectedOrganization,
    activeTab,
    setActiveTab,
    handleOrganizationSelect,
    events,
    eventsLoading,
    totals,
    goCreateEvent,
    logEventSelect,
  } = useOrganizerDashboardState();

  const [editingOrg, setEditingOrg] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', website_url: '', location: '' });
  const loading = eventsLoading;

  const [selectedEvent, setSelectedEvent] = useState<OrganizerEventSummary | null>(null);
  const handleEventSelect = useCallback((event: OrganizerEventSummary) => {
    logEventSelect(event.id);
    setSelectedEvent(event);
  }, [logEventSelect]);

  // --- Early loading ---
  if ((loading && !(events?.length)) || (orgsLoading && !organizations.length)) {
    return <LoadingSpinner />;
  }

  // --- Event management drill-in ---
  if (selectedEvent) {
    const e = selectedEvent;
    const eventWithDetails = {
      ...e,
      created_at: e.created_at || new Date().toISOString(),
      start_at: e.start_at,
      end_at: e.end_at,
      venue: e.venue || '',
      category: e.category || '',
      cover_image_url: e.cover_image_url || '',
      description: e.description || '',
      city: e.city || '',
      visibility: e.visibility || 'public',
    };

    return (
      <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 lg:px-8">
        <EventManagement
          event={{
            ...eventWithDetails,
            organizer: user?.email || 'Organizer',
            organizerId: user?.id || '',
            startAtISO: eventWithDetails.start_at,
            dateLabel: new Date(eventWithDetails.start_at).toLocaleDateString(),
            location: eventWithDetails.venue || '',
            coverImage: eventWithDetails.cover_image_url || '',
            ticketTiers: [],
            attendeeCount: eventWithDetails.attendees,
            likes: eventWithDetails.likes,
            shares: eventWithDetails.shares,
            posts: [],
          }}
          onBack={() => setSelectedEvent(null)}
        />
      </div>
    );
  }

  const activeOrg = selectedOrganization
    ? organizations.find(o => o.id === selectedOrganization)
    : null;

  const eventList = events ?? [];
  const hasEvents = eventList.length > 0;

  const { upcomingEvent, topRevenueEvent, averageConversion, averageEngagement } = useMemo(() => {
    if (!eventList.length) {
      return {
        upcomingEvent: null as OrganizerEventSummary | null,
        topRevenueEvent: null as OrganizerEventSummary | null,
        averageConversion: 0,
        averageEngagement: 0,
      };
    }

    const sortedByDate = eventList
      .filter(event => {
        if (!event.start_at) return false;
        const time = new Date(event.start_at).getTime();
        return Number.isFinite(time) && time >= Date.now();
      })
      .sort((a, b) => {
        const aTime = new Date(a.start_at ?? '').getTime();
        const bTime = new Date(b.start_at ?? '').getTime();
        return aTime - bTime;
      });

    const topRevenue = [...eventList].sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
    const totalConversion = eventList.reduce((sum, event) => sum + (event.conversion_rate ?? 0), 0);
    const totalEngagement = eventList.reduce((sum, event) => sum + (event.engagement_rate ?? 0), 0);

    return {
      upcomingEvent: sortedByDate[0] ?? null,
      topRevenueEvent: topRevenue[0] ?? null,
      averageConversion: totalConversion / eventList.length,
      averageEngagement: totalEngagement / eventList.length,
    };
  }, [eventList]);

  const conversionDisplay = hasEvents ? formatPercent(averageConversion) : '—';
  const engagementDisplay = hasEvents ? formatPercent(averageEngagement) : '—';

  // Handle edit organization
  const handleEditOrg = async () => {
    if (!selectedOrganization) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          description: editForm.description || null,
          website_url: editForm.website_url || null,
          location: editForm.location || null,
        })
        .eq('id', selectedOrganization);

      if (error) throw error;

      toast({
        title: 'Organization updated',
        description: 'Organization details have been saved.',
      });
      setEditingOrg(false);
      
      // Refresh organizations list
      window.location.reload();
    } catch (error: any) {
      toast({
        title: 'Failed to update organization',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Initialize edit form when opening
  useEffect(() => {
    if (editingOrg && activeOrg) {
      setEditForm({
        name: activeOrg.name,
        description: (activeOrg as any).description || '',
        website_url: (activeOrg as any).website_url || '',
        location: (activeOrg as any).location || '',
      });
    }
  }, [editingOrg, activeOrg]);

  return (
    <div className="container mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Organizer Dashboard</h1>
              {!!organizations.length && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-2">
                  <OrgSwitcher
                    organizations={organizations}
                    value={selectedOrganization}
                    onSelect={handleOrganizationSelect}
                    onCreateOrgPath="/create-organization"
                    className="w-full sm:w-[240px] md:w-[280px]"
                  />
                  {selectedOrganization && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingOrg(true)}
                      title="Edit organization"
                      className="flex-shrink-0"
                    >
                      <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  )}
                </div>
              )}
              <CardDescription>
                Manage events, payouts, and messaging for your {selectedOrganization ? 'organization' : 'personal profile'}.
              </CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <Button className="w-full sm:w-auto" onClick={goCreateEvent} type="button">
                <Plus className="h-4 w-4" />
                <span className="ml-2">Create event</span>
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => (window.location.href = '/create-organization')}
                type="button"
              >
                <Building2 className="h-4 w-4" />
                <span className="ml-2">New organization</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile
              icon={CalendarDays}
              label={selectedOrganization ? 'Org events' : 'Your events'}
              value={formatNumber(totals.events)}
              helper={selectedOrganization ? 'Currently selected organization' : 'Personal scope'}
            />
            <StatTile
              icon={Users}
              label="Total attendees"
              value={formatNumber(totals.attendees)}
              helper="Confirmed check-ins"
            />
            <StatTile
              icon={DollarSign}
              label="Gross revenue"
              value={formatCurrency(totals.revenue)}
              helper={topRevenueEvent ? `Top: ${topRevenueEvent.title}` : 'All events combined'}
            />
            <StatTile
              icon={BarChart3}
              label="Avg conversion"
              value={conversionDisplay}
              helper="Tickets sold vs. capacity"
            />
            <StatTile
              icon={Megaphone}
              label="Avg engagement"
              value={engagementDisplay}
              helper="Likes vs. views on posts"
            />
          </div>

          {hasEvents && (
            <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming highlight
                </div>
                {upcomingEvent ? (
                  <>
                    <div className="text-base font-semibold text-foreground">{upcomingEvent.title}</div>
                    <p className="text-sm text-muted-foreground">{upcomingEvent.date}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(upcomingEvent.attendees ?? 0)} attendees</span>
                      <span>{formatCurrency(upcomingEvent.revenue ?? 0)}</span>
                    </div>
                    <Button
                      variant="link"
                      className="px-0 text-sm font-semibold"
                      onClick={() => handleEventSelect(upcomingEvent)}
                      type="button"
                    >
                      Open workspace
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No upcoming events yet—schedule one to see it here.
                  </p>
                )}
              </div>
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-dashed border-secondary/40 bg-secondary/10 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
                  <DollarSign className="h-4 w-4" />
                  Top earner
                </div>
                <div className="text-base font-semibold text-foreground">{topRevenueEvent?.title}</div>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(topRevenueEvent?.revenue ?? 0)} total revenue
                </p>
                <Button
                  variant="link"
                  className="px-0 text-sm font-semibold"
                  onClick={() => topRevenueEvent && handleEventSelect(topRevenueEvent)}
                  type="button"
                >
                  View performance
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-7 h-auto p-0.5 sm:p-1 gap-0.5 overflow-x-auto">
          <TabsTrigger value="dashboard" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Dash</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <CalendarDays className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Events</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <Megaphone className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Camps</span>
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <Mail className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Messages</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <Users className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Teams</span>
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex-col h-auto py-1.5 sm:py-2 md:py-3 px-0.5 sm:px-1 md:px-2 min-w-0">
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 mb-0.5 sm:mb-1 flex-shrink-0" />
            <span className="text-[10px] sm:text-xs leading-tight truncate w-full">Payouts</span>
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview events={events} onEventSelect={handleEventSelect} />
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="space-y-6">
          {eventsLoading ? (
            <BrandedLoadingSpinner
              label="Loading events…"
              helperText="Fetching your latest schedules and sales"
              className="py-12"
            />
          ) : (events?.length ?? 0) === 0 ? (
            <div className="text-center py-16 border rounded-lg">
              <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">
                {selectedOrganization ? 'No events yet' : 'No personal events'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {selectedOrganization 
                  ? 'Create your first event for this organization to get started.'
                  : organizations.length > 0
                    ? 'You have no personal events. Switch to an organization above to view organization events, or create a personal event.'
                    : 'Create your first event to get started.'
                }
              </p>
              <Button onClick={goCreateEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enhanced Events Workspace with Status-Aware Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{events.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {selectedOrganization ? 'Organization events' : 'Personal events'}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      Across all events
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Attendees</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(totals.attendees)}</div>
                    <p className="text-xs text-muted-foreground">
                      Total tickets sold
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg. Revenue</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {events.length > 0 ? formatCurrency(totals.revenue / events.length) : '$0'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Per event
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Events List with Enhanced Features */}
              <Card>
                <CardHeader>
                  <CardTitle>Events Overview</CardTitle>
                  <CardDescription>
                    Manage and monitor your events with real-time insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h3 className="font-semibold">{event.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {event.start_at ? new Date(event.start_at).toLocaleDateString() : 'Date TBD'}
                            {event.venue && ` • ${event.venue}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {event.tickets_sold || 0} attendees
                          </span>
                          <span className="font-medium">
                            {formatCurrency(event.revenue || 0)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => logEventSelect(event.id)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ANALYTICS */}
        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsHub />
        </TabsContent>

        {/* CAMPAIGNS (org-scoped only) */}
        <TabsContent value="campaigns" className="space-y-6">
          {selectedOrganization ? (
            <CampaignDashboard orgId={selectedOrganization} />
          ) : (
            <div className="text-center py-16 border rounded-lg">
              <Megaphone className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Campaign Management</h3>
              <p className="text-muted-foreground mb-4">
                Switch to an organization to create and manage ad campaigns.
              </p>
            </div>
          )}
        </TabsContent>

        {/* MESSAGING */}
        <TabsContent value="messaging" className="space-y-6">
          {hasEvents ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Event communications</h2>
              </div>
              {eventList.map(event => (
                <div key={event.id} className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
                  <h3 className="font-semibold">{event.title}</h3>
                  <p className="text-xs text-muted-foreground">{event.date}</p>
                  <div className="mt-3">
                    <OrganizerCommsPanel eventId={event.id} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center">
              <Mail className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Event messaging</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Create an event first to send targeted updates to attendees.
              </p>
              <Button onClick={goCreateEvent} type="button">
                <Plus className="h-4 w-4" />
                <span className="ml-2">Create event</span>
              </Button>
            </div>
          )}
        </TabsContent>

        {/* TEAMS */}
        <TabsContent value="teams" className="space-y-6">
          {selectedOrganization ? (
            <OrganizationTeamPanel organizationId={selectedOrganization} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center">
              <Users className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Team management</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Switch to an organization to manage team members and roles.
              </p>
            </div>
          )}
        </TabsContent>

        {/* PAYOUTS */}
        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel
            key={`${selectedOrganization || 'individual'}-payouts`}
            contextType={selectedOrganization ? 'organization' : 'individual'}
            contextId={selectedOrganization || user?.id}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={editingOrg} onOpenChange={setEditingOrg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Textarea
                id="org-description"
                value={editForm.description}
                onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your organization"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website URL</Label>
              <Input
                id="org-website"
                value={editForm.website_url}
                onChange={e => setEditForm(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-location">Location</Label>
              <Input
                id="org-location"
                value={editForm.location}
                onChange={e => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State/Country"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(false)} type="button">
              Cancel
            </Button>
            <Button onClick={handleEditOrg} type="button">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
