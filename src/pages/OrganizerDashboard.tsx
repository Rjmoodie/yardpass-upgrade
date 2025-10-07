// src/pages/OrganizerDashboard.tsx
import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { CalendarDays, Users, DollarSign, Plus, BarChart3, Building2, CheckCircle2, Megaphone, Settings, Mail } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
      <div className="container mx-auto p-6">
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
      <div className="flex flex-col gap-3 sm:gap-4">
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

            <div className="text-sm sm:text-base text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium truncate max-w-[200px] sm:max-w-none">{headerName}</span>
              {isVerified && (
                <span className="inline-flex items-center gap-1 text-xs text-blue-600 flex-shrink-0">
                  <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" /> Verified
                </span>
              )}
              <span className="flex-shrink-0">• {totals.events} event{totals.events === 1 ? '' : 's'}</span>
              <span className="flex-shrink-0">• {totals.attendees} attendees</span>
              <span className="flex-shrink-0">• ${totals.revenue.toLocaleString()} revenue</span>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button className="flex-1 sm:flex-initial sm:w-auto" onClick={goCreateEvent}>
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Create Event</span>
              <span className="sm:hidden">Create</span>
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-initial sm:w-auto"
              onClick={() => (window.location.href = '/create-organization')}
            >
              <Building2 className="mr-2 h-4 w-4" />
              New Org
            </Button>
          </div>
        </div>
      </div>

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
          {(events?.length ?? 0) === 0 ? (
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
            <EventsList events={events} onEventSelect={handleEventSelect} />
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
          {events && events.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Event Communications</h2>
              </div>
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{event.title}</h3>
                  <OrganizerCommsPanel eventId={event.id} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-lg">
              <Mail className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Event Messaging</h3>
              <p className="text-muted-foreground mb-4">
                Create an event first to send messages to attendees.
              </p>
              <Button onClick={goCreateEvent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Event
              </Button>
            </div>
          )}
        </TabsContent>

        {/* TEAMS (org-scoped only) */}
        <TabsContent value="teams" className="space-y-6">
          {selectedOrganization ? (
            <OrganizationTeamPanel organizationId={selectedOrganization} />
          ) : (
            <div className="text-center py-16 border rounded-lg">
              <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-semibold mb-1">Team Management</h3>
              <p className="text-muted-foreground mb-4">
                Switch to an organization to manage team members and roles.
              </p>
            </div>
          )}
        </TabsContent>

        {/* PAYOUTS (scope-aware) */}
        <TabsContent value="payouts" className="space-y-6">
          <PayoutPanel
            key={`${selectedOrganization || 'individual'}-payouts`}
            contextType={selectedOrganization ? 'organization' : 'individual'}
            contextId={selectedOrganization || user?.id}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Organization Modal */}
      <Dialog open={editingOrg} onOpenChange={setEditingOrg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter organization name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-description">Description</Label>
              <Textarea
                id="org-description"
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your organization"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-website">Website URL</Label>
              <Input
                id="org-website"
                value={editForm.website_url}
                onChange={(e) => setEditForm(prev => ({ ...prev, website_url: e.target.value }))}
                placeholder="https://example.com"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-location">Location</Label>
              <Input
                id="org-location"
                value={editForm.location}
                onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                placeholder="City, State/Country"
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
