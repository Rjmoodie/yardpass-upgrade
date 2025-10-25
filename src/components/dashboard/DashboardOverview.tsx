import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarDays, Users, DollarSign, Eye, Handshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatCard } from './StatCard';
import { DecorativeGradient } from './DecorativeGradient';

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
      {/* Overview Stats - Mobile optimized grid */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={CalendarDays}
          label="Total Events"
          value={events.length}
          helper="All time"
          color="primary"
        />
        <StatCard
          icon={DollarSign}
          label="Ticket Revenue"
          value={`$${totals.totalRevenue.toLocaleString()}`}
          helper="From ticket sales"
          color="emerald"
        />
        <StatCard
          icon={Handshake}
          label="Sponsor Revenue"
          value={`$${totals.totalSponsorRevenue.toLocaleString()}`}
          helper="From sponsorships"
          color="amber"
        />
        <StatCard
          icon={Users}
          label="Total Attendees"
          value={totals.totalAttendees.toLocaleString()}
          helper="Tickets issued"
          color="sky"
        />
        <StatCard
          icon={Handshake}
          label="Active Sponsors"
          value={totals.totalSponsors}
          helper="Across all events"
          color="purple"
        />
        <StatCard
          icon={Eye}
          label="Total Views"
          value={totals.totalViews.toLocaleString()}
          helper="Video views"
          color="slate"
        />
      </div>

      {/* Recent Events - Optimized for performance */}
      <Card className="overflow-hidden rounded-2xl border border-border/70 shadow-sm">
        <CardHeader className="relative flex flex-col gap-1 border-b bg-muted/20 py-5">
          <DecorativeGradient color="primary" side="right" />
          <div className="relative">
            <Badge variant="secondary" className="w-fit rounded-full bg-primary/10 text-primary">
              Recent Performance
            </Badge>
            <CardTitle className="mt-2 text-xl font-semibold">Recent Events</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Track attendance, revenue, and sponsor impact from the latest launches.
            </p>
          </div>
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
                className="flex w-full flex-col gap-4 rounded-xl border border-transparent bg-background/40 p-4 text-left transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-foreground truncate">{event.title}</h3>
                    <p className="text-sm text-muted-foreground">{eventDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-3 py-1 text-xs tabular-nums">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      {event.attendees.toLocaleString()} attendees
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                      <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
                      ${event.revenue.toLocaleString()}
                    </span>
                    {event.sponsor_count && event.sponsor_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-xs tabular-nums text-amber-600 dark:text-amber-400">
                        <Handshake className="h-3.5 w-3.5" aria-hidden="true" />
                        {event.sponsor_count} sponsors • ${(event.sponsor_revenue || 0).toLocaleString()}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-3 py-1 text-xs tabular-nums text-indigo-600 dark:text-indigo-400">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
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
