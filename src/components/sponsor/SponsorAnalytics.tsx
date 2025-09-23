import { BarChart, TrendingUp, Eye, Users, DollarSign, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface SponsorAnalyticsProps {
  sponsorId: string | null;
}

export function SponsorAnalytics({ sponsorId }: SponsorAnalyticsProps) {
  if (!sponsorId) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">No Sponsor Selected</h3>
          <p className="text-muted-foreground">Please select a sponsor account to view analytics.</p>
        </CardContent>
      </Card>
    );
  }

  // Mock data - in a real app, this would come from API
  const metrics = {
    totalReach: 45000,
    totalImpressions: 120000,
    totalSpent: 17500,
    activeSponsorships: 3,
    avgCostPerImpression: 0.15,
    roiScore: 85
  };

  const campaigns = [
    {
      id: "1",
      event: "Tech Conference 2024",
      tier: "Gold",
      reach: 15000,
      impressions: 45000,
      clicks: 1200,
      spent: 5000,
      roi: 92
    },
    {
      id: "2", 
      event: "Startup Meetup",
      tier: "Silver",
      reach: 8000,
      impressions: 25000,
      clicks: 800,
      spent: 2500,
      roi: 78
    },
    {
      id: "3",
      event: "Annual Summit",
      tier: "Presenting",
      reach: 22000,
      impressions: 50000,
      clicks: 2100,
      spent: 10000,
      roi: 88
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Sponsorship Analytics</h2>
          <p className="text-muted-foreground">
            Track the performance and ROI of your sponsorship investments.
          </p>
        </div>
        <div className="flex gap-2">
          <Select defaultValue="30d">
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.totalReach.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Reach</div>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
              <span className="text-green-600">+12% vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.totalImpressions.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Impressions</div>
              </div>
              <Eye className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
              <span className="text-green-600">+8% vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">${metrics.totalSpent.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Total Spent</div>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-muted-foreground">Avg. CPI: ${metrics.avgCostPerImpression.toFixed(3)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.activeSponsorships}</div>
                <div className="text-sm text-muted-foreground">Active Sponsorships</div>
              </div>
              <Calendar className="h-8 w-8 text-orange-600" />
            </div>
            <div className="mt-2">
              <Badge variant="secondary">2 ending soon</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{metrics.roiScore}%</div>
                <div className="text-sm text-muted-foreground">ROI Score</div>
              </div>
              <BarChart className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2 flex items-center text-sm">
              <span className="text-green-600">Excellent performance</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{campaign.event}</h4>
                    <Badge variant="outline">{campaign.tier} Sponsorship</Badge>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">${campaign.spent.toLocaleString()}</div>
                    <div className="text-sm text-muted-foreground">Invested</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">{campaign.reach.toLocaleString()}</div>
                    <div className="text-muted-foreground">Reach</div>
                  </div>
                  <div>
                    <div className="font-medium">{campaign.impressions.toLocaleString()}</div>
                    <div className="text-muted-foreground">Impressions</div>
                  </div>
                  <div>
                    <div className="font-medium">{campaign.clicks.toLocaleString()}</div>
                    <div className="text-muted-foreground">Clicks</div>
                  </div>
                  <div>
                    <div className="font-medium text-green-600">{campaign.roi}%</div>
                    <div className="text-muted-foreground">ROI Score</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    Click-through rate: {((campaign.clicks / campaign.impressions) * 100).toFixed(2)}%
                  </div>
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-1">🎯 Top Performing Category</h4>
            <p className="text-sm text-blue-700">
              Tech conferences show 23% higher engagement rates than other event types.
            </p>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-1">📈 Growth Opportunity</h4>
            <p className="text-sm text-green-700">
              Consider increasing investment in Q2 events - historically 18% better ROI.
            </p>
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-1">⚡ Quick Win</h4>
            <p className="text-sm text-amber-700">
              Silver tier sponsorships have 15% lower cost per impression while maintaining visibility.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}