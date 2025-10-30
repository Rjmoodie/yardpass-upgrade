import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, DollarSign, Eye, MousePointerClick, Play, Pause, Archive, Target, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getPacingVariant } from "@/lib/campaignInsights";

type CampaignRow = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "active" | "paused" | "completed" | "archived";
  budget: number;
  spent: number;
  remainingCredits?: number;
  impressions: number;
  clicks: number;
  conversions?: number;
  revenue?: number;
  startDate: string;
  endDate?: string;
  pacingHealth?: "on-track" | "slow" | "stalled" | "accelerating" | "complete";
  deliveryStatus?: string;
  credits7d?: number;
  impressions7d?: number;
  clicks7d?: number;
  activeCreatives?: number;
};
export const CampaignList = ({
  loading = false,
  campaigns = [],
  onPause,
  onResume,
  onEdit,
  onArchive,
  orgId,
  resumeDisabledReasons,
}: {
  orgId?: string;
  loading?: boolean;
  campaigns?: CampaignRow[];
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onEdit?: (id: string) => void;
  onArchive?: (id: string) => void;
  resumeDisabledReasons?: Record<string, string>;
}) => {
  const navigate = useNavigate();
  
  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => (a.status === "active" ? -1 : 1)),
    [campaigns]
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (sorted.length === 0) {
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
        const resumeDisabledReason = resumeDisabledReasons?.[c.id];
        const pacingVariant = getPacingVariant(c.pacingHealth);
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
                  {c.deliveryStatus && c.deliveryStatus !== c.status && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Delivery state: <span className="capitalize">{c.deliveryStatus.replace("-", " ")}</span>
                    </p>
                  )}
                  {typeof c.activeCreatives === "number" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Active creatives: {c.activeCreatives}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">
                    {c.status}
                  </Badge>
                  {c.pacingHealth && (
                    <Badge variant={pacingVariant} className="capitalize">
                      {c.pacingHealth.replace("-", " ")}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
              <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-4">
                <Stat label="Budget" value={`${c.budget.toLocaleString()} credits`} icon={<DollarSign className="h-3 w-3" />} />
                <Stat label="Spent" value={`${c.spent.toLocaleString()} credits`} />
                <Stat
                  label="Remaining"
                  value={`${Math.max(0, (c.remainingCredits ?? c.budget - c.spent)).toLocaleString()} credits`}
                />
                <Stat label="Impressions" value={c.impressions.toLocaleString()} icon={<Eye className="h-3 w-3" />} />
                <Stat label="Clicks" value={c.clicks.toLocaleString()} icon={<MousePointerClick className="h-3 w-3" />} />
                <Stat label="CTR" value={new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(ctr)} />
                {c.conversions !== undefined && <Stat label="Conversions" value={c.conversions.toLocaleString()} />}
                {c.revenue !== undefined && c.conversions !== 0 && <Stat label="Revenue" value={`$${(c.revenue / 100).toFixed(2)}`} />}
                {typeof c.impressions7d === "number" && (
                  <Stat label="7d Impressions" value={c.impressions7d.toLocaleString()} />
                )}
                {typeof c.clicks7d === "number" && (
                  <Stat label="7d Clicks" value={c.clicks7d.toLocaleString()} />
                )}
                {typeof c.credits7d === "number" && (
                  <Stat label="7d Spend" value={`${Math.round(c.credits7d).toLocaleString()} credits`} />
                )}
              </div>

              {/* Spend progress */}
              <div className="w-full bg-muted h-2 rounded">
                <div className="h-2 bg-primary rounded" style={{ width: `${pct}%` }} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} role="progressbar" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pct}% of budget spent</p>

              <div className="flex flex-wrap gap-2 mt-4">
                {c.status === "active" ? (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onPause?.(c.id)}
                    className="touch-manipulation min-h-[36px] sm:min-h-[32px]"
                  >
                    <Pause className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">Pause</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onResume?.(c.id)}
                    disabled={!!resumeDisabledReason}
                    title={resumeDisabledReason ?? undefined}
                    className="touch-manipulation min-h-[36px] sm:min-h-[32px]"
                  >
                    <Play className="h-4 w-4 mr-1" />
                    <span className="hidden xs:inline">Resume</span>
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => navigate(`/campaign-analytics?id=${c.id}`)}
                  className="touch-manipulation min-h-[36px] sm:min-h-[32px]"
                >
                  <TrendingUp className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Analytics</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => onEdit?.(c.id)}
                  className="touch-manipulation min-h-[36px] sm:min-h-[32px]"
                >
                  Edit
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => onArchive?.(c.id)}
                  className="touch-manipulation min-h-[36px] sm:min-h-[32px] text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Archive className="h-4 w-4 mr-1" />
                  <span className="hidden xs:inline">Archive</span>
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