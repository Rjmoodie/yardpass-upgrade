import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Eye, MousePointerClick, TrendingUp, DollarSign } from "lucide-react";

export const CampaignAnalytics = () => {
  const isLoading = false; // TODO: Hook up to actual data
  
  const stats = [
    {
      label: "Total Impressions",
      value: "68,600",
      change: "+12.5%",
      icon: Eye,
      color: "text-blue-500"
    },
    {
      label: "Total Clicks",
      value: "1,459",
      change: "+8.2%",
      icon: MousePointerClick,
      color: "text-green-500"
    },
    {
      label: "CTR",
      value: "2.13%",
      change: "+0.3%",
      icon: TrendingUp,
      color: "text-purple-500"
    },
    {
      label: "Total Spent",
      value: "3,550 credits",
      change: "-",
      icon: DollarSign,
      color: "text-orange-500"
    }
  ];

  if (isLoading) {
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
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={cn("h-4 w-4", stat.color)} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {stat.change !== "-" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.change} from last period
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
          <CardDescription>Impressions and clicks over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center border-2 border-dashed rounded-lg">
            <div className="text-center space-y-2">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Chart visualization coming soon</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Breakdown</CardTitle>
          <CardDescription>Performance by campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {["Summer Festival Promo", "Early Bird Tickets"].map((name, idx) => (
              <div key={name} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-sm text-muted-foreground">
                    {idx === 0 ? "45,200 impressions • 892 clicks" : "23,400 impressions • 567 clicks"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{idx === 0 ? "2,350" : "1,200"} credits</p>
                  <p className="text-sm text-muted-foreground">
                    {idx === 0 ? "1.97% CTR" : "2.42% CTR"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
