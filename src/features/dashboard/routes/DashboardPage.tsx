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
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
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
import { StatCard } from '@/components/dashboard/StatCard';
import { DecorativeGradient } from '@/components/dashboard/DecorativeGradient';
import type { OrganizerEventSummary } from '@/types/organizer';

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
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    website_url: '',
    location: '',
  });

  const activeOrg = useMemo(
    () => organizations.find((o: any) => o.id === selectedOrganization),
    [organizations, selectedOrganization]
  );

  const upcomingEvent = useMemo(() => {
    const now = new Date();
    return (events || [])
      .filter((e: any) => e.start_at && new Date(e.start_at) >= now)
      .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0];
  }, [events]);

  const topRevenueEvent = useMemo(() => {
    return (events || []).sort((a: any, b: any) => (b.revenue ?? 0) - (a.revenue ?? 0))[0];
  }, [events]);

  const hasEvents = events && events.length > 0;

  const conversionDisplay = useMemo(() => {
    const totalCapacity = events.reduce((sum: number, e: any) => sum + (e.capacity ?? 0), 0);
    const totalSold = events.reduce((sum: number, e: any) => sum + (e.tickets_sold ?? 0), 0);
    return totalCapacity > 0 ? formatPercent(totalSold / totalCapacity) : '0%';
  }, [events]);

  const engagementDisplay = useMemo(() => {
    const totalViews = events.reduce((sum: number, e: any) => sum + (e.views ?? 0), 0);
    const totalLikes = events.reduce((sum: number, e: any) => sum + (e.likes ?? 0), 0);
    return totalViews > 0 ? formatPercent(totalLikes / totalViews) : '0%';
  }, [events]);

  const handleEventSelect = useCallback(
    (evt: OrganizerEventSummary) => {
      logEventSelect(evt.id);
    },
    [logEventSelect]
  );

  const handleEditOrg = async () => {
    if (!selectedOrganization) return;

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          description: editForm.description,
          website_url: editForm.website_url,
          location: editForm.location,
        })
        .eq('id', selectedOrganization);

      if (error) throw error;

      toast({
        title: 'Organization updated',
        description: 'Your changes have been saved successfully.',
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
      {/* Subtle background gradient - no blur for performance */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/5 to-transparent" aria-hidden="true" />

      {/* Header Section */}
      <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 p-6 shadow-lg sm:p-8">
        <DecorativeGradient color="primary" side="right" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Dashboard</p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl md:text-4xl">
                Organizer Command Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Monitor performance, manage teams, and track financials across all your events in one unified dashboard.
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
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    <span>Manage</span>
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end lg:w-auto">
            <Button className="h-11 w-full rounded-full sm:w-auto" onClick={goCreateEvent} type="button">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="ml-2">Create Event</span>
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-full border-border/60 sm:w-auto"
              onClick={() => (window.location.href = '/create-organization')}
              type="button"
            >
              <Building2 className="h-4 w-4" aria-hidden="true" />
              <span className="ml-2">New Organization</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid - Mobile optimized */}
        <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            icon={CalendarDays}
            label={selectedOrganization ? 'Org Events' : 'Your Events'}
            value={formatNumber(totals.events)}
            helper={selectedOrganization ? 'Currently selected' : 'Personal scope'}
            color="primary"
          />
          <StatCard
            icon={Users}
            label="Total Attendees"
            value={formatNumber(totals.attendees)}
            helper="Confirmed check-ins"
            color="sky"
          />
          <StatCard
            icon={DollarSign}
            label="Gross Revenue"
            value={formatCurrency(totals.revenue)}
            helper={topRevenueEvent ? `Top: ${topRevenueEvent.title}` : 'All events'}
            color="emerald"
          />
          <StatCard
            icon={BarChart3}
            label="Avg Conversion"
            value={conversionDisplay}
            helper="Tickets sold vs capacity"
            color="purple"
          />
          <StatCard
            icon={Megaphone}
            label="Avg Engagement"
            value={engagementDisplay}
            helper="Likes vs views"
            color="amber"
          />
        </div>

        {/* Event Highlights - Only show if has events */}
        {hasEvents && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Upcoming Event Card */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
              <DecorativeGradient color="primary" side="right" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Upcoming Highlight
                </div>
                {upcomingEvent ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{upcomingEvent.title}</h2>
                      <p className="text-sm text-muted-foreground">{upcomingEvent.date}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                      <span>{formatNumber(upcomingEvent.attendees ?? 0)} attendees</span>
                      <span>{formatCurrency(upcomingEvent.revenue ?? 0)}</span>
                    </div>
                    <Button
                      variant="link"
                      className="h-auto w-fit px-0 text-sm font-semibold"
                      onClick={() => handleEventSelect(upcomingEvent)}
                      type="button"
                    >
                      Open Workspace →
                    </Button>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    No upcoming events scheduled yet.
                  </p>
                )}
              </div>
            </div>

            {/* Top Revenue Event Card */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-sm">
              <DecorativeGradient color="emerald" side="right" />
              <div className="relative">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  <DollarSign className="h-4 w-4" aria-hidden="true" />
                  Revenue Leader
                </div>
                <div className="mt-4 space-y-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{topRevenueEvent?.title}</h2>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(topRevenueEvent?.revenue ?? 0)} total revenue
                    </p>
                  </div>
                  <Button
                    variant="link"
                    className="h-auto w-fit px-0 text-sm font-semibold"
                    onClick={() => topRevenueEvent && handleEventSelect(topRevenueEvent)}
                    type="button"
                  >
                    View Performance →
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tabs Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-7 gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
          <TabsTrigger 
            value="dashboard" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Dash</span>
          </TabsTrigger>
          <TabsTrigger 
            value="events" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
            </span>
            Events
          </TabsTrigger>
          <TabsTrigger 
            value="analytics" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-500">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger 
            value="campaigns" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-600"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Campaigns</span>
            <span className="sm:hidden">Ads</span>
          </TabsTrigger>
          <TabsTrigger 
            value="messaging" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Messaging</span>
            <span className="sm:hidden">Mail</span>
          </TabsTrigger>
          <TabsTrigger 
            value="teams" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-rose-500/10 data-[state=active]:text-rose-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <Users className="h-4 w-4" aria-hidden="true" />
            </span>
            Teams
          </TabsTrigger>
          <TabsTrigger 
            value="payouts" 
            className="flex h-full flex-col items-center justify-center gap-2 rounded-xl py-3 text-[11px] font-medium uppercase tracking-wide data-[state=active]:bg-slate-500/10 data-[state=active]:text-slate-500"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-300">
              <DollarSign className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden sm:inline">Payouts</span>
            <span className="sm:hidden">Pay</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab Content */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview events={events} onEventSelect={handleEventSelect} />
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          {eventsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : (events?.length ?? 0) === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-8 py-16 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">
                  {selectedOrganization ? 'No Events Yet' : 'No Personal Events'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedOrganization
                    ? 'Create your first event to activate reporting and collaboration tools.'
                    : organizations.length > 0
                      ? 'Switch to an organization above or create a personal event.'
                      : 'Create your first event to get started.'}
                </p>
              </div>
              <Button onClick={goCreateEvent} type="button" className="rounded-full px-6">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Create Event
              </Button>
            </div>
          ) : (
            <EventManagement
              events={events}
              selectedOrganization={selectedOrganization}
              onEventSelect={handleEventSelect}
            />
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <AnalyticsHub />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          {selectedOrganization ? (
            <CampaignDashboard orgId={selectedOrganization} />
          ) : (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-8 py-16 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Megaphone className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Campaign Management</h3>
                <p className="text-sm text-muted-foreground">
                  Switch to an organization to create and manage ad campaigns.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="messaging" className="space-y-6">
          <OrganizerCommsPanel />
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          {selectedOrganization ? (
            <OrganizationTeamPanel orgId={selectedOrganization} />
          ) : (
            <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-8 py-16 text-center shadow-sm">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
                <Users className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Team Management</h3>
                <p className="text-sm text-muted-foreground">
                  Switch to an organization to manage team members and roles.
                </p>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel />
        </TabsContent>
      </Tabs>

      {/* Edit Organization Dialog */}
      <Dialog open={editingOrg} onOpenChange={setEditingOrg}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Textarea
                id="org-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website URL</Label>
              <Input
                id="org-website"
                type="url"
                value={editForm.website_url}
                onChange={(e) => setEditForm({ ...editForm, website_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-location">Location</Label>
              <Input
                id="org-location"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOrg(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditOrg}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
