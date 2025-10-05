import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, DollarSign, Eye, MousePointerClick, Play, Pause, Archive, Target } from "lucide-react";
import { useMemo } from "react";

type CampaignRow = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "active" | "paused" | "completed" | "archived";
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions?: number;
  revenue?: number;
  startDate: string;
  endDate?: string;
};
export const CampaignList = ({
  loading = false,
  campaigns = [],
  onPause,
  onResume,
  onEdit,
  onArchive,
  orgId,
}: {
  orgId?: string;
  loading?: boolean;
  campaigns?: CampaignRow[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onEdit?: (id: string) => void;
  onArchive?: (id: string) => void;
}) => {
  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => (a.status === "active" ? -1 : 1)),
    [campaigns]
  );

  if (loading) {
    console.log("[CampaignList] Showing loading state");
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  console.log("[CampaignList] Sorted campaigns:", sorted.length);

  if (sorted.length === 0) {
    console.log("[CampaignList] Showing empty state");
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <Target className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No campaigns yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          You haven't created any advertising campaigns for this organization yet. 
          Create your first campaign to start promoting your events and tracking performance.
        </p>
        <div className="space-y-2">
          <Button asChild size="lg">
            <a href="#create">Create Your First Campaign</a>
          </Button>
          <p className="text-sm text-muted-foreground">
            Campaigns help you promote events and reach more attendees
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((c) => {
        // CTR is already a ratio (0..1) from the RPC
        const ctr = c.impressions ? c.clicks / c.impressions : 0;
        const pct = Math.min(100, Math.round((c.spent / Math.max(1, c.budget)) * 100));
        return (
          <Card key={c.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{c.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Calendar className="h-4 w-4" />
                    {c.startDate} {c.endDate ? `→ ${c.endDate}` : ""}
                  </CardDescription>
                </div>
                <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">
                  {c.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-4 mb-4">
                <Stat label="Budget" value={`${c.budget.toLocaleString()} credits`} icon={<DollarSign className="h-3 w-3" />} />
                <Stat label="Spent" value={`${c.spent.toLocaleString()} credits`} />
                <Stat label="Impressions" value={c.impressions.toLocaleString()} icon={<Eye className="h-3 w-3" />} />
                <Stat label="Clicks" value={c.clicks.toLocaleString()} icon={<MousePointerClick className="h-3 w-3" />} />
                <Stat label="CTR" value={new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(ctr)} />
                {c.conversions !== undefined && <Stat label="Conversions" value={c.conversions.toLocaleString()} />}
                {c.revenue !== undefined && <Stat label="Revenue" value={`$${(c.revenue / 100).toFixed(2)}`} />}
              </div>

              {/* Spend progress */}
              <div className="w-full bg-muted h-2 rounded">
                <div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} role="progressbar" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pct}% of budget spent</p>

              <div className="flex gap-2 mt-4">
                {c.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={() => onPause?.(c.id)}>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onResume?.(c.id)}>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => onEdit?.(c.id)}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={() => onArchive?.(c.id)}>
                  <Archive className="h-4 w-4 mr-1" />
                  Archive
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}