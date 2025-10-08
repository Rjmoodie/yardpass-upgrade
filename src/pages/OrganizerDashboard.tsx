// src/pages/OrganizerDashboard.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  Users,
  DollarSign,
  Plus,
  BarChart3,
  Building2,
  CheckCircle2,
  Megaphone,
  Settings,
  Mail,
  LayoutDashboard,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OrgSwitcher } from '@/components/OrgSwitcher';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AnalyticsHub from '@/components/AnalyticsHub';
import { PayoutPanel } from '@/components/PayoutPanel';
import { OrganizationTeamPanel } from '@/components/OrganizationTeamPanel';
import EventManagement from '@/components/EventManagement';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { EventsList } from '@/components/dashboard/EventsList';
import { LoadingSpinner } from '@/components/dashboard/LoadingSpinner';
import { CampaignDashboard } from '@/components/campaigns/CampaignDashboard';
import { OrganizerCommsPanel } from '@/components/organizer/OrganizerCommsPanel';
import { useOrganizerDashboardState } from '@/hooks/useOrganizerDashboardState';
import type { OrganizerEventSummary } from '@/types/organizer';
import type { TabKey } from '@/utils/organizer/tabs';

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

const formatPercent = (value: number) => `${Math.round(value * 10) / 10}%`;

type TabConfig = {
  value: TabKey;
  label: string;
  icon: LucideIcon;
  description: string;
};

const TAB_CONFIG: TabConfig[] = [
  {
    value: 'dashboard',
    label: 'Overview',
    icon: LayoutDashboard,
    description: 'Performance snapshot',
  },
  {
    value: 'events',
    label: 'Events',
    icon: CalendarDays,
    description: 'Manage and review events',
  },
  {
    value: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    description: 'Deep-dive metrics',
  },
  {
    value: 'campaigns',
    label: 'Campaigns',
    icon: Megaphone,
    description: 'Promote experiences',
  },
  {
    value: 'messaging',
    label: 'Messaging',
    icon: Mail,
    description: 'Reach attendees',
  },
  {
    value: 'teams',
    label: 'Teams',
    icon: Users,
    description: 'Collaborate with staff',
  },
  {
    value: 'payouts',
    label: 'Payouts',
    icon: DollarSign,
    description: 'Track disbursements',
  },
];

type StatTileProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
};

const StatTile = ({ icon: Icon, label, value, helper }: StatTileProps) => (
  <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/70 p-4 shadow-sm">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
    </div>
  </div>
);

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

  const headerName = activeOrg?.name || 'Personal Dashboard';
  const isVerified = !!activeOrg?.is_verified;
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
  }, [events]);

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
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6">
        <Card className="border-none bg-card/70 shadow-lg shadow-primary/5">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Organizer dashboard
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-2xl sm:text-3xl md:text-4xl">{headerName}</CardTitle>
                {isVerified && (
                  <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified
                  </Badge>
                )}
              </div>
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
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working as</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <OrgSwitcher
                    organizations={organizations}
                    value={selectedOrganization}
                    onSelect={handleOrganizationSelect}
                    onCreateOrgPath="/create-organization"
                    className="w-full sm:w-[260px] md:w-[300px]"
                  />
                  {selectedOrganization && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingOrg(true)}
                      title="Edit organization"
                      className="h-11 w-11 flex-shrink-0"
                      type="button"
                    >
                      <Settings className="h-5 w-5" />
                      <span className="sr-only">Edit organization</span>
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {formatNumber(totals.events)} event{totals.events === 1 ? '' : 's'}
                </span>
                <span>• {formatNumber(totals.attendees)} attendees</span>
                <span>• {formatCurrency(totals.revenue)} gross</span>
              </div>
            </div>

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="-mx-1 overflow-x-auto pb-2">
            <TabsList className="flex w-max items-stretch gap-1 rounded-full bg-muted/60 p-1">
              {TAB_CONFIG.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex min-w-[104px] flex-col items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground transition-transform sm:text-sm"
                    title={tab.description}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardOverview events={eventList} onEventSelect={handleEventSelect} />
          </TabsContent>

          <TabsContent value="events" className="space-y-6">
            {!hasEvents ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">{selectedOrganization ? 'No events yet' : 'No personal events'}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {selectedOrganization
                    ? 'Create your first event for this organization to kick things off.'
                    : organizations.length > 0
                      ? 'You have no personal events. Switch to an organization above or create a new event to get started.'
                      : 'Create your first event to start selling tickets.'}
                </p>
                <Button onClick={goCreateEvent} type="button">
                  <Plus className="h-4 w-4" />
                  <span className="ml-2">Create event</span>
                </Button>
              </div>
            ) : (
              <EventsList events={eventList} onEventSelect={handleEventSelect} />
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsHub initialOrgId={selectedOrganization ?? undefined} />
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            {selectedOrganization ? (
              <CampaignDashboard orgId={selectedOrganization} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-6 py-16 text-center">
                <Megaphone className="h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold">Campaign management</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Switch to an organization to build paid campaigns and monitor acquisition funnels.
                </p>
              </div>
            )}
          </TabsContent>

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

          <TabsContent value="payouts" className="space-y-6">
            <PayoutPanel
              key={`${selectedOrganization || 'individual'}-payouts`}
              contextType={selectedOrganization ? 'organization' : 'individual'}
              contextId={selectedOrganization || user?.id}
            />
          </TabsContent>
        </Tabs>
      </div>

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
