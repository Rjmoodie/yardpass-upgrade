import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { CampaignList } from "./CampaignList";
import { CampaignCreator } from "./CampaignCreator";
import { CampaignAnalytics } from "./CampaignAnalytics";
import { CreativeManager } from "./CreativeManager";
import { BarChart3, FileText, Target, TrendingUp } from "lucide-react";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useCampaignAnalytics } from "@/hooks/useCampaignAnalytics";
import { useCreativeRollup } from "@/hooks/useCreativeRollup";
import { addDays, format } from "date-fns";

export const CampaignDashboard = ({ orgId }: { orgId?: string }) => {
  const [selectedTab, setSelectedTab] = useState<string>(() => window.location.hash.replace("#", "") || "campaigns");
  
  // Require org context for campaigns
  console.log("[CampaignDashboard] orgId:", orgId);
  
  if (!orgId) {
    console.warn("[CampaignDashboard] No orgId provided");
    return (
      <Card className="p-12 text-center">
        <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-2">Organization Required</h2>
        <p className="text-muted-foreground mb-6">
          Campaigns are organization-scoped. Please select or create an organization to manage campaigns.
        </p>
      </Card>
    );
  }
  
  const { campaigns, isLoading: loadingCampaigns, pause, resume, archive } = useCampaigns(orgId);
  
  const dateRange = {
    from: addDays(new Date(), -13),
    to: new Date(),
  };
  
  const { totals, series, isLoading: loadingAnalytics, totalsByCampaign } = useCampaignAnalytics({
    orgId,
    from: dateRange.from,
    to: dateRange.to,
  });

  const { data: creativeData, isLoading: loadingCreatives } = useCreativeRollup({
    orgId: orgId || "",
    from: format(dateRange.from, "yyyy-MM-dd"),
    to: format(dateRange.to, "yyyy-MM-dd"),
    includeSeries: false,
    sort: "impressions",
    limit: 100,
  });

  useEffect(() => {
    const onHash = () => setSelectedTab(window.location.hash.replace("#", "") || "campaigns");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (selectedTab) window.location.hash = selectedTab;
  }, [selectedTab]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Campaign Manager</h1>
        <p className="text-muted-foreground">Create and manage your ad campaigns across YardPass</p>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns" className="gap-2">
            <Target className="h-4 w-4" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="creatives" className="gap-2">
            <FileText className="h-4 w-4" />
            Creatives
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Create New
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <CampaignList 
            campaigns={campaigns.map((c) => {
              const stats = totalsByCampaign.find((t) => t.campaign_id === c.id);
              return {
                id: c.id,
                name: c.name,
                status: c.status,
                budget: c.total_budget_credits,
                spent: c.spent_credits,
                impressions: stats?.impressions ?? 0,
                clicks: stats?.clicks ?? 0,
                conversions: stats?.conversions ?? 0,
                revenue: stats?.revenue_cents ?? 0,
                startDate: c.start_date.slice(0, 10),
                endDate: c.end_date?.slice(0, 10),
              };
            })}
            loading={loadingCampaigns || loadingAnalytics}
            onPause={pause}
            onResume={resume}
            onArchive={archive}
            orgId={orgId}
          />
        </TabsContent>

        <TabsContent value="creatives">
          <CreativeManager 
            creatives={(creativeData ?? []).map((cr: any) => ({
              id: cr.creative_id,
              type: cr.media_type,
              headline: cr.headline || "Untitled",
              campaign: cr.campaign_name || "Unknown Campaign",
              active: cr.active,
              impressions: Number(cr.impressions) || 0,
              clicks: Number(cr.clicks) || 0,
              conversions: Number(cr.conversions) || 0,
              revenue: Number(cr.revenue_cents) || 0,
              poster_url: cr.poster_url,
              media_url: cr.media_url,
            }))}
            loading={loadingCreatives}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <CampaignAnalytics
            loading={loadingAnalytics}
            totals={totals}
            series={series}
          />
        </TabsContent>

        <TabsContent value="create">
          <CampaignCreator orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};