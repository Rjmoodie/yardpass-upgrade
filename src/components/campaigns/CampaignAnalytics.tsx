import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { BarChart3, Calendar as CalendarIcon, Eye, MousePointerClick, TrendingUp, DollarSign } from "lucide-react";
import { addDays, format } from "date-fns";

type SeriesPoint = { date: string; impressions: number; clicks: number; credits_spent: number };
type CampaignAnalyticsProps = {
  loading?: boolean;
  totals?: {
    impressions: number;
    clicks: number;
    ctr?: number;           // 0..1 (will be formatted to %)
    credits_spent: number;  // in credits
    trend?: { impressions?: number; clicks?: number; ctr?: number }; // e.g. +0.125 for +12.5%
  };
  series?: SeriesPoint[];   // daily points
};

const nf = new Intl.NumberFormat();
const cf = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });

export const CampaignAnalytics = ({
  loading = false,
  totals = { impressions: 0, clicks: 0, ctr: 0, credits_spent: 0, trend: {} },
  series = [],
}: CampaignAnalyticsProps) => {
  const [dateOpen, setDateOpen] = useState(false);
  const [range, setRange] = useState<{ from: Date; to: Date }>({
    from: addDays(new Date(), -13),
    to: new Date(),
  });

  const stats = useMemo(() => {
    const ctr = totals.ctr ?? (totals.impressions ? totals.clicks / totals.impressions : 0);
    return [
      {
        label: "Total Impressions",
        value: nf.format(totals.impressions),
        change: formatTrend(totals.trend?.impressions),
        icon: Eye,
        color: "text-blue-500",
      },
      {
        label: "Total Clicks",
        value: nf.format(totals.clicks),
        change: formatTrend(totals.trend?.clicks),
        icon: MousePointerClick,
        color: "text-green-500",
      },
      {
        label: "CTR",
        value: formatPercent(ctr),
        change: formatTrend(totals.trend?.ctr),
        icon: TrendingUp,
        color: "text-purple-500",
      },
      {
        label: "Total Spent",
        value: `${nf.format(totals.credits_spent)} credits`,
        change: "-",
        icon: DollarSign,
        color: "text-orange-500",
      },
    ];
  }, [totals]);

  const filtered = useMemo(() => {
    const from = new Date(range.from);
    const to = new Date(range.to);
    return series.filter((p) => {
      const d = new Date(p.date);
      return d >= new Date(from.setHours(0,0,0,0)) && d <= new Date(to.setHours(23,59,59,999));
    });
  }, [series, range]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} role="region" aria-label={s.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className={`h-4 w-4 ${s.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" aria-live="polite">{s.value}</div>
                {s.change !== "-" && (
                  <p className="text-xs text-muted-foreground mt-1">{s.change} from last period</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Date Range + Chart */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-2 sm:flex-row flex-col">
          <div>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>Impressions and clicks over time</CardDescription>
          </div>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(range.from, "MMM d, yyyy")} – {format(range.to, "MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-0">
              <Calendar
                mode="range"
                selected={{ from: range.from, to: range.to }}
                onSelect={(v) => {
                  if (v?.from && v?.to) {
                    setRange({ from: v.from, to: v.to });
                    setDateOpen(false);
                  }
                }}
                numberOfMonths={2}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed rounded-lg">
              <div className="text-center space-y-2">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">No data in this range</p>
              </div>
            </div>
          ) : (
            <LinesChart data={filtered} />
          )}
        </CardContent>
      </Card>

      {/* Breakdown (by campaign) – leave as-is or feed real data */}
      {/* You can replace this with a table that maps your campaigns + computed CTR */}
    </div>
  );
};

function formatPercent(v = 0) {
  return new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 2 }).format(v);
}
function formatTrend(v?: number) {
  if (v === undefined || Number.isNaN(v)) return "-";
  const pct = formatPercent(v);
  return (v >= 0 ? "+" : "") + pct;
}

/** Lightweight responsive SVG chart (no extra deps) */
function LinesChart({ data }: { data: SeriesPoint[] }) {
  // normalize
  const w = 900, h = 300, pad = 32;
  const maxY = Math.max(
    10,
    ...data.map((d) => Math.max(d.impressions, d.clicks))
  );
  const xs = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, data.length - 1);
  const ys = (v: number) => h - pad - (v / maxY) * (h - pad * 2);

  const path = (key: "impressions" | "clicks") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${xs(i)} ${ys(d[key])}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Impressions and clicks over time">
        {/* grid */}
        <g opacity={0.15}>
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={t} x1={pad} x2={w - pad} y1={ys(maxY * t)} y2={ys(maxY * t)} stroke="currentColor" />
          ))}
        </g>
        {/* impressions */}
        <path d={path("impressions")} fill="none" stroke="currentColor" strokeWidth="2" />
        {/* clicks */}
        <path d={path("clicks")} fill="none" stroke="currentColor" strokeWidth="2" opacity={0.5} />
        {/* legend */}
        <g transform={`translate(${pad},${pad / 2})`} fontSize="12" className="text-muted-foreground">
          <rect width="12" height="2" y="5" />
          <text x="18" y="10">Impressions</text>
          <rect width="12" height="2" y="25" opacity={0.5} />
          <text x="18" y="30">Clicks</text>
        </g>
      </svg>
    </div>
  );
}