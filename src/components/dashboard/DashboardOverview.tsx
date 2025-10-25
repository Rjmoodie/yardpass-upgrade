import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Users, DollarSign, Eye, Handshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Event {
  id: string;
  title: string;
  status: string;
  date: string;
  attendees: number;
  revenue: number;
  views: number;
  likes: number;
  shares: number;
  tickets_sold: number;
  capacity: number;
  start_at: string;
  sponsor_count?: number;
  sponsor_revenue?: number;
}

interface DashboardOverviewProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
}

interface Totals {
  totalRevenue: number;
  totalAttendees: number;
  totalViews: number;
  totalLikes: number;
  totalSponsorRevenue: number;
  totalSponsors: number;
}

const calculateTotals = (events: Event[]): Totals => {
  return events.reduce((acc, event) => ({
    totalRevenue: acc.totalRevenue + event.revenue,
    totalAttendees: acc.totalAttendees + event.attendees,
    totalViews: acc.totalViews + event.views,
    totalLikes: acc.totalLikes + event.likes,
    totalSponsorRevenue: acc.totalSponsorRevenue + (event.sponsor_revenue || 0),
    totalSponsors: acc.totalSponsors + (event.sponsor_count || 0)
  }), { 
    totalRevenue: 0, 
    totalAttendees: 0, 
    totalViews: 0, 
    totalLikes: 0, 
    totalSponsorRevenue: 0,
    totalSponsors: 0 
  });
};

export function DashboardOverview({ events, onEventSelect }: DashboardOverviewProps) {
  const totals = calculateTotals(events);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 lg:grid-cols-6">
        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
          <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-primary/10 to-transparent" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Events</CardTitle>
              <div className="mt-2 text-3xl font-semibold text-foreground">{events.length}</div>
            </div>
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <CalendarDays className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">All time</CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
          <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-emerald-500/10 to-transparent" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ticket Revenue</CardTitle>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                ${totals.totalRevenue.toLocaleString()}
              </div>
            </div>
            <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">From ticket sales</CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
          <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-amber-500/10 to-transparent" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sponsor Revenue</CardTitle>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                ${totals.totalSponsorRevenue.toLocaleString()}
              </div>
            </div>
            <div className="rounded-full bg-amber-500/10 p-3 text-amber-500">
              <Handshake className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">From sponsorships</CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
          <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-sky-500/10 to-transparent" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Attendees</CardTitle>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {totals.totalAttendees.toLocaleString()}
              </div>
            </div>
            <div className="rounded-full bg-sky-500/10 p-3 text-sky-500">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Tickets issued</CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
          <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-purple-500/10 to-transparent" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active Sponsors</CardTitle>
              <div className="mt-2 text-3xl font-semibold text-foreground">{totals.totalSponsors}</div>
            </div>
            <div className="rounded-full bg-purple-500/10 p-3 text-purple-500">
              <Handshake className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Across all events</CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-muted/40 shadow-sm">
          <span className="absolute inset-y-0 right-0 w-1/3 bg-gradient-to-t from-indigo-500/10 to-transparent" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total Views</CardTitle>
              <div className="mt-2 text-3xl font-semibold text-foreground">
                {totals.totalViews.toLocaleString()}
              </div>
            </div>
            <div className="rounded-full bg-indigo-500/10 p-3 text-indigo-500">
              <Eye className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Video views</CardContent>
        </Card>
      </div>

      {/* Recent Events */}
      <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-1 border-b bg-muted/20 py-5">
          <Badge variant="secondary" className="w-fit rounded-full bg-primary/10 text-primary">Recent performance</Badge>
          <CardTitle className="text-xl font-semibold">Recent Events</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track attendance, revenue, and sponsor impact from the latest launches.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 p-6">
          {events.slice(0, 5).map(event => {
            const eventDate = event.start_at
              ? new Date(event.start_at).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  timeZone: 'UTC',
                })
              : 'Date TBD';

            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onEventSelect(event)}
                className="flex w-full flex-col gap-4 rounded-xl border border-transparent bg-background/40 p-4 text-left transition-all duration-150 hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">{eventDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-3 py-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {event.attendees.toLocaleString()} attendees
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-3.5 w-3.5" />${event.revenue.toLocaleString()}
                    </span>
                    {event.sponsor_count && event.sponsor_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-amber-600 dark:text-amber-400">
                        <Handshake className="h-3.5 w-3.5" />
                        {event.sponsor_count} sponsors • ${(event.sponsor_revenue || 0).toLocaleString()}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-indigo-600 dark:text-indigo-400">
                      <Eye className="h-3.5 w-3.5" />
                      {event.views.toLocaleString()} views
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}