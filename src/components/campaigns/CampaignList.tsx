import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, DollarSign, Eye, MousePointerClick, Play, Pause, Archive } from "lucide-react";

export const CampaignList = () => {
  const isLoading = false; // TODO: Hook up to actual data
  const campaigns = [
    {
      id: "1",
      name: "Summer Festival Promo",
      status: "active",
      budget: 5000,
      spent: 2350,
      impressions: 45200,
      clicks: 892,
      startDate: "2025-06-01",
      endDate: "2025-08-31"
    },
    {
      id: "2",
      name: "Early Bird Tickets",
      status: "paused",
      budget: 3000,
      spent: 1200,
      impressions: 23400,
      clicks: 567,
      startDate: "2025-05-15",
      endDate: "2025-06-15"
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => (
        <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">{campaign.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Calendar className="h-4 w-4" />
                  {campaign.startDate} → {campaign.endDate}
                </CardDescription>
              </div>
              <Badge 
                variant={campaign.status === "active" ? "default" : "secondary"}
                className="capitalize"
              >
                {campaign.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Budget
                </p>
                <p className="text-lg font-semibold">{campaign.budget} credits</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-lg font-semibold">{campaign.spent} credits</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  Impressions
                </p>
                <p className="text-lg font-semibold">{campaign.impressions.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MousePointerClick className="h-3 w-3" />
                  Clicks
                </p>
                <p className="text-lg font-semibold">{campaign.clicks}</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                {campaign.status === "active" ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm">
                Edit
              </Button>
              <Button variant="ghost" size="sm">
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {campaigns.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">No campaigns yet</p>
          <Button>Create Your First Campaign</Button>
        </Card>
      )}
    </div>
  );
};
