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
    <div className="space-y-4">
      {/* Overview Stats - Mobile optimized grid */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
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
      <Card className="overflow-hidden rounded-xl border-border/20">
        <CardHeader className="relative flex flex-col gap-1 border-b border-border/10 py-4">
          <div className="relative">
            <Badge variant="secondary" className="w-fit rounded-full bg-primary/10 border-primary/20 text-primary font-medium">
              Recent Performance
            </Badge>
            <CardTitle className="mt-2 text-lg font-bold tracking-tight">Recent Events</CardTitle>
            <p className="mt-1 text-xs text-foreground/60">
              Track attendance, revenue, and sponsor impact from the latest launches.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
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
                className="flex w-full flex-col gap-3 rounded-lg border border-border/10 p-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate tracking-tight">{event.title}</h3>
                    <p className="text-xs text-foreground/60 font-medium mt-0.5">{eventDate}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/30 bg-card/30 px-2.5 py-1 text-xs tabular-nums">
                      <Users className="h-3 w-3 text-foreground/60" aria-hidden="true" />
                      <span className="font-medium">{event.attendees.toLocaleString()}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs tabular-nums text-green-700 dark:text-green-400">
                      <DollarSign className="h-3 w-3" aria-hidden="true" />
                      <span className="font-semibold">${event.revenue.toLocaleString()}</span>
                    </span>
                    {event.sponsor_count && event.sponsor_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs tabular-nums text-amber-700 dark:text-amber-400">
                        <Handshake className="h-3 w-3" aria-hidden="true" />
                        <span className="font-medium">{event.sponsor_count} • ${(event.sponsor_revenue || 0).toLocaleString()}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-xs tabular-nums text-purple-700 dark:text-purple-400">
                      <Eye className="h-3 w-3" aria-hidden="true" />
                      <span className="font-medium">{event.views.toLocaleString()}</span>
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
