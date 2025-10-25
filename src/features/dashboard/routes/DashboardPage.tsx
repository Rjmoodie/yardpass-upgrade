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
import type { LucideIcon } from 'lucide-react';
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
import { CampaignDashboard } from '@/components/campaigns/CampaignDashboard';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import { useOrganizerDashboardState } from '@/hooks/useOrganizerDashboardState';
import type { OrganizerEventSummary } from '@/types/organizer';

// Helper components
interface StatTileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
}

function StatTile({ icon: Icon, label, value, helper }: StatTileProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-4 shadow-sm">
      <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-primary/10 to-transparent" aria-hidden />
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
          <div className="mt-2 text-3xl font-semibold text-foreground">{value}</div>
          {helper && <div className="mt-1 text-xs text-muted-foreground">{helper}</div>}
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
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
    <div className="relative mx-auto w-full max-w-7xl space-y-6 overflow-x-hidden px-3 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_60%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_65%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 -z-10 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-border/40 to-transparent lg:block" />
      {/* Header */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-xl sm:p-8">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -left-20 h-44 w-44 rounded-full bg-emerald-500/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Enterprise workspace</p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">
                Organizer command center
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Monitor performance, orchestrate event teams, and steward financial operations across every organization in a single, executive dashboard.
              </p>
            </div>
            {!!organizations.length && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <OrgSwitcher
                  organizations={organizations}
                  value={selectedOrganization}
                  onSelect={handleOrganizationSelect}
                  onCreateOrgPath="/create-organization"
                  className="w-full sm:w-[220px]"
                />
                {selectedOrganization && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingOrg(true)}
                    title="Edit organization"
                    className="h-9 gap-2 rounded-full border-border/60 bg-background/60 px-4"
                    type="button"
                  >
                    <Settings className="h-4 w-4" />
                    Manage profile
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
            <Button className="h-11 w-full rounded-full sm:w-auto" onClick={goCreateEvent} type="button">
              <Plus className="h-4 w-4" />
              <span className="ml-2">Create event</span>
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-full border-border/60 sm:w-auto"
              onClick={() => (window.location.href = '/create-organization')}
              type="button"
            >
              <Building2 className="h-4 w-4" />
              <span className="ml-2">New organization</span>
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
              <span className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-t from-primary/20 to-transparent" aria-hidden />
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                <CalendarDays className="h-4 w-4" />
                Upcoming highlight
              </div>
              {upcomingEvent ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{upcomingEvent.title}</h2>
                    <p className="text-sm text-muted-foreground">{upcomingEvent.date}</p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatNumber(upcomingEvent.attendees ?? 0)} attendees</span>
                    <span>{formatCurrency(upcomingEvent.revenue ?? 0)}</span>
                  </div>
                  <Button
                    variant="link"
                    className="h-auto w-fit px-0 text-sm font-semibold"
                    onClick={() => handleEventSelect(upcomingEvent)}
                    type="button"
                  >
                    Open workspace
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No upcoming events yet—schedule one to surface here automatically.
                </p>
              )}
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm">
              <span className="absolute inset-y-0 right-0 w-1/4 bg-gradient-to-t from-emerald-500/20 to-transparent" aria-hidden />
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
                Revenue leader
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{topRevenueEvent?.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(topRevenueEvent?.revenue ?? 0)} total revenue
                  </p>
                </div>
                <Button
                  variant="link"
                  className="h-auto w-fit px-0 text-sm font-semibold"
                  onClick={() => topRevenueEvent && handleEventSelect(topRevenueEvent)}
                  type="button"
                >
                  View performance
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-7 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
          <TabsTrigger value="dashboard" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" />
            </span>
            Overview
          </TabsTrigger>
          <TabsTrigger value="events" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
              <CalendarDays className="h-4 w-4" />
            </span>
            Events
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
              <BarChart3 className="h-4 w-4" />
            </span>
            Analytics
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Megaphone className="h-4 w-4" />
            </span>
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="h-4 w-4" />
            </span>
            Messaging
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <Users className="h-4 w-4" />
            </span>
            Teams
          </TabsTrigger>
          <TabsTrigger value="payouts" className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-300">
              <DollarSign className="h-4 w-4" />
            </span>
            Payouts
          </TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview events={events} onEventSelect={handleEventSelect} />
        </TabsContent>

        {/* EVENTS */}
        <TabsContent value="events" className="space-y-6">
          {eventsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (events?.length ?? 0) === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-8 py-16 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  {selectedOrganization ? 'No events yet' : 'No personal events'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedOrganization
                    ? 'Create your first event for this organization to activate reporting and collaboration tools.'
                    : organizations.length > 0
                      ? 'Switch to an organization above to view shared events, or launch a personal event to see it here.'
                      : 'Create your first event to get started.'}
                </p>
              </div>
              <Button onClick={goCreateEvent} type="button" className="rounded-full px-6">
                <Plus className="mr-2 h-4 w-4" />
                Create event
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Enhanced Events Workspace with Status-Aware Summary Cards */}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total events</CardTitle>
                      <div className="mt-2 text-3xl font-semibold text-foreground">{events.length}</div>
                    </div>
                    <span className="rounded-full bg-primary/10 p-3 text-primary">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    {selectedOrganization ? 'Organization events' : 'Personal events'}
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total revenue</CardTitle>
                      <div className="mt-2 text-3xl font-semibold text-foreground">{formatCurrency(totals.revenue)}</div>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
                      <DollarSign className="h-4 w-4" />
                    </span>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Across all events
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total attendees</CardTitle>
                      <div className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(totals.attendees)}</div>
                    </div>
                    <span className="rounded-full bg-sky-500/10 p-3 text-sky-500">
                      <Users className="h-4 w-4" />
                    </span>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Total tickets sold
                  </CardContent>
                </Card>

                <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/30 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div>
                      <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avg. revenue</CardTitle>
                      <div className="mt-2 text-3xl font-semibold text-foreground">
                        {events.length > 0 ? formatCurrency(totals.revenue / events.length) : '$0'}
                      </div>
                    </div>
                    <span className="rounded-full bg-purple-500/10 p-3 text-purple-500">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    Per event
                  </CardContent>
                </Card>
              </div>

              {/* Events List with Enhanced Features */}
              <Card className="overflow-hidden rounded-3xl border border-border/70 bg-background/80 shadow-lg">
                <CardHeader className="border-b bg-muted/20">
                  <CardTitle className="text-lg font-semibold">Events portfolio</CardTitle>
                  <CardDescription className="text-sm text-muted-foreground">
                    Monitor live performance, conversion, and attendance by event.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border/60 p-0">
                  {events.map(event => (
                    <div key={event.id} className="flex flex-col gap-4 px-6 py-5 transition-colors hover:bg-muted/30 md:flex-row md:items-center md:justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {event.start_at ? new Date(event.start_at).toLocaleDateString() : 'Date TBD'}
                          {event.venue && ` • ${event.venue}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="inline-flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1 text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {event.tickets_sold || 0} attendees
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400">
                          <DollarSign className="h-3.5 w-3.5" />
                          {formatCurrency(event.revenue || 0)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-border/60"
                          onClick={() => logEventSelect(event.id)}
                        >
                          Open workspace
                        </Button>
                      </div>
                    </div>
                  ))}
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
