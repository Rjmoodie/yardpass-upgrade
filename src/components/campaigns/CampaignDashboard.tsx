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
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    const hash = window.location.hash.replace("#", "");
    return ["campaigns", "creatives", "analytics", "create"].includes(hash) ? hash : "campaigns";
  });
  
  // Require org context for campaigns
  console.log("[CampaignDashboard] orgId:", orgId);
  
  if (!orgId) {
    console.warn("[CampaignDashboard] No orgId provided");
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
          <Target className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Organization Required</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Campaigns are organization-scoped. Please select or create an organization to manage advertising campaigns.
        </p>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            You need to be part of an organization to create and manage campaigns
          </p>
        </div>
      </Card>
    );
  }
  
  const { campaigns, isLoading: loadingCampaigns, pause, resume, archive } = useCampaigns(orgId);
  
  const dateRange = {
    from: addDays(new Date(), -13),
    to: new Date(),
  };
  
  const { totals, series, isLoading: loadingAnalytics, error: analyticsError, totalsByCampaign } = useCampaignAnalytics({
    orgId,
    from: dateRange.from,
    to: dateRange.to,
  });

  // Format dates as YYYY-MM-DD strings for the RPC
  const { data: creativeData, isLoading: loadingCreatives, error: creativesError } = useCreativeRollup({
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
        
        {/* TODO: Campaign Manager UI - Still under review and development */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>🚧 Campaign Manager UI - Still Under Review</strong><br/>
            This interface is currently in development. Features may be limited and data may not reflect production values.
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {(analyticsError || creativesError) && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 mb-6 text-sm">
          <p className="font-semibold mb-1">Failed to load campaign data</p>
          <p className="text-muted-foreground">
            {analyticsError ? "Analytics: " + (analyticsError as any)?.message : ""}
            {creativesError ? "Creatives: " + (creativesError as any)?.message : ""}
          </p>
          <p className="text-muted-foreground mt-2">Please check that you have access to this organization.</p>
        </div>
      )}

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
            campaigns={(() => {
              console.log("[CampaignDashboard] Rendering campaigns tab", { 
                campaignsLength: campaigns.length, 
                loadingCampaigns, 
                loadingAnalytics 
              });
              return campaigns.map((c) => {
                const stats = totalsByCampaign?.find((t) => t.campaign_id === c.id);
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
              });
            })()}
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